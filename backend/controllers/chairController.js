const chairModel = require("../models/chairModel");
const respondError = require("../utils/respondError");

exports.getChairs = async (req, res) => {
  try {
    await chairModel.releaseExpiredLocks();
    res.json(await chairModel.findAll());
  } catch (error) {
    respondError(res, error, "Chairs could not be loaded.");
  }
};

exports.lockTable = async (req, res) => {
  try {
    const tableId = Number(req.body.tableId);
    if (!Number.isInteger(tableId) || tableId <= 0) {
      return res.status(400).json({ message: "A valid tableId is required." });
    }

    res.json(await chairModel.lockTable(tableId, null));
  } catch (error) {
    respondError(res, error, "The table could not be locked.", 400);
  }
};
