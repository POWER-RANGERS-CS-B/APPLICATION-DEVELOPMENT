const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.get("/kds", authenticate, allowRoles("staff", "cashier", "admin"), staffController.getKitchenDisplay);
router.post("/arrival/validate", authenticate, allowRoles("staff", "cashier", "admin"), staffController.validateArrivalQr);
router.post("/arrival/confirm", authenticate, allowRoles("staff", "cashier", "admin"), staffController.confirmArrival);
router.get("/refunds/late-arrivals", authenticate, allowRoles("cashier"), staffController.getLateArrivalRefunds);
router.patch("/refunds/late-arrivals/:id/process", authenticate, allowRoles("cashier"), staffController.startLateArrivalRefundProcessing);
router.patch("/refunds/late-arrivals/:id/complete", authenticate, allowRoles("cashier"), staffController.completeLateArrivalRefund);

module.exports = router;
