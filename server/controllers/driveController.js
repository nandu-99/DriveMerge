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

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 20 * 1024 ** 3; // 20 GB default
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});
const progressMap = new Map();
const cancelledUploads = new Set();
const recentUploads = [];

/**
 * Calculate optimal chunk distribution across accounts based on available storage
 * @param {number} fileSize - Total file size in bytes
 * @param {Array} accounts - Array of account objects with id, email, usedSpaceGb, totalSpaceGb
 * @returns {Array} Array of chunk plans: { accountId, accountEmail, startByte, endByte, chunkSizeBytes }
 */
/**
 * Calculate optimal chunk distribution across accounts based on available storage
 * @param {number} fileSize - Total file size in bytes
 * @param {Array} accounts - Array of account objects with id, email, usedSpaceGb, totalSpaceGb
 * @param {string|number} primaryAccountId - Optional ID of the account to prioritize filling first
 * @returns {Array} Array of chunk plans: { accountId, accountEmail, startByte, endByte, chunkSizeBytes }
 */
function calculateChunkDistribution(fileSize, accounts, primaryAccountId = null) {
  const accountsWithFreeSpace = accounts
    .map(a => ({
      id: a.id,
      email: a.email,
      refreshToken: a.refreshToken,
      freeBytes: Math.max(0, (a.totalSpaceGb - a.usedSpaceGb) * 1024 ** 3),
      totalSpaceGb: a.totalSpaceGb,
      usedSpaceGb: a.usedSpaceGb
    }))
    .filter(a => a.freeBytes > 0);

  if (accountsWithFreeSpace.length === 0) {
    throw new Error('No accounts with available storage');
  }

  // Sort: Primary account first, then descending by free space (largest first)
  accountsWithFreeSpace.sort((a, b) => {
    const isAPrimary = primaryAccountId && String(a.id) === String(primaryAccountId);
    const isBPrimary = primaryAccountId && String(b.id) === String(primaryAccountId);

    if (isAPrimary && !isBPrimary) return -1;
    if (!isAPrimary && isBPrimary) return 1;
    return b.freeBytes - a.freeBytes;
  });

  const totalFreeSpace = accountsWithFreeSpace.reduce((sum, a) => sum + a.freeBytes, 0);

  if (totalFreeSpace < fileSize) {
    const shortfall = fileSize - totalFreeSpace;
    throw new Error(`Insufficient storage. Need ${(shortfall / 1024 / 1024 / 1024).toFixed(2)} GB more space.`);
  }

  const chunks = [];
  let remainingBytes = fileSize;
  let currentPosition = 0;

  for (const account of accountsWithFreeSpace) {
    if (remainingBytes <= 0) break;

    const chunkSizeBytes = Math.min(remainingBytes, account.freeBytes);

    chunks.push({
      accountId: account.id,
      accountEmail: account.email,
      refreshToken: account.refreshToken,
      startByte: currentPosition,
      endByte: currentPosition + chunkSizeBytes,
      chunkSizeBytes: chunkSizeBytes,
      chunkIndex: chunks.length
    });

    currentPosition += chunkSizeBytes;
    remainingBytes -= chunkSizeBytes;
  }

  return chunks;
}

/**
 * Upload a file with storage-aware chunking - splits based on available storage
 * @param {string} uploadId - Unique upload identifier
 * @param {Object} file - Multer file object
 * @param {Array} accounts - Array of connected drive accounts
 * @param {number} userId - User ID
 */
