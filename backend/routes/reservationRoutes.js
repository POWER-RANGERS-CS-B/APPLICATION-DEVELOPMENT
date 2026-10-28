const express = require("express");
const router = express.Router();
const reservationController = require("../controllers/reservationController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.post(
    "/",
    reservationController.createReservation
);

router.get(
    "/",
    authenticate,
    allowRoles("admin", "staff"),
    reservationController.getReservations
);

module.exports = router;