const reservationModel = require("../models/reservationModel");

exports.createReservation = async (req, res) => {
  try {
    const reservation = await reservationModel.create({
      userId: req.user.id,
      chairIds: req.body.chairIds || [],
      reservationDate: req.body.reservation_date,
      reservationTime: req.body.reservation_time,
      customerName: req.body.customer_name,
      contactNumber: req.body.contact_number,
      numGuests: req.body.num_guests,
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