const express = require("express");
const customerController = require("../controllers/customerController");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, allowRoles("customer"));

router.get("/profile", customerController.getProfile);
router.patch("/profile", customerController.updateProfile);
router.patch("/settings", customerController.updateSettings);
router.get("/reservations/:id", customerController.getReservation);
router.get("/notifications", customerController.listNotifications);
router.patch("/notifications/read-all", customerController.markAllNotificationsRead);
router.patch("/notifications/:id/read", customerController.markNotificationRead);
router.delete("/notifications/:id", customerController.deleteNotification);

module.exports = router;
