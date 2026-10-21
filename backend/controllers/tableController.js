const tableModel = require("../models/tableModel");

exports.getTables = async (req, res) => {
  try {
    res.json(await tableModel.findAll());
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
