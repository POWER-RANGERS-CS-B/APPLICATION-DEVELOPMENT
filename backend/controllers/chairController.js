const chairModel = require("../models/chairModel");

exports.getChairs = async (req, res) => {
  try {
    await chairModel.releaseExpiredLocks();
    res.json(await chairModel.findAll());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.lockChairs = async (req, res) => {
  try {
    res.json(await chairModel.lockChairs(req.body.chairIds));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
