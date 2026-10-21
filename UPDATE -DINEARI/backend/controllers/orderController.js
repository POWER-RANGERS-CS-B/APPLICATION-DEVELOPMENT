const orderModel = require("../models/orderModel");
const { getPublicBaseUrl } = require("../config/publicUrl");

exports.createOrder = async (req, res) => {
  try {
    const chairIds = Array.isArray(req.body.chairIds) ? req.body.chairIds : [];
    const type = req.body.type || (chairIds.length ? "dine_in" : null);

    if (!type || !["dine_in", "takeout"].includes(type)) {
      return res.status(400).json({
        message: "A valid order type is required. Select a table for dine-in before ordering."
      });
    }

    const order = await orderModel.create({
      userId: req.user?.id || null,
      type,
      chairIds,
      items: req.body.items,
      paymentMethod: req.body.payment_method || "GCash",
      reservationDate: req.body.reservation_date,
      reservationTime: req.body.reservation_time,
      customerName: req.body.customer_name || req.body.customerName,
      contactNumber: req.body.contact_number || req.body.contactNumber,
      receiptBaseUrl: getPublicBaseUrl(req),
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getKdsOrders = async (req, res) => {
  try {
    res.json(await orderModel.findKdsOrders());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    res.json(await orderModel.updateStatus(req.params.id, req.body.status));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    res.json(await orderModel.softDelete(req.params.id));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getReceipt = async (req, res) => {
  try {
    const { code, token } = req.query;

    if (!code || !token) {
      return res.status(400).json({ message: "Invalid receipt link." });
    }

    const receipt = await orderModel.findReceiptByCodeAndToken(code, token);

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found or invalid." });
    }

    res.json(receipt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const history = await orderModel.findOrderHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTodayIncome = async (req, res) => {
  try {
    const income = await orderModel.getTodayIncome();
    res.json(income);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};