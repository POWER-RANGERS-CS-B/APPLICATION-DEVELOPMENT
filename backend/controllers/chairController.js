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
<<<<<<< HEAD
=======
    if (!req.user) {
      return res.status(401).json({ message: "Customer authentication is required." });
    }

    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Access denied." });
    }

>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    const tableId = Number(req.body.tableId);
    if (!Number.isInteger(tableId) || tableId <= 0) {
      return res.status(400).json({ message: "A valid tableId is required." });
    }

<<<<<<< HEAD
    res.json(await chairModel.lockTable(tableId));
=======
    res.json(await chairModel.lockTable(tableId, req.user));
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};