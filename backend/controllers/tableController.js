const tableModel = require("../models/tableModel");

exports.getTables = async (req, res) => {
  try {
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
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.cleanTable = async (req, res) => {
  try {
    res.json(await tableModel.markCleaned(req.params.id));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
