const staffModel = require("../models/staffModel");

exports.getKitchenDisplay = async (req, res) => {
  try {
    res.json(await staffModel.getKitchenOrders());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
