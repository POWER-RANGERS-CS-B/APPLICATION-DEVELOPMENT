const { assertRequiredEnvironmentVariables } = require("../config/env");
assertRequiredEnvironmentVariables(["JWT_SECRET"]);

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const authModel = require("../models/authModel");
const auditService = require("../services/auditService");
const { isValidEmailDomain } = require("../utils/emailValidation");
const { parsePhoneNumberFromString } = require("libphonenumber-js/max");
const googleOAuthClient = new OAuth2Client();

exports.googleClientConfig = (_req, res) => {
  res.set("Cache-Control", "no-store").json({ clientId: process.env.GOOGLE_CLIENT_ID || "" });
};

exports.googleAuth = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const credential = typeof req.body?.credential === "string" ? req.body.credential : "";
  const intent = req.body?.intent;

  if (!clientId) {
    return res.status(503).json({ message: "Google sign-in is not configured. Please use email and password." });
  }
  if (!credential || !["login", "signup"].includes(intent)) {
    return res.status(400).json({ message: "A valid Google credential and authentication intent are required." });
  }

  let googleUser;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    googleUser = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: "Google could not verify this sign-in. Please try again." });
  }

  const email = typeof googleUser?.email === "string" ? googleUser.email.trim().toLowerCase() : "";
  const googleFullName = typeof googleUser?.name === "string"
    ? googleUser.name.trim().slice(0, 128)
    : "";
  const googlePictureUrl = typeof googleUser?.picture === "string" &&
    /^https:\/\//i.test(googleUser.picture)
    ? googleUser.picture
    : null;
  if (
    googleUser?.email_verified !== true ||
    !googleUser?.sub ||
    !isValidEmailDomain(email)
  ) {
    return res.status(401).json({ message: "Use a Google account with a verified email address." });
  }

  let operation = "find_customer";
  try {
    let user;

    if (intent === "signup") {
      user = await authModel.findByEmail(email);
      if (user) {
        return res.status(409).json({ message: "An account with this email already exists. Please log in instead." });
      }
      const fullName = googleFullName || email.split("@")[0];
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
      operation = "insert_google_customer";
      user = await authModel.createGoogleCustomer({
        fullName,
        email,
        passwordHash,
        googleSub: googleUser.sub,
        googleFullName: googleFullName || null,
        googlePictureUrl,
      });
    } else {
      operation = "find_linked_google_customer";
      user = await authModel.findCustomerByGoogleSub(googleUser.sub);
      if (!user) {
        return res.status(401).json({
          message: "No customer account is linked to this Google account. Sign in with your existing method or sign up.",
        });
      }
      operation = "refresh_google_customer_profile";
      user = await authModel.updateGoogleCustomerProfile({
        userId: user.id,
        googleSub: googleUser.sub,
        googleFullName,
        googlePictureUrl,
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    if (intent === "login") {
      const auditRecorded = await auditService.record({
        userId: user.id,
        actorName: user.full_name,
        action: "LOGIN_SUCCESS",
        module: "auth",
      });
      if (!auditRecorded) {
        return res.status(503).json({ message: "Google sign-in is temporarily unavailable. Please try again." });
      }
    }

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        contactNumber: user.contact_number,
        role: user.role,
        picture: user.google_picture_url || null,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Google customer authentication failed.", {
      endpoint: "POST /auth/google",
      operation,
      message: error.message,
      code: error.code,
      position: error.position,
      routine: error.routine,
    });
    return res.status(500).json({ message: "Google sign-in failed. Please try again." });
  }
};

exports.registerCustomer = async (req, res) => {
  const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const contact = typeof req.body?.contact_number === "string" ? req.body.contact_number.trim() : "";
  const password = req.body?.password;
  const confirmPassword = req.body?.confirm_password;
  if (!fullName || fullName.length > 128) {
    return res.status(400).json({ message: "Enter your full name (128 characters or fewer)." });
  }
  if (!isValidEmailDomain(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  const phone = parsePhoneNumberFromString(contact, "PH");
  if (!phone || !phone.isValid()) {
    return res.status(400).json({
      message: "Enter a valid phone number (for example, 09171234567 or +639171234567).",
    });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match." });
  }

  try {
    const user = await authModel.createCustomer({
      fullName,
      email,
      contactNumber: phone.format("E.164"),
      passwordHash: await bcrypt.hash(password, 12),
    });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.status(201).json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        contactNumber: user.contact_number,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

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

    if (typeof password !== "string" || password.length === 0) {
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

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const auditRecorded = await auditService.record({
      userId: user.id,
      actorName: user.full_name,
      action: "LOGIN_SUCCESS",
      module: "auth",
    });

    if (!auditRecorded) {
      return res.status(503).json({ message: "Login is temporarily unavailable. Please try again." });
    }

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logout = async (req, res) => {
  const recorded = await auditService.record({
    userId: req.user.id,
    actorName: req.user.email,
    action: "LOGOUT",
    module: "auth",
  });

  if (!recorded) {
    return res.status(503).json({ message: "Logout could not be recorded. Please retry." });
  }

  res.json({ message: "Logged out." });
};
