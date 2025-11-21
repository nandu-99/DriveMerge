const { verifyToken } = require("../utils/jwt");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Accept Authorization header or access_token query param (for EventSource compatibility)
  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query && req.query.access_token) {
    token = req.query.access_token;
  }

  if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  if (payload.t && payload.t !== "access") {
    return res.status(401).json({ message: "Invalid token type" });
  }


  req.user = decoded;
  next();
};

const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query && req.query.access_token) {
    token = req.query.access_token;
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.t === "access") {
      req.user = decoded;
    }
  }

  next();
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
};
