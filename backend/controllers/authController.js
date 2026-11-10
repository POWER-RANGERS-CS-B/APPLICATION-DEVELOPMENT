const { assertRequiredEnvironmentVariables } = require("../config/env");
assertRequiredEnvironmentVariables(["JWT_SECRET"]);

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");
const authModel = require("../models/authModel");
const auditService = require("../services/auditService");
const { isValidEmailDomain } = require("../utils/emailValidation");

const SESSION_COOKIE = "dineari_session";
const SESSION_TTL_MS = 15 * 60 * 1000;
const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

function issueSession(res, user) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m", jwtid: randomUUID() }
  );
  res.cookie(SESSION_COOKIE, token, { ...sessionCookieOptions, maxAge: SESSION_TTL_MS });
}

exports.login = async (req, res) => {
  const submittedEmail =
    typeof req.body.email === "string" ? req.body.email.trim().slice(0, 255) : null;

  try {
    const { email, password } = req.body;

    // Reject login if email lacks a valid @domain.suffix structure
    if (!isValidEmailDomain(email)) {
      await auditService.record({
        actorName: submittedEmail,
        action: "LOGIN_FAILED",
        module: "auth",
        details: { reason: "invalid_email" },
      });
      return res.status(400).json({ 
        message: "Invalid email format. Please log in using a complete email address (e.g., user@example.com)." 
      });
    }

    if (typeof password !== "string" || password.length === 0 || Buffer.byteLength(password, "utf8") > 72) {
      await auditService.record({
        actorName: submittedEmail,
        action: "LOGIN_FAILED",
        module: "auth",
        details: { reason: "invalid_credentials" },
      });
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = await authModel.findByEmail(email.trim());

    if (!user) {
      await auditService.record({
        actorName: submittedEmail,
        action: "LOGIN_FAILED",
        module: "auth",
        details: { reason: "invalid_credentials" },
      });
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      await auditService.record({
        userId: user.id,
        actorName: user.email,
        action: "LOGIN_FAILED",
        module: "auth",
        details: { reason: "invalid_credentials" },
      });
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!["admin", "staff", "cashier"].includes(user.role)) {
      await auditService.record({
        userId: user.id,
        actorName: user.email,
        action: "LOGIN_FAILED",
        module: "auth",
        details: { reason: "role_not_allowed" },
      });
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const auditRecorded = await auditService.record({
      userId: user.id,
      actorName: user.full_name,
      action: "LOGIN_SUCCESS",
      module: "auth",
    });

    if (!auditRecorded) {
      return res.status(503).json({ message: "Login is temporarily unavailable. Please try again." });
    }

    issueSession(res, user);
    res.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ message: "Login is temporarily unavailable." });
  }
};

exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string" && token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload?.jti && Number.isSafeInteger(payload.exp)) {
          await authModel.revokeToken(payload.id, payload.jti, new Date(payload.exp * 1000));
          await auditService.record({
            userId: payload.id,
            actorName: typeof payload.email === "string" ? payload.email : null,
            action: "LOGOUT",
            module: "auth",
          });
        }
      } catch (error) {
        if (!["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
          throw error;
        }
      }
    }
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    return res.json({ message: "Logged out." });
  } catch (error) {
    console.error("Logout failed:", error);
    return res.status(503).json({ message: "Logout could not be completed. Please retry." });
  }
};

exports.getSession = (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    },
  });
};
