const historyModel = require("../models/historyModel");
const respondError = require("../utils/respondError");

exports.getHistory = async (req, res) => {
  try {
    res.json(await historyModel.getDeletedRecords());
  } catch (error) {
    respondError(res, error, "History could not be loaded.");
  }
};
