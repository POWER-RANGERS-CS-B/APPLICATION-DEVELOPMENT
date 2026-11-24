const chairModel = require("../models/chairModel");
const { sendControllerError } = require("../utils/controllerError");

exports.getChairs = async (req, res) => {
  try {
    await chairModel.releaseExpiredLocks();
    res.json(await chairModel.findAll());
  } catch (error) {
    sendControllerError(res, error, 500);
  }
};

exports.lockTable = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Customer authentication is required." });
    }

    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Access denied." });
    }

    const tableId = Number(req.body.tableId);
    if (!Number.isInteger(tableId) || tableId <= 0) {
      return res.status(400).json({ message: "A valid tableId is required." });
    }

    res.json(await chairModel.lockTable(tableId, req.user));
  } catch (error) {
    sendControllerError(res, error, 400);
  }
};