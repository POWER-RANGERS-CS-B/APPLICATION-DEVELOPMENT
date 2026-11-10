const reservationModel = require("../models/reservationModel");
const { normalizeReservationCustomer } = require("../utils/reservationCustomerValidation");
const respondError = require("../utils/respondError");

function normalizePaymentProofUrl(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw Object.assign(new Error("Payment proof URL is invalid."), { statusCode: 400 });
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Object.assign(new Error("Payment proof URL is invalid."), { statusCode: 400 });
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw Object.assign(new Error("Payment proof URL must use HTTPS."), { statusCode: 400 });
  }
  return url.href;
}

exports.createReservation = async (req, res) => {
  try {
    const body = req.body ?? {};
    const { customerName, contactNumber } = normalizeReservationCustomer(
      body.customer_name,
      body.contact_number,
      body.contact_country
    );
    const reservation = await reservationModel.create({
      userId: req.user?.id || null,
      actorName: req.user?.email || null,
      chairIds: body.chairIds || [],
      reservationDate: body.reservation_date,
      reservationTime: body.reservation_time,
      customerName,
      contactNumber,
      contactCountry: body.contact_country,
      numGuests: body.num_guests,
      paymentMethod: body.payment_method || "GCash",
      paymentReference: body.gcash_reference || body.payment_reference || null,
      gcashSenderName: body.gcash_sender_name || null,
      paymentProofUrl: normalizePaymentProofUrl(body.payment_proof_url),
    });

    res.status(201).json(reservation);
  } catch (error) {
    respondError(res, error, "Reservation could not be submitted.", 400);
  }
};

exports.getReservations = async (req, res) => {
  try {
    const reservations = await reservationModel.findAll();
    res.json(reservations);
  } catch (error) {
    respondError(res, error, "Reservations could not be loaded.");
  }
};

exports.archiveHistoricalReservation = async (req, res) => {
  try {
    const reservation = await reservationModel.archiveHistoricalReservation(req.params.id, {
      actorId: req.user?.id,
      actorName: req.user?.email || "admin",
    });
    res.json(reservation);
  } catch (error) {
    respondError(res, error, "Reservation could not be archived.");
  }
};

exports.confirmReservation = async (req, res) => {
  try {
    const reservation = await reservationModel.confirm(req.params.id, {
      actorId: req.user?.id,
      actorName: req.user?.email || req.user?.full_name || "admin",
    });
    res.json(reservation);
  } catch (error) {
    respondError(res, error, "Reservation could not be confirmed.", 400);
  }
};

exports.rejectReservation = async (req, res) => {
  try {
    const reservation = await reservationModel.reject(req.params.id, req.body?.reason, {
      actorId: req.user?.id,
      actorName: req.user?.email || req.user?.full_name || "admin",
    });
    res.json(reservation);
  } catch (error) {
    respondError(res, error, "Reservation could not be rejected.", 400);
  }
};

exports.getReservationStatus = async (req, res) => {
  try {
    const reservation = await reservationModel.findStatusByToken(req.params.token);
    res.json(reservation);
  } catch (error) {
    respondError(res, error, "Reservation status could not be loaded.");
  }
};

exports.resubmitReservationPayment = async (req, res) => {
  try {
    const reservation = await reservationModel.resubmitPayment(req.params.token, {
      reference: req.body?.gcash_reference,
      senderName: req.body?.gcash_sender_name,
    });
    res.json(reservation);
  } catch (error) {
    respondError(res, error, "Payment details could not be resubmitted.", 400);
  }
};

exports.validateReservationReceipt = async (req, res) => {
  try {
    const reservation = await reservationModel.validateReceipt(req.params.code, {
      actorId: req.user?.id,
      actorName: req.user?.email || "admin",
    });
    res.json(reservation);
  } catch (error) {
    respondError(res, error, "Reservation receipt could not be validated.", 400);
  }
};
