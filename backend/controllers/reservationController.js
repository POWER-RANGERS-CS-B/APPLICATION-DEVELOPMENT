const reservationModel = require("../models/reservationModel");
const { normalizeReservationCustomer } = require("../utils/reservationCustomerValidation");

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
      paymentProofUrl: body.payment_proof_url || null,
    });

    res.status(201).json(reservation);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

exports.getReservations = async (req, res) => {
  try {
    const reservations = await reservationModel.findAll();
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(error.statusCode || 500).json({ message: error.message });
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
    res.status(error.statusCode || 400).json({ message: error.message });
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
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

exports.getReservationStatus = async (req, res) => {
  try {
    const reservation = await reservationModel.findStatusByToken(req.params.token);
    res.json(reservation);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
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
    res.status(error.statusCode || 400).json({ message: error.message });
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
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};