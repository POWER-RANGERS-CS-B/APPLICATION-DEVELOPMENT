const tableModel = require("../models/tableModel");

exports.getTables = async (req, res) => {
  try {
    const tables = await tableModel.findAll();
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.cleanTable = async (req, res) => {
  try {
    const result = await tableModel.markCleaned(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};