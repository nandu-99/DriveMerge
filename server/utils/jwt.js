const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m"; // default 15 minutes
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "30d"; // default 30 days

const generateAccessToken = (user, expiresIn = ACCESS_TOKEN_EXPIRY) => {
  return jwt.sign({ id: user.id, email: user.email, t: "access" }, JWT_SECRET, {
    expiresIn,
  });
};

const generateRefreshToken = (user, expiresIn = REFRESH_TOKEN_EXPIRY) => {
  return jwt.sign({ id: user.id, email: user.email, t: "refresh" }, JWT_SECRET, {
    expiresIn,
  });
};

const generatePreviewToken = (user, fileId, expiresIn = "60s") => {
  // fileId is bound into the token so it can't be reused for other files
  return jwt.sign({ id: user.id, email: user.email, fileId, t: "preview" }, JWT_SECRET, {
    expiresIn,
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generatePreviewToken,
  verifyToken,
};
