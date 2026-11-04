const userModel = require("../models/userModel");
const { isValidEmailDomain } = require("../utils/emailValidation");

const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeStaffDetails(body, { creating = false } = {}) {
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!fullName || fullName.length > 120) {
    throw validationError("Full name is required and must be 120 characters or fewer.");
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw validationError("Username must be 3–32 characters and use letters, numbers, dots, underscores, or hyphens.");
  }
  if (email.length > 255 || !isValidEmailDomain(email)) {
    throw validationError("Enter a valid email address using an accepted email domain.");
  }

  if (creating) {
    const { password, confirmPassword, role } = body;
    if (role !== "staff") {
      throw validationError("New accounts can only be created with the Staff role.");
    }
    if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      throw validationError("Password must be at least 12 characters and no more than 72 bytes.");
    }
    if (password !== confirmPassword) {
      throw validationError("Password and confirmation do not match.");
    }
    return { fullName, username, email, password };
  }

  const role = body.role === undefined ? "staff" : body.role;
  if (!["staff", "admin"].includes(role)) {
    throw validationError("Choose a supported account role.");
  }
  return { fullName, username, email, role };
}

function respondWithError(res, error, fallbackMessage) {
  if (error.statusCode === 400 || error.statusCode === 409) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error.code === "23505") {
    const field = error.constraint?.includes("username") ? "username" : "email address";
    return res.status(409).json({ message: `A user with this ${field} already exists.` });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

exports.getEmployees = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const role = typeof req.query.role === "string" ? req.query.role : "all";
  const status = typeof req.query.status === "string" ? req.query.status : "all";

  if (!["all", "admin", "staff"].includes(role) || !["all", "active", "inactive"].includes(status)) {
    return res.status(400).json({ message: "Invalid staff list filter." });
  }

  try {
    res.json(await userModel.findEmployees({ search, role, status }));
  } catch (error) {
    return respondWithError(res, error, "Failed to fetch staff accounts.");
  }
};

exports.createStaff = async (req, res) => {
  try {
    const staffDetails = normalizeStaffDetails(req.body, { creating: true });
    const staff = await userModel.createStaff(staffDetails, req.user);
    return res.status(201).json(staff);
  } catch (error) {
    return respondWithError(res, error, "Failed to create staff account.");
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const staffDetails = normalizeStaffDetails(req.body);
    const staff = await userModel.updateStaff(req.params.id, staffDetails, req.user);
    if (!staff) return res.status(404).json({ message: "Staff account not found." });
    return res.json(staff);
  } catch (error) {
    return respondWithError(res, error, "Failed to update staff account.");
  }
};

exports.setStaffStatus = async (req, res) => {
  const id = String(req.params.id);
  if (String(req.user.id) === id) {
    return res.status(400).json({ message: "You cannot deactivate your own account." });
  }

  const { status } = req.body;
  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({ message: "Choose an active or inactive account status." });
  }

  try {
    const staff = await userModel.setStaffStatus(id, status === "active", req.user);
    if (!staff) return res.status(404).json({ message: "Staff account not found." });
    return res.json(staff);
  } catch (error) {
    return respondWithError(res, error, "Failed to update staff account status.");
  }
};
