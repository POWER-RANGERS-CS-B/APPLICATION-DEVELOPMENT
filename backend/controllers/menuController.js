const menuModel = require("../models/menuModel");
const respondError = require("../utils/respondError");

function validationError(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function parseMenuItem(body, { creating = false, imageUrl } = {}) {
  const fields = {};
  const stringFields = [
    ["item_name", 120],
    ["category", 80],
    ["description", 1000],
  ];
  for (const [field, maxLength] of stringFields) {
    if (body[field] === undefined && !creating) continue;
    if (typeof body[field] !== "string") throw validationError(`Invalid ${field}.`);
    const value = body[field].trim();
    if ((field !== "description" && !value) || value.length > maxLength) {
      throw validationError(`Invalid ${field}.`);
    }
    fields[field] = value;
  }

  for (const [field, integer] of [["price", false], ["stock_count", true]]) {
    if (body[field] === undefined && !creating) continue;
    if (body[field] === null || String(body[field]).trim() === "") throw validationError(`Invalid ${field}.`);
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0 || (integer && (!Number.isSafeInteger(value) || value > 1000000))) {
      throw validationError(`Invalid ${field}.`);
    }
    fields[field] = value;
  }

  if (creating && (!Object.hasOwn(fields, "item_name") || !Object.hasOwn(fields, "category") || !Object.hasOwn(fields, "price"))) {
    throw validationError("Menu item name, category, and price are required.");
  }
  if (imageUrl) fields.image_url = imageUrl;
  return fields;
}

exports.getMenu = async (req, res) => {
  try {
    res.json(await menuModel.findAll());
  } catch (error) {
    respondError(res, error, "Menu could not be loaded.");
  }
};

// --- : Handlers for creating a menu item row ---
exports.createMenuItem = async (req, res) => {
  try {
    const image_url = req.file ? `images/menu-images/${req.file.filename}` : 'images/default-food.jpg';
    const itemData = parseMenuItem(req.body, { creating: true, imageUrl: image_url });
    const newItem = await menuModel.create(itemData, req.user);
    res.status(201).json(newItem);
  } catch (error) {
    respondError(res, error, "Menu item could not be saved.", 400);
  }
};

// --- : Handlers for processing live dashboard adjustments ---
exports.updateMenuItem = async (req, res) => {
  try {
    const updateData = parseMenuItem(req.body);
    if (req.file) {
      updateData.image_url = `images/menu-images/${req.file.filename}`;
    }
    if (!Object.keys(updateData).length) return res.status(400).json({ message: "No valid menu item fields were provided." });
    const updatedItem = await menuModel.update(req.params.id, updateData, req.user);
    if (!updatedItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(updatedItem);
  } catch (error) {
    respondError(res, error, "Menu item could not be updated.", 400);
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
    respondError(res, error, "Menu item could not be deleted.", 400);
  }
};
