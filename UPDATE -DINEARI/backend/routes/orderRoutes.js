const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate, allowRoles } = require("../middleware/auth");

const requiredHandlers = {
  createOrder: orderController.createOrder,
  getReceipt: orderController.getReceipt,
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

router.post("/", requiredHandlers.createOrder);
router.get("/receipt", requiredHandlers.getReceipt);
router.get("/kds", authenticate, allowRoles("admin", "staff"), requiredHandlers.getKdsOrders);
router.get("/history", authenticate, allowRoles("admin"), requiredHandlers.getOrderHistory);
router.get("/income/today", authenticate, allowRoles("admin"), requiredHandlers.getTodayIncome);
router.patch("/:id/status", authenticate, allowRoles("admin", "staff"), requiredHandlers.updateStatus);
router.delete("/:id", authenticate, allowRoles("admin"), requiredHandlers.deleteOrder);

module.exports = router;