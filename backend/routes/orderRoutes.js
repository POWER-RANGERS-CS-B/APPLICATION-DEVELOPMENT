const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate, allowRoles } = require("../middleware/auth");

const requiredHandlers = {
  createOrder: orderController.createOrder,
  getPendingPaymentOrders: orderController.getPendingPaymentOrders,
  getDineInPaymentRequests: orderController.getDineInPaymentRequests,
  getPendingDineInRefunds: orderController.getPendingDineInRefunds,
  getDineInRefunds: orderController.getDineInRefunds,
  confirmPayment: orderController.confirmPayment,
  rejectPayment: orderController.rejectPayment,
  getCustomerPaymentStatus: orderController.getCustomerPaymentStatus,
  getReceipt: orderController.getReceipt,
  getCategorySales: orderController.getCategorySales,
  getKdsOrders: orderController.getKdsOrders,
  getOrderHistory: orderController.getOrderHistory,
  getTodayIncome: orderController.getTodayIncome,
  updateStatus: orderController.updateStatus,
  deleteOrder: orderController.deleteOrder,
};

for (const [name, handler] of Object.entries(requiredHandlers)) {
  if (typeof handler !== "function") {
    throw new TypeError(`orderController.${name} is not a function`);
  }
}

router.post("/", authenticate, allowRoles("customer"), requiredHandlers.createOrder);
router.get("/receipt", requiredHandlers.getReceipt);
router.get(
  "/pending-verification",
  authenticate,
  allowRoles("admin"),
  requiredHandlers.getPendingPaymentOrders
);
router.get(
  "/payment-requests",
  authenticate,
  allowRoles("admin"),
  requiredHandlers.getDineInPaymentRequests
);
router.get(
  "/refunds",
  authenticate,
  allowRoles("admin"),
  requiredHandlers.getDineInRefunds
);
router.get(
  "/refunds/pending",
  authenticate,
  allowRoles("admin"),
  requiredHandlers.getPendingDineInRefunds
);
router.patch(
  "/:id/payment/confirm",
  authenticate,
  allowRoles("admin"),
  requiredHandlers.confirmPayment
);
router.patch(
  "/:id/payment/reject",
  authenticate,
  allowRoles("admin"),
  requiredHandlers.rejectPayment
);
router.get(
  "/:id/payment-status",
  authenticate,
  allowRoles("customer"),
  requiredHandlers.getCustomerPaymentStatus
);
router.get("/category-sales", authenticate, allowRoles("admin"), requiredHandlers.getCategorySales);
router.get("/kds", authenticate, allowRoles("admin", "staff", "cashier"), requiredHandlers.getKdsOrders);
router.get("/history", authenticate, allowRoles("admin"), requiredHandlers.getOrderHistory);
router.get("/income/today", authenticate, allowRoles("admin"), requiredHandlers.getTodayIncome);
router.patch("/:id/status", authenticate, allowRoles("admin", "staff", "cashier"), requiredHandlers.updateStatus);
router.delete("/:id", authenticate, allowRoles("admin"), requiredHandlers.deleteOrder);

module.exports = router;