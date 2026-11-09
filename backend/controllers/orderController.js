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

<<<<<<< HEAD
    const order = await orderModel.create({
      userId: req.user?.id || null,
=======
    if (!req.user) {
      return res.status(401).json({ message: "Customer authentication is required." });
    }

    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Access denied." });
    }

    const order = await orderModel.create({
      userId: req.user.id,
      actorName: req.user.email,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
      type,
      chairIds,
      items: req.body.items,
      paymentMethod: req.body.payment_method || "GCash",
<<<<<<< HEAD
=======
      gcashReference: req.body.gcash_reference || req.body.payment_reference || null,
      gcashSenderName: req.body.gcash_sender_name || null,
      gcashReference: req.body.gcash_reference || req.body.payment_reference || null,
      gcashSenderName: req.body.gcash_sender_name || null,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
      reservationDate: req.body.reservation_date,
      reservationTime: req.body.reservation_time,
      customerName: req.body.customer_name || req.body.customerName,
      contactNumber: req.body.contact_number || req.body.contactNumber,
<<<<<<< HEAD
=======
      contactCountry: req.body.contact_country,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
      receiptBaseUrl: getPublicBaseUrl(req),
    });

    res.status(201).json(order);
  } catch (error) {
    const status = error.code === "PUBLIC_BASE_URL_CONFIGURATION_ERROR" ? 500 : 400;
    res.status(status).json({ message: error.message });
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
    res.json(await orderModel.updateStatus(req.params.id, req.body.status, req.user));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getPendingPaymentOrders = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findPendingPaymentOrders());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDineInPaymentRequests = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findDineInPaymentRequests());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPendingDineInRefunds = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findPendingDineInRefunds());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDineInRefunds = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findDineInRefunds());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const order = await orderModel.confirmPayment(
      req.params.id,
      req.user,
      getPublicBaseUrl(req)
    );
    res.json(order);
  } catch (error) {
    const status = error.code === "PUBLIC_BASE_URL_CONFIGURATION_ERROR"
      ? 500
      : error.statusCode || 400;
    res.status(status).json({ message: error.message });
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    res.json(await orderModel.rejectPayment(req.params.id, req.body?.reason, req.user));
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

exports.getCustomerPaymentStatus = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findCustomerPaymentStatus(req.params.id, req.user.id));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const order = await orderModel.softDelete(req.params.id, req.user);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getReceipt = async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");

  try {
    const { code, token } = req.query;

    if (
      typeof code !== "string" ||
      !/^\d{3}$/.test(code) ||
      typeof token !== "string" ||
      !/^[a-f\d]{64}$/i.test(token)
    ) {
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

exports.getCategorySales = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.getCategorySales());
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