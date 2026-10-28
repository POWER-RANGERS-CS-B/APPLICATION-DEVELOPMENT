const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
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
    !["customer", "staff", "admin"].includes(payload.role)
  ) {
    return res.status(401).json({ message: "Invalid authentication token." });
  }

  req.user = { id: payload.id, role: payload.role };
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
