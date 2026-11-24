const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const authModel = require("../models/authModel");

authModel.isSessionValid = async () => true;

function createAuthTestToken(claims, secret = process.env.JWT_SECRET) {
  return jwt.sign(
    { ...claims, authVersion: 0 },
    secret,
    {
      algorithm: "HS256",
      expiresIn: "1h",
      jwtid: crypto.randomUUID(),
    }
  );
}

module.exports = { createAuthTestToken };
