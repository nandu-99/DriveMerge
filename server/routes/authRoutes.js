const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getProfile,
  googleLogin,
} = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { oauthCallback } = require("../controllers/driveController");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getProfile);
router.patch(
  "/me",
  authMiddleware,
  require("../controllers/authController").updateProfile
);
router.post("/google-login", googleLogin);
router.get("/callback", oauthCallback);

module.exports = router;
