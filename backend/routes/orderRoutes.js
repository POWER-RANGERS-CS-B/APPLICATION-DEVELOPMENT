const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.post("/", authenticate, allowRoles("customer"), orderController.createOrder);

router.get("/receipt", orderController.getReceipt);

router.get("/kds", authenticate, allowRoles("admin", "staff"), orderController.getKdsOrders);

router.get("/history", authenticate, allowRoles("admin"), orderController.getOrderHistory);

router.get("/income/today", authenticate, allowRoles("admin"), orderController.getTodayIncome);

router.patch("/:id/status", authenticate, allowRoles("admin", "staff"), orderController.updateStatus);

router.delete("/:id", authenticate, allowRoles("admin"), orderController.deleteOrder);
router.get("/history", authenticate, allowRoles("admin"), orderController.getOrderHistory);
router.get("/income/today", authenticate, allowRoles("admin"), orderController.getTodayIncome);

module.exports = router;