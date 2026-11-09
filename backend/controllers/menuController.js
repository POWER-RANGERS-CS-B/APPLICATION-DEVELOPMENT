const menuModel = require("../models/menuModel");

exports.getMenu = async (req, res) => {
  try {
    res.json(await menuModel.findAll());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- : Handlers for creating a menu item row ---
exports.createMenuItem = async (req, res) => {
<<<<<<< HEAD
  try {
    const image_url = req.file ? `images/menu-images/${req.file.filename}` : 'images/default-food.jpg';
    const itemData = { ...req.body, image_url };
    const newItem = await menuModel.create(itemData);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// --- : Handlers for processing live dashboard adjustments ---
exports.updateMenuItem = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) {
      updateData.image_url = `images/menu-images/${req.file.filename}`;
    }
    const updatedItem = await menuModel.update(req.params.id, updateData);
    if (!updatedItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.softDeleteMenuItem = async (req, res) => {
=======
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  try {
    const image_url = req.file ? `images/menu-images/${req.file.filename}` : 'images/default-food.jpg';
    const itemData = { ...req.body, image_url };
    const newItem = await menuModel.create(itemData, req.user);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
<<<<<<< HEAD
=======
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
    res.status(400).json({ message: error.message });
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
    res.status(400).json({ message: error.message });
  }
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
};