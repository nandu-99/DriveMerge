const { PrismaClient } = require("@prisma/client");
const { generatePreviewToken } = require("../utils/jwt");
const { getDriveClient } = require("../utils/googleDrive");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const multer = require("multer");
const os = require("os");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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

      // optional account override from client (body or query)
      const preferredAccountId = req.body?.driveAccountId || req.query?.driveAccountId;

      for (const file of req.files) {
        // compute file hash for duplicate detection
        let fileHash = null;
        if (file.path) {
          fileHash = await new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const rs = fs.createReadStream(file.path);
            rs.on('data', (chunk) => hash.update(chunk));
            rs.on('end', () => resolve(hash.digest('hex')));
            rs.on('error', reject);
          });
        }

        const uploadId = uuidv4();

        // duplicate detection: if file with same hash and size exists for this user
        if (fileHash) {
          const existing = await prisma.file.findFirst({
            where: { userId, fileHash, sizeBytes: BigInt(file.size) },
          });
          if (existing) {
            // record a TransferJob as already succeeded (deduped)
            await prisma.transferJob.create({
              data: {
                uploadId,
                userId,
                fileName: file.originalname,
                status: 'succeeded',
                totalBytes: BigInt(file.size),
                transferredBytes: BigInt(file.size),
                driveFileId: existing.driveFileId,
              },
            });
            tasks.push({ id: uploadId, fileName: file.originalname, duplicate: true, existingFileId: existing.driveFileId });
            continue; // skip actual upload
          }
        }

        // choose account: prefer override if provided and valid
        let suitableAccount = null;
        if (preferredAccountId) {
          suitableAccount = accounts.find(a => String(a.id) === String(preferredAccountId));
          if (!suitableAccount) return res.status(400).json({ message: 'Preferred account not found or not owned by user' });
        }

        if (!suitableAccount) {
          const fileSizeGb = file.size / 1024 ** 3;
          suitableAccount = accounts
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
        }

        tasks.push({ id: uploadId, fileName: file.originalname });
        progressMap.set(uploadId, { progress: 0, res: null });

        // create TransferJob record as pending
        await prisma.transferJob.create({
          data: {
            uploadId,
            userId,
            fileName: file.originalname,
            status: 'pending',
            totalBytes: BigInt(file.size),
            sourceAccountId: null,
            destAccountId: suitableAccount.id,
          },
        });

        // attach fileHash to request file for later persistence
        file._fileHash = fileHash;

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

// Ensure thumbnail cache directory exists (legacy cleanup or just no-op)
// We rely on Cloudinary now.
const THUMB_DIR = path.join(process.cwd(), "tmp", "thumbnails");
try {
  if (fs.existsSync(THUMB_DIR)) {
    // Optional: clean it up if you want, or just ignore it
  }
} catch (e) {
  // ignore
}


