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
    });

    res.status(201).json(reservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
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