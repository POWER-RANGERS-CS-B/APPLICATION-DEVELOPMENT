const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "No token provided." });
  }

  const tokenMatch = /^Bearer\s+(\S+)$/i.exec(header);

  if (!tokenMatch) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  try {
    req.user = jwt.verify(tokenMatch[1], process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token." });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    next();
  };
}

module.exports = { authenticate, allowRoles };