function svgPlaceholder(name, width = 400, height = 300) {
  const safe = String(name || "").replace(/</g, "&lt;").slice(0, 40);
  return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>
      <rect width='100%' height='100%' fill='#f3f4f6' />
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-family='Arial,Helvetica,sans-serif' font-size='18'>${safe}</text>
    </svg>`;
}

// GET /drive/files/thumbnail?id=...&size=200
const getThumbnail = async (req, res) => {
  const { id, size = 400, preview_token: previewToken } = req.query;
  if (!id) return res.status(400).json({ message: "Missing file id" });

  try {
    // auth logic: accept normal req.user or preview token
    let userId = null;
    let tokenPayload = null;
    if (req.user && req.user.id) {
      userId = req.user.id;
    } else if (previewToken) {
      try {
        tokenPayload = require("../utils/jwt").verifyToken(previewToken);
        if (tokenPayload && tokenPayload.id) userId = tokenPayload.id;
      } catch (e) {
        // ignore
      }
    }
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const fileRec = await prisma.file.findUnique({ where: { driveFileId: id } });
    if (!fileRec || fileRec.userId !== userId) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

    // If preview token present, validate binding
    if (tokenPayload && tokenPayload.t === "preview") {
      if (tokenPayload.fileId !== id || tokenPayload.id !== userId) {
        return res.status(401).json({ message: "Invalid preview token for this file" });
      }
    }

    const publicId = `drive_thumbnails/${id}`;

    // Check if thumbnail exists in Cloudinary
    try {
      await cloudinary.api.resource(publicId);
      // If we are here, it exists. Redirect to it with transformations.
      // Cloudinary transformations: fill to size
      const url = cloudinary.url(publicId, {
        width: size,
        crop: "fill",
        format: "jpg",
        secure: true
      });
      return res.redirect(url);
    } catch (error) {
      // If 404, we need to upload. If 420 (Rate Limited), we might fail or try upload?
      // We'll proceed to try to generate it.
      if (error && error.http_code !== 404) {
        console.warn("Cloudinary check error", error.message);
      }
    }

    // Fetch file metadata and stream from Drive
    const accounts = await prisma.driveAccount.findMany({ where: { userId } });

    // Attempt to download and upload to Cloudinary
    for (const account of accounts) {
      try {
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: account.refreshToken });
        const accessResp = await auth.getAccessToken();
        const a_token = accessResp && typeof accessResp === "object" ? accessResp.token : accessResp;
        if (!a_token) continue;
        auth.setCredentials({ access_token: a_token });
        const drive = google.drive({ version: "v3", auth });

        const meta = await drive.files.get({ fileId: id, fields: "id,name,mimeType,size" });
        const mime = meta.data.mimeType || "application/octet-stream";

        if (!mime.startsWith("image/")) {
          // Not an image — return an SVG placeholder
          const svg = svgPlaceholder(meta.data.name || id, size, Math.round(size * 0.75));
          res.setHeader("Content-Type", "image/svg+xml");
          res.send(svg);
          return;
        }

        // Stream file from Drive
        const streamResp = await drive.files.get({ fileId: id, alt: "media" }, { responseType: "stream" });

        // Pipe to Cloudinary
        // We upload the full image to Cloudinary (as efficient as possible) 
        // and let Cloudinary handle resizing on delivery.
        await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              public_id: publicId,
              overwrite: true,
              resource_type: "image",
              folder: "drive_thumbnails" // Optional, public_id includes it
            },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
          streamResp.data.pipe(uploadStream);
          streamResp.data.on('error', reject);
        });

        // Redirect to new thumbnail
        const url = cloudinary.url(publicId, {
          width: size,
          crop: "fill",
          format: "jpg",
          secure: true
        });
        return res.redirect(url);

      } catch (err) {
        console.warn("getThumbnail: account attempt failed", account.email, err.message);
        continue;
      }
    }

    // Fallback if all accounts failed or not image
    const svg = svgPlaceholder(id, size, Math.round(size * 0.75));
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
  } catch (err) {
    console.error("getThumbnail error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to generate thumbnail" });
  }
};


// No periodic cleanup needed for Cloudinary (managed service)
// We can keep this empty block to maintain structure if needed or just remove it.


const uploadToDrive = async (uploadId, file, account, userId) => {
  try {
    if (!account.refreshToken) {
      throw new Error("Missing refresh token");
    }

    // mark TransferJob as in_progress
    try {
      await prisma.transferJob.update({ where: { uploadId }, data: { status: 'in_progress' } });
    } catch (e) {
      // ignore if no job found
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

      // update transferredBytes in DB (best-effort, non-blocking)
      try {
        prisma.transferJob.update({ where: { uploadId }, data: { transferredBytes: BigInt(uploaded) } }).catch(() => { });
      } catch (e) { }
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
            fileHash: file._fileHash ?? null,
          },
        });
      } catch (dbErr) {
        console.warn("Failed to persist file metadata:", dbErr && dbErr.message);
      }

      // mark TransferJob succeeded
      try {
        await prisma.transferJob.update({ where: { uploadId }, data: { status: 'succeeded', driveFileId } });
      } catch (e) { }
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
          thumbnailUrl: `/drive/files/thumbnail?id=${encodeURIComponent(f.id)}&size=240`,
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
      thumbnailUrl: `/drive/files/thumbnail?id=${encodeURIComponent(f.driveFileId)}&size=240`,
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
  const { id, preview, access_token: accessTokenQuery } = req.query;
  if (!id) return res.status(400).json({ message: "Missing file id" });

  try {
    // Determine authenticated user either from middleware (Authorization header)
    // or from optional token passed in query (used for preview streaming URLs).
    let userId = null;
    let tokenPayload = null;
    if (req.user && req.user.id) {
      userId = req.user.id;
    } else if (accessTokenQuery || req.query?.preview_token) {
      const tokenToVerify = req.query?.preview_token || accessTokenQuery;
      try {
        tokenPayload = require("../utils/jwt").verifyToken(tokenToVerify);
        if (tokenPayload && tokenPayload.id) userId = tokenPayload.id;
      } catch (e) {
        // ignore
      }
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Ensure the file exists in our DB and belongs to the user
    const fileRec = await prisma.file.findUnique({ where: { driveFileId: id } });
    if (!fileRec || fileRec.userId !== userId) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

    // If tokenPayload exists and is a preview token, ensure it's bound to this file
    if (tokenPayload && tokenPayload.t === "preview") {
      if (tokenPayload.fileId !== id || tokenPayload.id !== userId) {
        return res.status(401).json({ message: "Invalid preview token for this file" });
      }
    }

    // Helper to stream from a Drive account with optional Range support
    const tryStreamFromAccount = async (acc) => {
      if (!acc || !acc.refreshToken) return false;
      try {
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: acc.refreshToken });
        const accessResp = await auth.getAccessToken();
        const latest_access = accessResp && typeof accessResp === "object" ? accessResp.token : accessResp;
        if (!latest_access) return false;
        auth.setCredentials({ access_token: latest_access });
        const drive = google.drive({ version: 'v3', auth });

        const meta = await drive.files.get({ fileId: id, fields: 'id,name,mimeType,size' });
        const size = Number(meta.data.size || 0);
        const mime = meta.data.mimeType || 'application/octet-stream';

        const rangeHeader = req.headers.range;
        const inline = preview === '1' || preview === 'true';

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', mime);
        if (inline) {
          res.setHeader('Content-Disposition', `inline; filename="${meta.data.name || id}"`);
        } else {
          res.setHeader('Content-Disposition', `attachment; filename="${meta.data.name || id}"`);
        }

        if (rangeHeader) {
          // parse range, e.g., 'bytes=0-1023'
          const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
          if (m) {
            const start = m[1] ? parseInt(m[1], 10) : 0;
            const end = m[2] ? parseInt(m[2], 10) : size - 1;
            const clampedEnd = Math.min(end, size - 1);
            const chunkSize = clampedEnd - start + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${clampedEnd}/${size}`);
            res.setHeader('Content-Length', String(chunkSize));

            const streamResp = await drive.files.get(
              { fileId: id, alt: 'media' },
              { responseType: 'stream', headers: { Range: `bytes=${start}-${clampedEnd}` } }
            );
            streamResp.data.pipe(res);
            return true;
          }
        }

        // No range requested — stream whole file
        res.setHeader('Content-Length', String(size));
        const streamResp = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
        streamResp.data.pipe(res);
        return true;
      } catch (err) {
        console.warn('tryStreamFromAccount failed for', acc.email, err && err.message);
        return false;
      }
    };

    // Try stored account first
    if (fileRec.driveAccountId) {
      const acc = await prisma.driveAccount.findUnique({ where: { id: fileRec.driveAccountId } });
      if (acc) {
        const ok = await tryStreamFromAccount(acc);
        if (ok) return;
      }
    }

    // Fallback: loop connected accounts
    const accounts = await prisma.driveAccount.findMany({ where: { userId } });
    for (const account of accounts) {
      const ok = await tryStreamFromAccount(account);
      if (ok) return;
    }

    res.status(404).json({ message: 'File not found in connected accounts' });
  } catch (err) {
    console.error("downloadFile error:", err);
    // If headers already sent, can't send JSON
    if (!res.headersSent) res.status(500).json({ message: "Failed to download file" });
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

// GET /drive/transfers
const getTransfers = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Number(req.query.limit || 100);
    const jobs = await prisma.transferJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const out = jobs.map(j => ({
      uploadId: j.uploadId,
      fileName: j.fileName,
      status: j.status,
      totalBytes: j.totalBytes ? Number(j.totalBytes) : null,
      transferredBytes: j.transferredBytes ? Number(j.transferredBytes) : null,
      driveFileId: j.driveFileId || null,
      errorMessage: j.errorMessage || null,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }));
    res.json({ jobs: out });
  } catch (err) {
    console.error('getTransfers error', err);
    res.status(500).json({ message: 'Failed to get transfers' });
  }
};