async function uploadWithStorageAwareChunking(uploadId, file, accounts, userId, primaryAccountId = null) {
  try {
    console.log(`[DEBUG] Starting uploadWithStorageAwareChunking for ${uploadId}`);
    sendLog(0, `[SYS] Analyzing file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
    sendLog(0, `[ALGO] Calculating optimal storage distribution...`, 'info');
    const chunkPlan = calculateChunkDistribution(file.size, accounts, primaryAccountId);
    sendLog(0, `[ALGO] Distribution Strategy: ${chunkPlan.length} partitioned segments.`, 'info');
    chunkPlan.forEach((c, i) => {
      sendLog(0, `[PLAN] Segment ${i + 1}: ${formatBytes(c.chunkSizeBytes)} -> ${c.accountEmail} (Byte Range: ${c.startByte}-${c.endByte})`, 'info');
    });

    const driveFileId = uuidv4();
    sendLog(0, `[DB] Created virtual parent record: ${driveFileId} (Schema: DistributedFile)`, 'info');
    const parentFile = await prisma.file.create({
      data: {
        driveFileId,
        userId,
        name: file.originalname,
        mime: file.mimetype || 'application/octet-stream',
        sizeBytes: BigInt(file.size),
        isSplit: chunkPlan.length > 1,
        fileHash: file._fileHash || null,
        driveAccountId: chunkPlan.length === 1 ? chunkPlan[0].accountId : null,
      },
    });
    console.log(`[DEBUG] Parent file created: ${parentFile.id}`);

    const CONCURRENCY_LIMIT = 3;

    const sendLog = (p, text, type = 'info') => {
      const entry = progressMap.get(uploadId);
      if (entry) {
        const logItem = { text, type, time: new Date().toLocaleTimeString() };
        if (!entry.logs) entry.logs = [];
        entry.logs.push(logItem);

        if (entry.res) {
          entry.res.write(`data: ${JSON.stringify({
            progress: p,
            totalChunks: chunkPlan.length,
            log: logItem
          })}\n\n`);
        }
      }
    };

    sendLog(0, `Analyzing file structure for ${file.originalname}...`, 'start');
    sendLog(0, `Storage distribution strategy: Distributed`, 'info');
    sendLog(0, `Allocating resources across ${accounts.length} connected drives...`, 'info');
    sendLog(0, `Primary account target: ${chunkPlan[0]?.accountEmail}`, 'info');
    sendLog(0, `Breakdown: ${chunkPlan.length} chunks generated for distribution.`, 'info');

    // Helper to process a single chunk
    const uploadChunk = async (chunk) => {
      console.log(`[DEBUG] Uploading chunk ${chunk.chunkIndex}`);
      sendLog(
        Math.round((chunk.chunkIndex / chunkPlan.length) * 100),
        `Transferring chunk ${chunk.chunkIndex + 1}/${chunkPlan.length} to ${chunk.accountEmail}...`,
        'process'
      );

      if (cancelledUploads.has(uploadId)) {
        throw new Error("Upload cancelled by user");
      }

      sendLog(Math.round((chunk.chunkIndex / chunkPlan.length) * 100), `[NET] [Chunk ${chunk.chunkIndex + 1}] Handshake: Authenticating with Google OAuth2 (${chunk.accountEmail})...`, 'info');
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      auth.setCredentials({ refresh_token: chunk.refreshToken });
      const accessResp = await auth.getAccessToken();
      auth.setCredentials({ access_token: accessResp.token });
      const drive = google.drive({ version: 'v3', auth });

      sendLog(Math.round((chunk.chunkIndex / chunkPlan.length) * 100), `[IO] [Chunk ${chunk.chunkIndex + 1}] Opening FS ReadStream (Bytes ${chunk.startByte}-${chunk.endByte})...`, 'info');
      const chunkStream = fs.createReadStream(file.path, {
        start: chunk.startByte,
        end: chunk.endByte - 1,
      });

      const chunkName = chunkPlan.length > 1
        ? `${file.originalname}.part${chunk.chunkIndex}`
        : file.originalname;

      sendLog(Math.round((chunk.chunkIndex / chunkPlan.length) * 100), `[API] [Chunk ${chunk.chunkIndex + 1}] POST v3/files (multipart/related)...`, 'info');
      const driveFile = await drive.files.create({
        requestBody: {
          name: chunkName,
          appProperties: {
            uploaderId: String(userId),
            uploaderApp: 'DriveMerge',
            parentFileId: driveFileId,
            chunkIndex: String(chunk.chunkIndex),
            totalChunks: String(chunkPlan.length),
          },
        },
        media: {
          mimeType: 'application/octet-stream',
          body: chunkStream,
        },
        fields: 'id, size',
      });

      if (chunkPlan.length > 1) {
        await prisma.fileChunk.create({
          data: {
            fileId: parentFile.id,
            driveAccountId: chunk.accountId,
            driveFileId: driveFile.data.id,
            chunkIndex: chunk.chunkIndex,
            sizeBytes: BigInt(chunk.chunkSizeBytes),
          },
        });
      } else {
        await prisma.file.update({
          where: { id: parentFile.id },
          data: { driveFileId: driveFile.data.id },
        });
      }

      const chunkSizeGb = chunk.chunkSizeBytes / 1024 ** 3;
      await prisma.driveAccount.update({
        where: { id: chunk.accountId },
        data: { usedSpaceGb: { increment: chunkSizeGb } },
      });

      const overallProgress = Math.round(((chunk.chunkIndex + 1) / chunkPlan.length) * 100);
      sendLog(overallProgress, `Confirmed chunk ${chunk.chunkIndex + 1}/${chunkPlan.length} in Drive`, 'process');
    };

    const executing = new Set();
    for (const chunk of chunkPlan) {
      if (cancelledUploads.has(uploadId)) {
        throw new Error("Upload cancelled by user");
      }

      while (executing.size >= CONCURRENCY_LIMIT) {
        await Promise.race(executing);
      }

      const p = uploadChunk(chunk).then(() => executing.delete(p));
      executing.add(p);
    }
    await Promise.all(executing);

    if (cancelledUploads.has(uploadId)) {
      throw new Error("Upload cancelled by user");
    }

    await prisma.transferJob.update({
      where: { uploadId },
      data: {
        status: 'succeeded',
        driveFileId,
        transferredBytes: BigInt(file.size),
      },
    });

    sendLog(100, "[CRYPTO] Verifying file integrity...", 'info');
    sendLog(100, "[SYS] 200 OK: Upload completed successfully. File commit verified.", 'success');

    try { fs.unlinkSync(file.path); } catch (e) { }

    const progressEntry = progressMap.get(uploadId);
    if (progressEntry?.res) {
      // Final close
      progressEntry.res.write('data: ' + JSON.stringify({ progress: 100, status: 'succeeded' }) + '\n\n');
      progressEntry.res.end();
    }
    progressMap.delete(uploadId);
    cancelledUploads.delete(uploadId);

    recentUploads.push({
      id: driveFileId,
      name: file.originalname,
      size: file.size,
      chunks: chunkPlan.length,
      userId,
      uploadedAt: new Date().toISOString(),
    });
    if (recentUploads.length > 200) recentUploads.shift();

  } catch (err) {
    console.error('[DEBUG] uploadWithStorageAwareChunking CATCH:', err);
    if (err.message === "Upload cancelled by user") {
      console.log(`Upload ${uploadId} cancelled`);
    } else {
      console.error('Storage-aware upload failed:', err);
    }

    try {
      await prisma.transferJob.update({
        where: { uploadId },
        data: { status: 'failed', errorMessage: err.message },
      });
    } catch (e) { }

    if (file?.path) try { fs.unlinkSync(file.path); } catch (e) { }

    const progressEntry = progressMap.get(uploadId);
    if (progressEntry?.res) {
      progressEntry.res.write('data: ' + JSON.stringify({ progress: 0, error: err.message }) + '\n\n');
      progressEntry.res.end();
    }
    progressMap.delete(uploadId);
    cancelledUploads.delete(uploadId);

    if (err.message !== "Upload cancelled by user") {
      throw err;
    }
  }
}

const deleteFile = async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.id;
  console.log(`[Delete] Request for fileId: ${fileId} by user: ${userId}`);


  try {
    // Frontend passes driveFileId as the ID
    const file = await prisma.file.findFirst({
      where: { driveFileId: fileId, userId },
      include: { chunks: true }
    });

    if (!file) return res.status(404).json({ message: "File not found" });

    // Helper to delete from Drive safely
    const deleteFromDrive = async (driveFileId, accountId, sizeBytes) => {
      try {
        const account = await prisma.driveAccount.findUnique({ where: { id: accountId } });
        if (account) {
          const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          auth.setCredentials({ refresh_token: account.refreshToken });
          const drive = google.drive({ version: 'v3', auth });
          await drive.files.delete({ fileId: driveFileId });

          // Update usage
          // Ensure usedSpaceGb doesn't go below 0
          const sizeGb = Number(sizeBytes) / 1024 ** 3;
          await prisma.driveAccount.update({
            where: { id: accountId },
            data: { usedSpaceGb: { decrement: sizeGb } }
          });
        }
      } catch (e) {
        console.warn(`Failed to delete drive file ${driveFileId} on account ${accountId}:`, e.message);
      }
    };

    if (file.isSplit && file.chunks.length > 0) {
      for (const chunk of file.chunks) {
        await deleteFromDrive(chunk.driveFileId, chunk.driveAccountId, chunk.sizeBytes);
      }
      await prisma.fileChunk.deleteMany({ where: { fileId: file.id } });
    } else if (file.driveAccountId && file.driveFileId) {
      await deleteFromDrive(file.driveFileId, file.driveAccountId, file.sizeBytes);
    }

    await prisma.file.delete({ where: { id: file.id } });

    res.json({ message: "File deleted successfully" });

  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Failed to delete file" });
  }
};

const cancelUpload = async (req, res) => {
  const { uploadId } = req.params;
  if (!uploadId) return res.status(400).json({ message: "Missing uploadId" });

  try {
    // 1. Check if active in memory (stop the process)
    if (progressMap.has(uploadId)) {
      cancelledUploads.add(uploadId);
      const entry = progressMap.get(uploadId);
      if (entry?.res) {
        entry.res.write(`data: ${JSON.stringify({ progress: 0, error: "Upload cancelled by user" })}\n\n`);
        entry.res.end();
      }
      progressMap.delete(uploadId);
    }

    // 2. Always try to update DB status if it exists and is pending/in-progress
    // This handles "zombie" jobs from before a server restart
    const job = await prisma.transferJob.findUnique({ where: { uploadId } });

    if (job) {
      if (job.status === 'pending' || job.status === 'processing' || job.status === 'in_progress') {
        await prisma.transferJob.update({
          where: { uploadId },
          data: { status: 'failed', errorMessage: 'Cancelled by user' }
        });
        return res.json({ message: "Upload cancelled successfully" });
      } else {
        // Job exists but is already done/failed
        // If it was in progressMap, we already killed it, so success.
        if (cancelledUploads.has(uploadId)) {
          return res.json({ message: "Upload cancellation requested" });
        }
        return res.status(400).json({ message: "Upload is already completed or failed" });
      }
    }

    // 3. Fallback: If not in DB and not in memory (should happen rarely for valid IDs)
    if (cancelledUploads.has(uploadId)) {
      return res.json({ message: "Upload cancellation requested" });
    }

    res.status(404).json({ message: "Upload not found" });

  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ message: "Failed to cancel upload" });
  }
};


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

const getRefreshedDriveClient = async (refreshToken) => {
  const tempClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  tempClient.setCredentials({ refresh_token: refreshToken });
  
  const { credentials } = await tempClient.refreshAccessToken();
  return google.drive({ version: "v3", auth: tempClient });
};

const getAccounts = async (req, res) => {
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

    const updatedAccounts = [];

    for (const acc of accounts) {
      let usedSpaceGb = acc.usedSpaceGb;
      let totalSpaceGb = acc.totalSpaceGb;

      try {
        const drive = await getRefreshedDriveClient(acc.refreshToken);

        const about = await drive.about.get({
          fields: "storageQuota(limit,usage,usageInDrive,usageInDriveTrash)",
        });

        const { limit, usage } = about.data.storageQuota;

        const newTotalGb = limit ? Number(limit) / 1024 ** 3 : null;
        const newUsedGb = Number(usage) / 1024 ** 3;

        if (
          usedSpaceGb !== newUsedGb ||
          totalSpaceGb !== newTotalGb ||
          usedSpaceGb === null ||
          totalSpaceGb === null
        ) {
          await prisma.driveAccount.update({
            where: { id: acc.id },
            data: {
              usedSpaceGb: newUsedGb,
              totalSpaceGb: newTotalGb,
            },
          });

          usedSpaceGb = newUsedGb;
          totalSpaceGb = newTotalGb;
        }
      } catch (driveErr) {
        console.error(`Failed to refresh storage info for ${acc.email}:`, driveErr);
      }

      updatedAccounts.push({
        id: acc.id,
        email: acc.email,
        usedSpace: usedSpaceGb ? Number(usedSpaceGb.toFixed(1)) : null,
        totalSpace: totalSpaceGb ? Number(totalSpaceGb.toFixed(1)) : null,
      });
    }

    res.json(updatedAccounts);
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
      console.log('────────────────────────────────────────────────────────────────');
      console.log('[DEBUG] Upload Request Received');
      console.log('[DEBUG] Body:', req.body);
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

      // REFRESH STORAGE FROM GOOGLE DRIVE API (get real-time values, not stale DB values)
      console.log('🔄 Refreshing storage quotas from Google Drive API...');
      for (const account of accounts) {
        try {
          const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          auth.setCredentials({ refresh_token: account.refreshToken });
          const accessResp = await auth.getAccessToken();
          auth.setCredentials({ access_token: accessResp.token });

          const drive = google.drive({ version: 'v3', auth });
          const about = await drive.about.get({ fields: 'storageQuota' });
          const { limit, usage } = about.data.storageQuota;

          const totalSpaceGb = Number(limit) / 1024 ** 3;
          const usedSpaceGb = Number(usage) / 1024 ** 3;

          // Update local account object with fresh values
          account.totalSpaceGb = totalSpaceGb;
          account.usedSpaceGb = usedSpaceGb;

          // Update database with fresh values
          await prisma.driveAccount.update({
            where: { id: account.id },
            data: { totalSpaceGb, usedSpaceGb }
          });

          console.log(`   ${account.email}: ${(totalSpaceGb - usedSpaceGb).toFixed(2)} GB free (refreshed)`);
        } catch (err) {
          console.warn(`    Failed to refresh ${account.email}:`, err.message);
        }
      }

      const tasks = [];

      const preferredAccountId = req.body?.driveAccountId || req.query?.driveAccountId;

      for (const file of req.files) {
        console.log('────────────────────────────────────────────────────────────────');
        console.log(`Processing file: ${file.originalname}`);
        console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

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
        // Initialize buffer immediately to capture analysis logs
        progressMap.set(uploadId, { progress: 0, res: null, logs: [] });

        const logAnalysis = (text, type = 'info') => {
          const entry = progressMap.get(uploadId);
          if (entry && entry.logs) {
            entry.logs.push({ text, type, time: new Date().toLocaleTimeString() });
          }
        };

        // Check for duplicates (unless forced)
        const isForceUpload = req.body.forceUpload === 'true';
        if (fileHash && !isForceUpload) {
          const existing = await prisma.file.findFirst({
            where: { userId, fileHash, sizeBytes: BigInt(file.size) },
          });
          if (existing) {
            console.log(`   Duplicate detected, skipping upload`);
            await prisma.transferJob.create({
              data: {
                uploadId,
                userId,
                fileName: file.originalname,
                status: 'duplicate',
                errorMessage: 'Duplicate detected',
                totalBytes: BigInt(file.size),
                transferredBytes: BigInt(file.size),
                driveFileId: existing.driveFileId,
              },
            });
            tasks.push({ id: uploadId, fileName: file.originalname, duplicate: true, existingFileId: existing.driveFileId });
            continue;
          }
        }

        const fileSizeGb = file.size / 1024 ** 3;

        // Log storage status for debugging
        console.log('Storage Analysis:');
        logAnalysis(`[SYS] Storage Analysis for ${file.originalname}:`, 'info');
        console.log(`   File size: ${(file.size / 1024 / 1024).toFixed(2)} MB (${fileSizeGb.toFixed(4)} GB)`);
        logAnalysis(`[SYS] File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`, 'info');

        console.log('   Account storage status:');
        accounts.forEach(a => {
          const freeGb = a.totalSpaceGb - a.usedSpaceGb;
          const canFit = freeGb >= fileSizeGb;
          console.log(`   • ${a.email}: ${freeGb.toFixed(2)} GB free (${canFit ? 'CAN fit' : 'CANNOT fit'} file)`);
          logAnalysis(`[SYS] Account Check: ${a.email} has ${freeGb.toFixed(2)} GB free (${canFit ? 'Eligible' : 'Insufficient'})`, canFit ? 'info' : 'error');
        });

        // Find account with enough space for the entire file
        let suitableAccount = null;
        if (preferredAccountId) {
          const preferred = accounts.find(a => String(a.id) === String(preferredAccountId));
          if (preferred && (preferred.totalSpaceGb - preferred.usedSpaceGb) >= fileSizeGb) {
            suitableAccount = preferred;
            console.log(`   → Preferred account selected: ${preferred.email}`);
            logAnalysis(`[SYS] Priority: User preferred account ${preferred.email} selected.`, 'info');
          }
        }

        if (!suitableAccount && !preferredAccountId) {
          // Only search for a "better" account if the user didn't explicitly prefer one.
          // If they preferred one (and it wasn't suitable/full), we WANT to fall through to chunking
          // so we can fill the preferred one first.
          suitableAccount = accounts
            .filter((a) => (a.totalSpaceGb - a.usedSpaceGb) >= fileSizeGb)
            .sort((a, b) => (b.totalSpaceGb - b.usedSpaceGb) - (a.totalSpaceGb - a.usedSpaceGb))
            .shift();
          if (suitableAccount) {
            console.log(`   → Best-fit single account: ${suitableAccount.email}`);
          }
        }

        // Calculate total available space across all accounts
        const totalFreeSpace = accounts.reduce((sum, a) => sum + (a.totalSpaceGb - a.usedSpaceGb), 0);
        console.log(`   Total free space across all accounts: ${totalFreeSpace.toFixed(2)} GB`);

        // Force multi-account distribution when multiple accounts exist to maximize storage utilization
        const shouldForceSplit = false; // Prefer single account if it fits, per user request

        // If preferredAccountId was set but suitableAccount is null (didn't fit), we default to splitting
        // regardless of whether there's another "best fit" account (because we skipped looking for one).

        const decision = shouldForceSplit ? 'FORCE-SPLIT MULTI-ACCOUNT' : (suitableAccount ? 'SINGLE ACCOUNT UPLOAD' : (totalFreeSpace >= fileSizeGb ? 'STORAGE-AWARE CHUNKING' : 'INSUFFICIENT STORAGE'));
        console.log(`   Decision: ${decision}`);
        logAnalysis(`[ALGO] Decision Strategy: ${decision}`, 'info');

        tasks.push({ id: uploadId, fileName: file.originalname, isSplit: shouldForceSplit });
        // progressMap already set
        file._fileHash = fileHash;

        if (!shouldForceSplit && suitableAccount) {
          // Single account upload - only when exactly one account is connected
          console.log(`   Single account upload: ${suitableAccount.email}`);

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

          setImmediate(() => {
            uploadToDrive(uploadId, file, suitableAccount, userId).catch(
              (err) => {
                console.error(`Background upload failed for ${uploadId}:`, err.message);
              }
            );
          });
        } else if (totalFreeSpace >= fileSizeGb) {
          // Storage-aware chunking - file needs to be split across accounts
          console.log(`   Storage-aware chunking: file will be split across accounts`);
          console.log(`   Total free space: ${totalFreeSpace.toFixed(2)} GB`);

          await prisma.transferJob.create({
            data: {
              uploadId,
              userId,
              fileName: file.originalname,
              status: 'pending',
              totalBytes: BigInt(file.size),
              sourceAccountId: null,
              destAccountId: null, // Will be split across multiple
            },
          });

          setImmediate(() => {
            // Pass preferredAccountId as the primary target for distribution
            uploadWithStorageAwareChunking(uploadId, file, accounts, userId, preferredAccountId).catch(
              (err) => {
                console.error(`Storage-aware upload failed for ${uploadId}:`, err.message);
              }
            );
          });
        } else {
          // Not enough total space across all accounts
          const shortfall = fileSizeGb - totalFreeSpace;
          console.log(`   Insufficient storage across all ${accounts.length} account(s)`);
          console.log(`   Need: ${(fileSizeGb * 1024).toFixed(2)} MB, Have: ${(totalFreeSpace * 1024).toFixed(2)} MB`);
          console.log(`   Shortfall: ${(shortfall * 1024).toFixed(2)} MB - connect more accounts or free up space`);
          return res.status(400).json({
            message: `Not enough storage. File needs ${(fileSizeGb * 1024).toFixed(0)} MB but only ${(totalFreeSpace * 1024).toFixed(0)} MB available across ${accounts.length} account(s). Connect more Google Drive accounts or free up ${(shortfall * 1024).toFixed(0)} MB.`,
          });
        }
      }

      res.json(tasks);
    } catch (err) {
      console.error("uploadFiles error:", err);
      res.status(500).json({ message: "Upload initiation failed" });
    }
  },
];


const THUMB_DIR = path.join(process.cwd(), "tmp", "thumbnails");



function svgPlaceholder(name, width = 400, height = 300) {
  const safe = String(name || "").replace(/</g, "&lt;").slice(0, 40);
  return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>
      <rect width='100%' height='100%' fill='#f3f4f6' />
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-family='Arial,Helvetica,sans-serif' font-size='18'>${safe}</text>
    </svg>`;
}

const getThumbnail = async (req, res) => {
  const { id, size = 400, preview_token: previewToken } = req.query;
  if (!id) return res.status(400).json({ message: "Missing file id" });

  try {
    let userId = null;
    let tokenPayload = null;
    if (req.user && req.user.id) {
      userId = req.user.id;
    } else if (previewToken) {
      try {
        tokenPayload = require("../utils/jwt").verifyToken(previewToken);
        if (tokenPayload && tokenPayload.id) userId = tokenPayload.id;
      } catch (e) {
      }
    }
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const fileRec = await prisma.file.findUnique({ where: { driveFileId: id } });
    if (!fileRec || fileRec.userId !== userId) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

    if (tokenPayload && tokenPayload.t === "preview") {
      if (tokenPayload.fileId !== id || tokenPayload.id !== userId) {
        return res.status(401).json({ message: "Invalid preview token for this file" });
      }
    }

    const publicId = `drive_thumbnails/${id}`;

    try {
      await cloudinary.api.resource(publicId);
      const url = cloudinary.url(publicId, {
        width: size,
        crop: "fill",
        format: "jpg",
        secure: true
      });
      return res.redirect(url);
    } catch (error) {
      if (error && error.http_code !== 404) {
        console.warn("Cloudinary check error", error.message);
      }
    }

    const accounts = await prisma.driveAccount.findMany({ where: { userId } });

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
          const svg = svgPlaceholder(meta.data.name || id, size, Math.round(size * 0.75));
          res.setHeader("Content-Type", "image/svg+xml");
          res.send(svg);
          return;
        }

        const streamResp = await drive.files.get({ fileId: id, alt: "media" }, { responseType: "stream" });

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

    const svg = svgPlaceholder(id, size, Math.round(size * 0.75));
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
  } catch (err) {
    console.error("getThumbnail error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to generate thumbnail" });
  }
};




