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
  cancelUpload,
  deleteFile,
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
router.post("/upload/cancel/:uploadId", authMiddleware, cancelUpload);
router.delete("/files/:fileId", authMiddleware, deleteFile);
router.get("/debug/recent-uploads", authMiddleware, debugRecentUploads);
router.get("/transfers", authMiddleware, getTransfers);

module.exports = router;

