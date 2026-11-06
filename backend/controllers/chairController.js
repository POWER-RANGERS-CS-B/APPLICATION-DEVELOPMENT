const chairModel = require("../models/chairModel");

exports.getChairs = async (req, res) => {
  try {
    await chairModel.releaseExpiredLocks();
    res.json(await chairModel.findAll());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.lockTable = async (req, res) => {
  try {
    const tableId = Number(req.body.tableId);
    if (!Number.isInteger(tableId) || tableId <= 0) {
      return res.status(400).json({ message: "A valid tableId is required." });
    }

    res.json(await chairModel.lockTable(tableId));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};