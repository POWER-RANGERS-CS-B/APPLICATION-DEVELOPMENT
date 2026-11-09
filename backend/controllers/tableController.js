const tableModel = require("../models/tableModel");

exports.getTables = async (req, res) => {
  try {
<<<<<<< HEAD
    const reservationDate = req.query.reservation_date || null;
    const reservationTime = req.query.reservation_time || null;
    if (Boolean(reservationDate) !== Boolean(reservationTime)) {
      return res.status(400).json({ message: "Reservation date and time must be provided together." });
    }

    if (reservationDate) {
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(reservationDate) &&
        !Number.isNaN(Date.parse(`${reservationDate}T00:00:00Z`)) &&
        new Date(`${reservationDate}T00:00:00Z`).toISOString().slice(0, 10) === reservationDate;
      const validTime = /^\d{2}:\d{2}(:\d{2})?$/.test(reservationTime);
      if (!validDate || !validTime) {
        return res.status(400).json({ message: "A valid reservation date and time are required." });
      }
    }

    const tables = await tableModel.findAll({ reservationDate, reservationTime });
=======
    const tables = await tableModel.findAll();
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    res.json(tables);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.markOccupiedForWalkIn = async (req, res) => {
  try {
    const result = await tableModel.markOccupiedForWalkIn(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.cleanTable = async (req, res) => {
  try {
<<<<<<< HEAD
    const result = await tableModel.markCleaned(req.params.id);
=======
    const result = await tableModel.markCleaned(req.params.id, req.user);
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.markNeedsCleaning = async (req, res) => {
  try {
    const result = await tableModel.markNeedsCleaning(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.startCleaning = async (req, res) => {
  try {
    const result = await tableModel.startCleaning(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};