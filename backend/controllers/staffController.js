const staffModel = require("../models/staffModel");
const arrivalScannerModel = require("../models/arrivalScannerModel");
const orderModel = require("../models/orderModel");
const respondError = require("../utils/respondError");

function arrivalResponseStatus(scanStatus) {
  switch (scanStatus) {
    case "invalid":
      return 400;
    case "not_found":
      return 404;
    case "expired":
    case "cancelled":
      return 410;
    case "already_checked_in":
    case "already_used":
    case "pending_payment":
      return 409;
    default:
      return 200;
  }
}

exports.getKitchenDisplay = async (req, res) => {
  try {
    res.json(await staffModel.getKitchenOrders());
  } catch (error) {
    respondError(res, error, "Kitchen orders could not be loaded.");
  }
};

exports.validateArrivalQr = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const scan = await arrivalScannerModel.validate(req.body?.qr_payload, req.user);
    res.status(arrivalResponseStatus(scan.scan_status)).json(scan);
  } catch (error) {
    console.error("Could not validate arrival QR code:", error);
    res.status(500).json({ message: "The QR code could not be validated. Please try again." });
  }
};

exports.confirmArrival = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const scan = await arrivalScannerModel.confirm(req.body?.qr_payload, req.user);
    res.status(arrivalResponseStatus(scan.scan_status)).json(scan);
  } catch (error) {
    console.error("Could not confirm customer arrival:", error);
    res.status(500).json({ message: "The customer arrival could not be saved. Please try again." });
  }
};

exports.getLateArrivalRefunds = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.findLateArrivalRefunds());
  } catch (error) {
    console.error("Could not load late-arrival refunds:", error);
    res.status(500).json({ message: "Late-arrival refunds could not be loaded." });
  }
};

exports.startLateArrivalRefundProcessing = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.startLateArrivalRefundProcessing(req.params.id, req.user));
  } catch (error) {
    respondError(res, error, "Refund processing could not be started.", 400);
  }
};

exports.completeLateArrivalRefund = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await orderModel.completeLateArrivalRefund(req.params.id, req.user));
  } catch (error) {
    respondError(res, error, "Refund could not be completed.", 400);
  }
};
