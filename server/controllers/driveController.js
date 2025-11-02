const { PrismaClient } = require("@prisma/client");
const { getDriveClient } = require("../utils/googleDrive");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const os = require("os");
const fs = require("fs");
const path = require("path");
const prisma = new PrismaClient();
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/auth/callback`
);

// Configure multer to use disk storage for large uploads (safer than memory)
// Default max upload size set to 20 GB unless overridden by MAX_UPLOAD_BYTES env
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 20 * 1024 ** 3; // 20 GB default
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});
const progressMap = new Map();
// simple in-memory recent uploads store (debugging aid)
const recentUploads = [];

const getAuthUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      state: Buffer.from(JSON.stringify({ userId })).toString("base64"),
    });
    res.json({ url });
  } catch (err) {
    console.error("getAuthUrl error:", err);
    res.status(500).json({ message: "Failed to generate auth URL" });
  }
};

const oauthCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state)
    return res.status(400).json({ message: "Missing code or state" });
  let userId;
  try {
    const { userId: id } = JSON.parse(Buffer.from(state, "base64").toString());
    userId = id;
  } catch {
    return res.status(400).json({ message: "Invalid state" });
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token)
      return res.status(400).json({ message: "Refresh token not received" });
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    const email = data.email;
    if (!email) throw new Error("No email from Google");
    const drive = getDriveClient(tokens.access_token);
    const about = await drive.about.get({ fields: "storageQuota" });
    const { limit, usage } = about.data.storageQuota;
    const totalSpaceGb = Number(limit) / 1024 ** 3;
    const usedSpaceGb = Number(usage) / 1024 ** 3;
    await prisma.driveAccount.upsert({
      where: { userId_email: { userId, email } },
      update: {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token ?? null,
        usedSpaceGb,
        totalSpaceGb,
      },
      create: {
        userId,
        email,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token ?? null,
        usedSpaceGb,
        totalSpaceGb,
      },
    });
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error("oauthCallback error:", err);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
};

const getAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await prisma.driveAccount.findMany({
      where: { userId },
      select: { email: true, usedSpaceGb: 1, totalSpaceGb: 1 },
    });
    const formatted = accounts.map((a) => ({
      email: a.email,
      usedSpace: Number(a.usedSpaceGb.toFixed(1)),
      totalSpace: Number(a.totalSpaceGb.toFixed(1)),
    }));
    res.json(formatted);
  } catch (err) {
    console.error("getAccounts error:", err);
    res.status(500).json({ message: "Failed to fetch accounts" });
  }
};

const disconnectAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    const account = await prisma.driveAccount.findUnique({
      where: { userId_email: { userId, email } },
    });
    if (!account) return res.status(404).json({ message: "Account not found" });
    if (account.refreshToken) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${account.refreshToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          }
        );
      } catch (revokeErr) {
        console.warn("Failed to revoke refresh token:", revokeErr.message);
      }
    }
    await prisma.driveAccount.delete({
      where: { userId_email: { userId, email } },
    });
    res.json({ message: "Account disconnected successfully" });
  } catch (err) {
    console.error("disconnectAccount error:", err);
    res.status(500).json({ message: "Failed to disconnect account" });
  }
};

const uploadFiles = [
  upload.array("files"),
  async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    try {
      const userId = req.user.id;

      const accounts = await prisma.driveAccount.findMany({
        where: { userId },
        select: {
          id: true,
          email: true,
          refreshToken: true,
          usedSpaceGb: true,
          totalSpaceGb: true,
        },
      });

      if (accounts.length === 0) {
        return res
          .status(400)
          .json({ message: "No connected Google Drive accounts" });
      }

      const tasks = [];

      for (const file of req.files) {
        const fileSizeGb = file.size / 1024 ** 3;

        const suitableAccount = accounts
          .filter((a) => {
            const hasSpace = a.usedSpaceGb + fileSizeGb <= a.totalSpaceGb;
            return hasSpace;
          })
          .sort(
            (a, b) =>
              b.totalSpaceGb - b.usedSpaceGb - (a.totalSpaceGb - a.usedSpaceGb)
          )
          .shift();

        if (!suitableAccount) {
          return res.status(400).json({
            message: `No account has enough space for ${file.originalname}`,
          });
        }

        const uploadId = uuidv4();

        tasks.push({ id: uploadId, fileName: file.originalname });
        progressMap.set(uploadId, { progress: 0, res: null });

        setImmediate(() => {
          uploadToDrive(uploadId, file, suitableAccount, userId).catch(
            (err) => {
              console.error(
                `Background upload failed for ${uploadId}:`,
                err.message
              );
            }
          );
        });
      }

      res.json(tasks);
    } catch (err) {
      console.error("uploadFiles error:", err);
      res.status(500).json({ message: "Upload initiation failed" });
    }
  },
];

const uploadToDrive = async (uploadId, file, account, userId) => {
  try {
    if (!account.refreshToken) {
      throw new Error("Missing refresh token");
    }

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Use the stored refresh token to obtain a fresh access token
    auth.setCredentials({ refresh_token: account.refreshToken });

    // googleapis may expose different helpers depending on version; using getAccessToken
    // will automatically refresh if needed. Some versions return an object, some a string.
    const accessResp = await auth.getAccessToken();
    const access_token =
      accessResp && typeof accessResp === "object"
        ? accessResp.token
        : accessResp;

    if (!access_token) {
      throw new Error("No access token after refresh");
    }

    auth.setCredentials({ access_token });
    const drive = google.drive({ version: "v3", auth });

    // For disk storage, stream from the temp file and track progress
    const filePath = file.path || (file.buffer && null);
    let fileSize = file.size;

    let readStream;
    if (filePath) {
      const stat = fs.statSync(filePath);
      fileSize = stat.size;
      readStream = fs.createReadStream(filePath);
    } else if (file.buffer) {
      // fallback (shouldn't happen with diskStorage)
      readStream = require("stream").Readable.from(file.buffer);
    } else {
      throw new Error("No file data available for upload");
    }

    const PassThrough = require("stream").PassThrough;
    const pass = new PassThrough();

    let uploaded = 0;
    readStream.on("data", (chunk) => {
      uploaded += chunk.length;
      const progress = Math.min(100, Math.round((uploaded / fileSize) * 100));
      const entry = progressMap.get(uploadId);
      if (entry?.res) {
        entry.res.write(`data: ${JSON.stringify({ progress })}\n\n`);
      }
      pass.write(chunk);
    });

    readStream.on("end", () => pass.end());
    readStream.on("error", (err) => pass.destroy(err));

    const media = {
      mimeType: file.mimetype,
      body: pass,
    };

    const response = await drive.files.create({
      requestBody: {
        name: file.originalname,
        // tag file so we can identify files uploaded by this app/user later
        appProperties: {
          uploaderId: String(userId),
          uploaderApp: "DriveMerge",
        },
      },
      media,
      fields: "id, name, mimeType, size, modifiedTime",
    });

    // Log and store debug info about the uploaded file and persist metadata to DB
    try {
      const driveFileId = response.data && response.data.id;
      console.log(
        `Uploaded to Drive: id=${driveFileId} name=${file.originalname} account=${account.email} user=${userId}`
      );
      recentUploads.push({
        id: driveFileId,
        name: file.originalname,
        size: fileSize,
        accountEmail: account.email,
        userId,
        uploadedAt: new Date().toISOString(),
      });
      // keep recentUploads bounded
      if (recentUploads.length > 200) recentUploads.shift();

      // Persist file metadata in DB for app-owned listing
      try {
        await prisma.file.create({
          data: {
            driveFileId: driveFileId,
            userId,
            driveAccountId: account.id,
            name: file.originalname,
            mime: response.data.mimeType || file.mimetype || null,
            sizeBytes: BigInt(fileSize),
          },
        });
      } catch (dbErr) {
        console.warn("Failed to persist file metadata:", dbErr && dbErr.message);
      }
    } catch (e) {
      console.warn("Failed to record recent upload debug info", e && e.message);
    }

    // Send 100%
    const entry = progressMap.get(uploadId);
    if (entry?.res) {
      entry.res.write(`data: ${JSON.stringify({ progress: 100 })}\n\n`);
      entry.res.end();
    }

    // Update DB
    const fileSizeGb = fileSize / 1024 ** 3;
    await prisma.driveAccount.update({
      where: { userId_email: { userId, email: account.email } },
      data: { usedSpaceGb: { increment: fileSizeGb } },
    });

    // remove temp file if on disk
    if (file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.warn("Failed to remove temp upload file", e.message);
      }
    }

    progressMap.delete(uploadId);
  } catch (err) {
    if (err.response?.data)
      console.error("Google API error:", err.response.data);

    const entry = progressMap.get(uploadId);
    if (entry?.res) {
      entry.res.write(
        `data: ${JSON.stringify({ progress: 0, error: "Upload failed" })}\n\n`
      );
      entry.res.end();
    }
    // remove temp file if on disk
    if (file && file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.warn(
          "Failed to remove temp upload file after error",
          e.message
        );
      }
    }
    progressMap.delete(uploadId);
  }
};

const listFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await prisma.driveAccount.findMany({ where: { userId } });

    const allFiles = [];
    const limit = Number(req.query.limit || 0);

    for (const account of accounts) {
      try {
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: account.refreshToken });
        const accessResp = await auth.getAccessToken();
        const access_token =
          accessResp && typeof accessResp === "object"
            ? accessResp.token
            : accessResp;
        if (!access_token) continue;
        auth.setCredentials({ access_token });
        const drive = google.drive({ version: "v3", auth });

        // Only list files we uploaded on behalf of this user (we tag with appProperties.uploaderId)
        const q = `trashed = false and appProperties has { key = 'uploaderId' and value = '${userId}' }`;

        const resp = await drive.files.list({
          q,
          fields: "files(id,name,mimeType,size,modifiedTime)",
          pageSize: limit > 0 ? limit : 200,
          orderBy: "modifiedTime desc",
        });

        const files = (resp.data.files || []).map((f) => ({
          id: f.id,
          name: f.name,
          mime: f.mimeType,
          size: Number(f.size || 0),
          modifiedAt: f.modifiedTime,
          accountEmail: account.email,
        }));

        allFiles.push(...files);
      } catch (err) {
        console.warn(
          "listFiles: failed for account",
          account.email,
          err.message || err
        );
        continue;
      }
    }

    // Sort by modifiedTime desc and apply global limit
    allFiles.sort((a, b) => (b.modifiedAt || "").localeCompare(a.modifiedAt || ""));
    const out = limit > 0 ? allFiles.slice(0, limit) : allFiles;

    res.json({ files: out });
  } catch (err) {
    console.error("listFiles error:", err);
    res.status(500).json({ message: "Failed to list files" });
  }
};

// DB-backed listing: return only files persisted by this app for the current user
const getFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Number(req.query.limit || 0);
    const files = await prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit > 0 ? limit : undefined,
      select: {
        driveFileId: true,
        name: true,
        mime: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    const out = files.map((f) => ({
      id: f.driveFileId,
      name: f.name,
      mime: f.mime,
      size: Number(f.sizeBytes || 0),
      modifiedAt: f.createdAt,
    }));
    res.json({ files: out });
    return;
  } catch (err) {
    console.error("getFiles error:", err);
    // If DB isn't migrated yet or File model is missing, fall back to Drive-based listing
    try {
      console.warn("getFiles falling back to Drive listing due to DB error");
      return await listFiles(req, res);
    } catch (driveErr) {
      console.error("Fallback drive list also failed:", driveErr);
      res.status(500).json({ message: "Failed to get files" });
    }
  }
};

const downloadFile = async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: "Missing file id" });

  try {
    const userId = req.user.id;

    // Ensure the file exists in our DB and belongs to the user
    const fileRec = await prisma.file.findUnique({ where: { driveFileId: id } });
    if (!fileRec || fileRec.userId !== userId) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

    // Try the drive account we stored for the file first
    if (fileRec.driveAccountId) {
      const acc = await prisma.driveAccount.findUnique({ where: { id: fileRec.driveAccountId } });
      if (acc && acc.refreshToken) {
        try {
          const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          auth.setCredentials({ refresh_token: acc.refreshToken });
          const accessResp = await auth.getAccessToken();
          const access_token = accessResp && typeof accessResp === "object" ? accessResp.token : accessResp;
          if (access_token) {
            auth.setCredentials({ access_token });
            const drive = google.drive({ version: 'v3', auth });
            const meta = await drive.files.get({ fileId: id, fields: 'id,name,mimeType,size' });
            res.setHeader('Content-Type', meta.data.mimeType || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${meta.data.name || id}"`);
            const streamResp = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
            streamResp.data.pipe(res);
            return;
          }
        } catch (err) {
          console.warn('downloadFile via stored account failed, falling back:', err && err.message);
        }
      }
    }

    // Fallback: try any connected account of the user
    const accounts = await prisma.driveAccount.findMany({ where: { userId } });
    for (const account of accounts) {
      try {
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: account.refreshToken });
        const accessResp = await auth.getAccessToken();
        const access_token =
          accessResp && typeof accessResp === "object"
            ? accessResp.token
            : accessResp;
        if (!access_token) continue;
        auth.setCredentials({ access_token });
        const drive = google.drive({ version: "v3", auth });

        const meta = await drive.files.get({ fileId: id, fields: 'id,name,mimeType,size' });
        res.setHeader('Content-Type', meta.data.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${meta.data.name || id}"`);
        const streamResp = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
        streamResp.data.pipe(res);
        return;
      } catch (err) {
        console.warn('downloadFile try next account for id', id, 'error:', err.message || err);
        continue;
      }
    }

    res.status(404).json({ message: 'File not found in connected accounts' });
  } catch (err) {
    console.error("downloadFile error:", err);
    res.status(500).json({ message: "Failed to download file" });
  }
};

const debugRecentUploads = async (req, res) => {
  try {
    const userId = req.user.id;
    const userUploads = recentUploads.filter((u) => u.userId === userId);
    res.json({ uploads: userUploads });
  } catch (err) {
    console.error("debugRecentUploads error:", err);
    res.status(500).json({ message: "Failed to read recent uploads" });
  }
};

module.exports = {
  getAuthUrl,
  oauthCallback,
  getAccounts,
  disconnectAccount,
  uploadFiles,
  listFiles,
  getFiles,
  downloadFile,
  debugRecentUploads,
};
