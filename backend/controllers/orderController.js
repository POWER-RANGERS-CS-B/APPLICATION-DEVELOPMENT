const orderModel = require("../models/orderModel");
const { getPublicBaseUrl } = require("../config/publicUrl");
const respondError = require("../utils/respondError");

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
      userId: null,
      actorName: null,
      type,
      chairIds,
      items: req.body.items,
      paymentMethod: req.body.payment_method || "GCash",
      gcashReference: req.body.gcash_reference || req.body.payment_reference || null,
      gcashSenderName: req.body.gcash_sender_name || null,
      gcashReference: req.body.gcash_reference || req.body.payment_reference || null,
      gcashSenderName: req.body.gcash_sender_name || null,
      reservationDate: req.body.reservation_date,
      reservationTime: req.body.reservation_time,
      customerName: req.body.customer_name || req.body.customerName,
      contactNumber: req.body.contact_number || req.body.contactNumber,
      contactCountry: req.body.contact_country,
      receiptBaseUrl: getPublicBaseUrl(req),
    });

    res.status(201).json(order);
  } catch (error) {
    const status = error.code === "PUBLIC_BASE_URL_CONFIGURATION_ERROR" ? 500 : 400;
    if (status < 500) return respondError(res, error, "Order could not be created.", 400);
    return respondError(res, error, "Order could not be created.");
  }
};

exports.getKdsOrders = async (req, res) => {
  try {
    res.json(await orderModel.findKdsOrders());
  } catch (error) {
    respondError(res, error, "Kitchen orders could not be loaded.");
  }
};

exports.updateStatus = async (req, res) => {
  try {
    res.json(await orderModel.updateStatus(req.params.id, req.body.status, req.user));
  } catch (error) {
    respondError(res, error, "Order status could not be updated.", 400);
  }
};

exports.getPendingPaymentOrders = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findPendingPaymentOrders());
  } catch (error) {
    respondError(res, error, "Pending payment orders could not be loaded.");
  }
};

exports.getDineInPaymentRequests = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findDineInPaymentRequests());
  } catch (error) {
    respondError(res, error, "Payment requests could not be loaded.");
  }
};

exports.getPendingDineInRefunds = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findPendingDineInRefunds());
  } catch (error) {
    respondError(res, error, "Pending refunds could not be loaded.");
  }
};

exports.getDineInRefunds = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findDineInRefunds());
  } catch (error) {
    respondError(res, error, "Refunds could not be loaded.");
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
    return respondError(res, error, status < 500 ? "Payment could not be confirmed." : "Payment could not be confirmed.", status < 500 ? 400 : 500);
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    res.json(await orderModel.rejectPayment(req.params.id, req.body?.reason, req.user));
  } catch (error) {
    respondError(res, error, "Payment could not be rejected.", 400);
  }
};

exports.getCustomerPaymentStatus = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findGuestPaymentStatus(req.params.id, req.params.token));
  } catch (error) {
    respondError(res, error, "Payment status could not be loaded.");
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
    respondError(res, error, "Order could not be deleted.", 400);
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
    respondError(res, error, "Receipt could not be loaded.");
  }
};

exports.getCategorySales = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.getCategorySales());
  } catch (error) {
    respondError(res, error, "Category sales could not be loaded.");
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const history = await orderModel.findOrderHistory();
    res.json(history);
  } catch (error) {
    respondError(res, error, "Order history could not be loaded.");
  }
};

exports.getTodayIncome = async (req, res) => {
  try {
    const income = await orderModel.getTodayIncome();
    res.json(income);
  } catch (error) {
    respondError(res, error, "Income could not be loaded.");
  }
};
