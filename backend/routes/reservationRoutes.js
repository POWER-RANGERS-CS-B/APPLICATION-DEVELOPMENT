const express = require("express");
const router = express.Router();
const reservationController = require("../controllers/reservationController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.post(
    "/",
    authenticate,
    allowRoles("customer", "admin"),
    reservationController.createReservation
);

router.get(
    "/",
    authenticate,
    allowRoles("admin", "staff"),
    reservationController.getReservations
);

router.patch(
    "/:id/status",
    authenticate,
    allowRoles("admin", "staff"),
    reservationController.updateReservationStatus
);

module.exports = router;
