const jwt = require("jsonwebtoken");
const authModel = require("../models/authModel");

async function authenticate(req, res, next) {
  const token = req.cookies?.dineari_session;
  if (typeof token !== "string" || !token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !(
      (typeof payload.id === "string" && payload.id.length > 0) ||
      Number.isSafeInteger(payload.id)
    ) ||
    !["staff", "cashier", "admin"].includes(payload.role) ||
    typeof payload.jti !== "string" ||
    !Number.isSafeInteger(payload.exp)
  ) {
    return res.status(401).json({ message: "Invalid authentication token." });
  }

  let account;
  try {
    const [revoked, activeAccount] = await Promise.all([
      authModel.isTokenRevoked(payload.jti),
      authModel.findActiveAccount(payload.id),
    ]);
    if (revoked || !activeAccount || activeAccount.role !== payload.role) {
      return res.status(401).json({ message: "Session is no longer valid." });
    }
    account = activeAccount;
  } catch (error) {
    console.error("Authentication state could not be checked:", error);
    return res.status(503).json({ message: "Authentication is temporarily unavailable." });
  }

  req.user = {
    id: payload.id,
    role: account.role,
    email: account.email,
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
