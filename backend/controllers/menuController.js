const menuModel = require("../models/menuModel");

exports.getMenu = async (req, res) => {
  try {
    res.json(await menuModel.findAll());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    res.json(await menuModel.softDelete(req.params.id));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
