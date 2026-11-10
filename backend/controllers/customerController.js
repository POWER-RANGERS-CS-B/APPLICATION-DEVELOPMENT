const { parsePhoneNumberFromString } = require("libphonenumber-js/max");
const { isValidEmailDomain } = require("../utils/emailValidation");
const customerModel = require("../models/customerModel");
const respondError = require("../utils/respondError");

exports.getProfile = async (req, res) => {
  try {
    res.json(await customerModel.getProfile(req.user.id));
  } catch (error) {
    respondError(res, error, "The customer profile could not be loaded.");
  }
};

exports.updateProfile = async (req, res) => {
  const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const contact = typeof req.body?.contact_number === "string" ? req.body.contact_number.trim() : "";
  const phone = parsePhoneNumberFromString(contact);

  if (!fullName || fullName.length > 128) {
    return res.status(400).json({ message: "Enter your full name (128 characters or fewer)." });
  }
  if (!isValidEmailDomain(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (!phone || !phone.isValid()) {
    return res.status(400).json({ message: "Enter a valid phone number with its country code." });
  }

  try {
    res.json(await customerModel.updateProfile(req.user.id, {
      fullName,
      email,
      contactNumber: phone.format("E.164"),
    }));
  } catch (error) {
    respondError(res, error, "The customer profile could not be updated.");
  }
};

exports.updateSettings = async (req, res) => {
  const preferredTheme = req.body?.preferred_theme;
  if (!["light", "dark"].includes(preferredTheme)) {
    return res.status(400).json({ message: "Choose light or dark mode." });
  }
  try {
    res.json(await customerModel.updateSettings(req.user.id, { preferredTheme }));
  } catch (error) {
    respondError(res, error, "Customer settings could not be updated.");
  }
};

exports.listNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      customerModel.listNotifications(req.user.id),
      customerModel.getUnreadNotificationCount(req.user.id),
    ]);
    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    respondError(res, error, "Customer notifications could not be loaded.");
  }
};

exports.getReservation = async (req, res) => {
  const reservationId = Number(req.params.id);
  if (!Number.isSafeInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ message: "A valid reservation ID is required." });
  }
  try {
    res.json(await customerModel.getReservation(req.user.id, reservationId));
  } catch (error) {
    respondError(res, error, "The reservation could not be loaded.");
  }
};

exports.markNotificationRead = async (req, res) => {
  const notificationId = Number(req.params.id);
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ message: "A valid notification ID is required." });
  }
  const isRead = req.body?.read === undefined ? true : req.body.read;
  if (typeof isRead !== "boolean") {
    return res.status(400).json({ message: "Notification read status must be true or false." });
  }
  try {
    res.json(await customerModel.markNotificationRead(req.user.id, notificationId, isRead));
  } catch (error) {
    respondError(res, error, "The notification could not be updated.");
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    res.json(await customerModel.markAllNotificationsRead(req.user.id));
  } catch (error) {
    respondError(res, error, "Notifications could not be updated.");
  }
};

exports.deleteNotification = async (req, res) => {
  const notificationId = Number(req.params.id);
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ message: "A valid notification ID is required." });
  }
  try {
    res.json(await customerModel.deleteNotification(req.user.id, notificationId));
  } catch (error) {
    respondError(res, error, "The notification could not be deleted.");
  }
};
