const express = require("express");
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = require("../middlewares/authMiddleware");
const {
  getAuthUrl,
  disconnectAccount,
  getAccounts,
  uploadFiles,
  createPreviewToken,
  listFiles,
  downloadFile,
  getFiles,
  debugRecentUploads,
  getThumbnail,
  subscribeUploadProgress,
  getTransfers,
} = require("../controllers/driveController");

router.get("/auth-url", authMiddleware, getAuthUrl);
router.get("/accounts", authMiddleware, getAccounts);
router.post("/disconnect", authMiddleware, disconnectAccount);
router.post("/upload/files", authMiddleware, uploadFiles);
router.get("/files/list", authMiddleware, listFiles);
router.get("/files", authMiddleware, getFiles);
router.get("/files/download", optionalAuthMiddleware, downloadFile);
router.get("/files/thumbnail", authMiddleware, getThumbnail);
router.post("/files/preview-token", authMiddleware, createPreviewToken);
router.get("/upload/progress/:uploadId", authMiddleware, subscribeUploadProgress);
router.get("/debug/recent-uploads", authMiddleware, debugRecentUploads);
router.get("/transfers", authMiddleware, getTransfers);

module.exports = router;

