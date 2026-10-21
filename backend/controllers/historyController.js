const historyModel = require("../models/historyModel");

exports.getHistory = async (req, res) => {
  try {
    res.json(await historyModel.getDeletedRecords());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
