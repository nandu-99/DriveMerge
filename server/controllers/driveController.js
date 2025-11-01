const { PrismaClient } = require("@prisma/client");
const { getDriveClient } = require("../utils/googleDrive");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const prisma = new PrismaClient();
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/auth/callback`,
);
const upload = multer({ storage: multer.memoryStorage() });
const progressMap = new Map();

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
          },
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
              b.totalSpaceGb - b.usedSpaceGb - (a.totalSpaceGb - a.usedSpaceGb),
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
                err.message,
              );
            },
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
      process.env.GOOGLE_CLIENT_SECRET,
    );

    auth.setCredentials({ refresh_token: account.refreshToken });

    const { credentials } = await auth.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("No access token after refresh");
    }

    auth.setCredentials(credentials);
    const drive = google.drive({ version: "v3", auth });

    const fileSize = file.size;
    let uploaded = 0;

    const media = {
      mimeType: file.mimetype,
      body: require("stream").Readable.from(file.buffer, {
        objectMode: false,
        read() {
          const chunk = file.buffer.slice(uploaded, uploaded + 1024 * 64);
          uploaded += chunk.length;
          this.push(chunk);

          const progress = Math.min(
            100,
            Math.round((uploaded / fileSize) * 100),
          );

          const entry = progressMap.get(uploadId);
          if (entry?.res) {
            entry.res.write(`data: ${JSON.stringify({ progress })}\n\n`);
          }

          if (uploaded >= fileSize) {
            this.push(null);
          }
        },
      }),
    };

    const response = await drive.files.create({
      requestBody: { name: file.originalname },
      media,
      fields: "id",
    });

    // Send 100%
    const entry = progressMap.get(uploadId);
    if (entry?.res) {
      entry.res.write(`data: ${JSON.stringify({ progress: 100 })}\n\n`);
      entry.res.end();
    }

    // Update DB
    const fileSizeGb = file.size / 1024 ** 3;
    await prisma.driveAccount.update({
      where: { userId_email: { userId, email: account.email } },
      data: { usedSpaceGb: { increment: fileSizeGb } },
    });

    progressMap.delete(uploadId);
  } catch (err) {
    if (err.response?.data)
      console.error("Google API error:", err.response.data);

    const entry = progressMap.get(uploadId);
    if (entry?.res) {
      entry.res.write(
        `data: ${JSON.stringify({ progress: 0, error: "Upload failed" })}\n\n`,
      );
      entry.res.end();
    }
    progressMap.delete(uploadId);
  }
};

module.exports = {
  getAuthUrl,
  oauthCallback,
  getAccounts,
  disconnectAccount,
  uploadFiles,
};
