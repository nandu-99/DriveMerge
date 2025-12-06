const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} = require("../utils/jwt");
const prisma = new PrismaClient();
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.status(201).json({
      message: "User registered successfully",
      user: { name, email },
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.status(200).json({
      message: "Login successful",
      user: { name: user.name, email },
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;
    if (!name && !email) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: name ?? undefined, email: email ?? undefined },
      select: { id: true, name: true, email: true },
    });

    res.json({ message: "Profile updated", user: updated });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ message: "Missing Google credential" });
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    if (!email)
      return res.status(400).json({ message: "Invalid Google token" });
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: null,
          googleId,
          profilePicture: picture || null,
        },
      });
    }
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.status(200).json({
      message: "Google login successful",
      user: {
        name: user.name,
        email: user.email,
        picture: user.profilePicture,
      },
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const bodyToken = req.body?.refreshToken;
    const headerToken = req.headers["x-refresh-token"];
    const token = bodyToken || headerToken;
    if (!token) return res.status(400).json({ message: "Missing refresh token" });

    const payload = verifyToken(token);
    if (!payload || payload.t !== "refresh")
      return res.status(401).json({ message: "Invalid or expired refresh token" });

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({ token: accessToken, refreshToken });
  } catch (err) {
    console.error("refreshAccessToken error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  googleLogin,
  refreshAccessToken,
};


