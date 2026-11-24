const historyModel = require("../models/historyModel");
const { sendControllerError } = require("../utils/controllerError");

exports.getHistory = async (req, res) => {
  try {
    res.json(await historyModel.getDeletedRecords());
  } catch (error) {
    sendControllerError(res, error, 500);
  }
};