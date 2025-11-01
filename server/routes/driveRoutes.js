const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
  getAuthUrl,
  disconnectAccount,
  getAccounts,
  uploadFiles,
} = require("../controllers/driveController");

router.get("/auth-url", authMiddleware, getAuthUrl);
router.get("/accounts", authMiddleware, getAccounts);
router.post("/disconnect", authMiddleware, disconnectAccount);
router.post("/upload/files", authMiddleware, uploadFiles);

module.exports = router;
