const jwt = require("jsonwebtoken");
const authModel = require("../models/authModel");

async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (typeof header !== "string") {
    return res.status(401).json({ message: "No token provided." });
  }

  const [scheme, token, ...extraParts] = header.split(" ");

  if (scheme !== "Bearer" || !token || extraParts.length > 0) {
    return res.status(401).json({ message: "Invalid authorization header." });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  const userId = Number(payload?.id);
  if (
    !payload ||
    typeof payload !== "object" ||
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !["staff", "cashier", "admin", "customer"].includes(payload.role) ||
    !Number.isSafeInteger(payload.authVersion) ||
    payload.authVersion < 0 ||
    typeof payload.jti !== "string" ||
    payload.jti.length === 0 ||
    payload.jti.length > 128 ||
    !Number.isSafeInteger(payload.exp)
  ) {
    return res.status(401).json({ message: "Invalid authentication token." });
  }

  let sessionIsValid;
  try {
    sessionIsValid = await authModel.isSessionValid(
      userId,
      payload.role,
      payload.authVersion,
      payload.jti
    );
  } catch (error) {
    console.error("Authentication state verification failed.", {
      errorType: error.name || "Error",
      errorCode: error.code,
    });
    return res.status(503).json({ message: "Authentication is temporarily unavailable." });
  }

  if (!sessionIsValid) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  req.user = {
    id: userId,
    role: payload.role,
    email: typeof payload.email === "string" ? payload.email : null,
    tokenId: payload.jti,
    tokenExpiresAt: new Date(payload.exp * 1000),
  };
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    next();
  };
}

module.exports = { authenticate, allowRoles };
