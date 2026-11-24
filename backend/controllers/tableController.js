const tableModel = require("../models/tableModel");
const { sendControllerError } = require("../utils/controllerError");

exports.getTables = async (req, res) => {
  try {
    const tables = await tableModel.findAll();
    res.json(tables);
  } catch (error) {
    sendControllerError(res, error);
  }
};

exports.markOccupiedForWalkIn = async (req, res) => {
  try {
    const result = await tableModel.markOccupiedForWalkIn(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    sendControllerError(res, error);
  }
};

exports.cleanTable = async (req, res) => {
  try {
    const result = await tableModel.markCleaned(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    sendControllerError(res, error);
  }
};

exports.markNeedsCleaning = async (req, res) => {
  try {
    const result = await tableModel.markNeedsCleaning(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    sendControllerError(res, error);
  }
};

exports.startCleaning = async (req, res) => {
  try {
    const result = await tableModel.startCleaning(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    sendControllerError(res, error);
  }
};