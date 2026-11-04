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
    const result = await tableModel.markCleaned(req.params.id, req.user);
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