const menuModel = require("../models/menuModel");
const { sendControllerError } = require("../utils/controllerError");

exports.getMenu = async (req, res) => {
  try {
    res.json(await menuModel.findAll());
  } catch (error) {
    sendControllerError(res, error, 500);
  }
};

// --- : Handlers for creating a menu item row ---
exports.createMenuItem = async (req, res) => {
  try {
    const image_url = req.file ? `images/menu-images/${req.file.filename}` : 'images/default-food.jpg';
    const itemData = { ...req.body, image_url };
    const newItem = await menuModel.create(itemData, req.user);
    res.status(201).json(newItem);
  } catch (error) {
    sendControllerError(res, error, 400);
  }
};

// --- : Handlers for processing live dashboard adjustments ---
exports.updateMenuItem = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) {
      updateData.image_url = `images/menu-images/${req.file.filename}`;
    }
    const updatedItem = await menuModel.update(req.params.id, updateData, req.user);
    if (!updatedItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(updatedItem);
  } catch (error) {
    sendControllerError(res, error, 400);
  }
};

exports.softDeleteMenuItem = async (req, res) => {
  try {
    const deletedItem = await menuModel.softDelete(req.params.id, req.user);
    if (!deletedItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(deletedItem);
  } catch (error) {
    sendControllerError(res, error, 400);
  }
};