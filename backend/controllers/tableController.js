const tableModel = require("../models/tableModel");
const respondError = require("../utils/respondError");

exports.getTables = async (req, res) => {
  try {
    const tables = await tableModel.findAll();
    res.json(tables);
  } catch (error) {
    respondError(res, error, "Tables could not be loaded.");
  }
};

exports.markOccupiedForWalkIn = async (req, res) => {
  try {
    const result = await tableModel.markOccupiedForWalkIn(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    respondError(res, error, "Table status could not be updated.", 400);
  }
};

exports.cleanTable = async (req, res) => {
  try {
    const result = await tableModel.markCleaned(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    respondError(res, error, "Table cleaning could not be completed.", 400);
  }
};

exports.markNeedsCleaning = async (req, res) => {
  try {
    const result = await tableModel.markNeedsCleaning(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    respondError(res, error, "Table status could not be updated.", 400);
  }
};

exports.startCleaning = async (req, res) => {
  try {
    const result = await tableModel.startCleaning(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    respondError(res, error, "Table cleaning could not be started.", 400);
  }
};
