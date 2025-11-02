const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
  getAuthUrl,
  disconnectAccount,
  getAccounts,
  uploadFiles,
} = require("../controllers/driveController");
const { listFiles, downloadFile, getFiles, debugRecentUploads } = require("../controllers/driveController");

router.get("/auth-url", authMiddleware, getAuthUrl);
router.get("/accounts", authMiddleware, getAccounts);
router.post("/disconnect", authMiddleware, disconnectAccount);
router.post("/upload/files", authMiddleware, uploadFiles);
router.get("/files/list", authMiddleware, listFiles);
router.get("/files", authMiddleware, getFiles);
router.get("/files/download", authMiddleware, downloadFile);
router.get("/debug/recent-uploads", authMiddleware, debugRecentUploads);

module.exports = router;