// SSE: subscribe to upload progress for a given uploadId
const subscribeUploadProgress = async (req, res) => {
  const { uploadId } = req.params;
  if (!uploadId) return res.status(400).json({ message: 'Missing uploadId' });

  // setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  let entry = progressMap.get(uploadId);
  if (!entry) {
    entry = { progress: 0, res: null };
    progressMap.set(uploadId, entry);
  }

  entry.res = res;

  // send initial event
  res.write(`data: ${JSON.stringify({ progress: entry.progress })}\n\n`);

  req.on('close', () => {
    if (entry && entry.res === res) entry.res = null;
  });
};

// Generate a short-lived preview token for a file owned by the user.
const createPreviewToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const fileId = req.body?.fileId || req.query?.fileId;
    if (!fileId) return res.status(400).json({ message: "Missing fileId" });

    const fileRec = await prisma.file.findUnique({ where: { driveFileId: fileId } });
    if (!fileRec || fileRec.userId !== userId) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

    // generate preview token bound to fileId
    const token = generatePreviewToken({ id: userId, email: req.user.email || "" }, fileId);
    res.json({ previewToken: token, expiresInSeconds: 60 });
  } catch (err) {
    console.error("createPreviewToken error:", err);
    res.status(500).json({ message: "Failed to create preview token" });
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
  getThumbnail,
  createPreviewToken,
  subscribeUploadProgress,
  getTransfers,
};