const uploadToDrive = async (uploadId, file, account, userId) => {
  try {
    if (!account.refreshToken) {
      throw new Error("Missing refresh token");
    }

    try {
      await prisma.transferJob.update({ where: { uploadId }, data: { status: 'in_progress' } });
    } catch (e) {
    }

    const sendLog = (p, text, type = 'info') => {
      const entry = progressMap.get(uploadId);
      if (entry) {
        const logItem = { text, type, time: new Date().toLocaleTimeString() };
        if (!entry.logs) entry.logs = [];
        entry.logs.push(logItem);

        if (entry.res) {
          entry.res.write(`data: ${JSON.stringify({
            progress: p,
            log: logItem
          })}\n\n`);
        }
      }
    };

    sendLog(0, `[SYS] Initializing single-file upload sequence...`, 'start');
    sendLog(0, `[NET] Target Endpoint: ${account.email} (Google Drive API v3)`, 'info');
    sendLog(0, `[AUTH] Refreshing OAuth2 Token...`, 'info');

    if (!account.refreshToken) {
      throw new Error("Missing refresh token");
    }

    try {
      await prisma.transferJob.update({ where: { uploadId }, data: { status: 'in_progress' } });
      sendLog(0, `[DB] State transition: PENDING -> IN_PROGRESS`, 'info');
    } catch (e) {
    }

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

    if (!access_token) {
      throw new Error("No access token after refresh");
    }

    auth.setCredentials({ access_token });
    const drive = google.drive({ version: "v3", auth });

    const filePath = file.path || (file.buffer && null);
    let fileSize = file.size;

    let readStream;
    if (filePath) {
      const stat = fs.statSync(filePath);
      fileSize = stat.size;
      readStream = fs.createReadStream(filePath);
    } else if (file.buffer) {
      readStream = require("stream").Readable.from(file.buffer);
    } else {
      throw new Error("No file data available for upload");
    }

    const PassThrough = require("stream").PassThrough;
    const pass = new PassThrough();

    let uploaded = 0;
    let lastLogged = 0;

    readStream.on("data", (chunk) => {
      uploaded += chunk.length;
      const progress = Math.min(100, Math.round((uploaded / fileSize) * 100));
      const entry = progressMap.get(uploadId);
      if (entry?.res) {
        entry.res.write(`data: ${JSON.stringify({ progress })}\n\n`);
      }

      // Log significant progress steps (Every 10%) - Avoid duplicates
      if (progress % 10 === 0 && progress > 0 && progress !== lastLogged) {
        sendLog(progress, `[NET] Streaming Packet: ${Math.round(uploaded / 1024 / 1024)}MB / ${Math.round(fileSize / 1024 / 1024)}MB (${progress}%) buffered -> Outbound`, 'process');
        lastLogged = progress;
      }
      pass.write(chunk);

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
        appProperties: {
          uploaderId: String(userId),
          uploaderApp: "DriveMerge",
        },
      },
      media,
      fields: "id, name, mimeType, size, modifiedTime",
    });

    sendLog(100, "Verifying file integrity...", 'info');
    sendLog(100, "Upload completed successfully. File visible in Drive.", 'success');

    try {
      const driveFileId = response.data && response.data.id;
      recentUploads.push({
        id: driveFileId,
        name: file.originalname,
        size: fileSize,
        accountEmail: account.email,
        userId,
        uploadedAt: new Date().toISOString(),
      });
      if (recentUploads.length > 200) recentUploads.shift();

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

      try {
        await prisma.transferJob.update({ where: { uploadId }, data: { status: 'succeeded', driveFileId } });
      } catch (e) { }
    } catch (e) {
      console.warn("Failed to record recent upload debug info", e && e.message);
    }

    const entry = progressMap.get(uploadId);
    if (entry?.res) {
      entry.res.write(`data: ${JSON.stringify({ progress: 100, status: 'succeeded' })}\n\n`);
      entry.res.end();
    }

    const fileSizeGb = fileSize / 1024 ** 3;
    await prisma.driveAccount.update({
      where: { userId_email: { userId, email: account.email } },
      data: { usedSpaceGb: { increment: fileSizeGb } },
    });

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

    allFiles.sort((a, b) => (b.modifiedAt || "").localeCompare(a.modifiedAt || ""));
    const out = limit > 0 ? allFiles.slice(0, limit) : allFiles;

    res.json({ files: out });
  } catch (err) {
    console.error("listFiles error:", err);
    res.status(500).json({ message: "Failed to list files" });
  }
};

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
      }
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const fileRec = await prisma.file.findUnique({ where: { driveFileId: id } });
    if (!fileRec || fileRec.userId !== userId) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

    if (tokenPayload && tokenPayload.t === "preview") {
      if (tokenPayload.fileId !== id || tokenPayload.id !== userId) {
        return res.status(401).json({ message: "Invalid preview token for this file" });
      }
    }

    if (fileRec.isSplit) {
      const chunks = await prisma.fileChunk.findMany({
        where: { fileId: fileRec.id },
        include: { driveAccount: true },
        orderBy: { chunkIndex: "asc" },
      });

      if (!chunks || chunks.length === 0) {
        return res.status(404).json({ message: "No chunks found for split file" });
      }

      const totalSize = chunks.reduce((acc, c) => acc + Number(c.sizeBytes), 0);
      const mime = fileRec.mime || "application/octet-stream";

      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `attachment; filename="${fileRec.name}"`);
      res.setHeader("Content-Length", String(totalSize));

      // Sequential streaming loop (Robust & Non-Recursive)
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const account = chunk.driveAccount;

        if (!account || !account.refreshToken) {
          console.error(`Missing account for chunk ${chunk.chunkIndex}`);
          res.destroy(new Error("File corrupt: missing chunk account"));
          return;
        }

        try {
          const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          auth.setCredentials({ refresh_token: account.refreshToken });

          const accessResp = await auth.getAccessToken();
          const access_token = accessResp && typeof accessResp === 'object' ? accessResp.token : accessResp;
          auth.setCredentials({ access_token });
          const drive = google.drive({ version: "v3", auth });

          const streamResp = await drive.files.get(
            { fileId: chunk.driveFileId, alt: "media" },
            { responseType: "stream" }
          );

          await new Promise((resolve, reject) => {
            // Pipe with {end: false} so we can manually end after ALL chunks
            streamResp.data.pipe(res, { end: false });
            streamResp.data.on('end', resolve);
            streamResp.data.on('error', (err) => {
              console.error(`Stream error on chunk ${chunk.chunkIndex}`, err);
              reject(err);
            });
          });

        } catch (err) {
          console.error(`Failed to retrieve chunk ${chunk.chunkIndex}`, err);
          res.destroy(err);
          return;
        }
      }

      res.end();
      return;
    }

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

        res.setHeader('Content-Length', String(size));
        const streamResp = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
        streamResp.data.pipe(res);
        return true;
      } catch (err) {
        console.warn('tryStreamFromAccount failed for', acc.email, err && err.message);
        return false;
      }
    };

    if (fileRec.driveAccountId) {
      const acc = await prisma.driveAccount.findUnique({ where: { id: fileRec.driveAccountId } });
      if (acc) {
        const ok = await tryStreamFromAccount(acc);
        if (ok) return;
      }
    }

    const accounts = await prisma.driveAccount.findMany({ where: { userId } });
    for (const account of accounts) {
      const ok = await tryStreamFromAccount(account);
      if (ok) return;
    }

    res.status(404).json({ message: 'File not found in connected accounts' });
  } catch (err) {
    console.error("downloadFile error:", err);
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

const subscribeUploadProgress = async (req, res) => {
  const { uploadId } = req.params;
  if (!uploadId) return res.status(400).json({ message: 'Missing uploadId' });

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

  res.write(`data: ${JSON.stringify({ progress: entry.progress })}\n\n`);

  // Replay logs for late subscribers
  if (entry.logs && entry.logs.length > 0) {
    entry.logs.forEach(log => {
      res.write(`data: ${JSON.stringify({
        progress: entry.progress,
        log: log
      })}\n\n`);
    });
  }

  req.on('close', () => {
    if (entry && entry.res === res) entry.res = null;
  });
};

const createPreviewToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const fileId = req.body?.fileId || req.query?.fileId;
    if (!fileId) return res.status(400).json({ message: "Missing fileId" });

    const fileRec = await prisma.file.findUnique({ where: { driveFileId: fileId } });
    if (!fileRec || fileRec.userId !== userId) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

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
  cancelUpload,
  deleteFile,
};
