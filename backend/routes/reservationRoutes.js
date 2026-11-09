const express = require("express");
const router = express.Router();
const reservationController = require("../controllers/reservationController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.post(
    "/",
    authenticate,
    allowRoles("customer"),
    reservationController.createReservation
);

router.get(
    "/status/:token",
    reservationController.getReservationStatus
);

router.patch(
    "/status/:token/payment",
    reservationController.resubmitReservationPayment
);

router.post(
    "/verify/:code",
    authenticate,
    allowRoles("admin", "staff"),
    reservationController.validateReservationReceipt
);

router.get(
    "/",
    authenticate,
    allowRoles("admin"),
    reservationController.getReservations
);

router.delete(
    "/:id",
    authenticate,
    allowRoles("admin"),
    reservationController.archiveHistoricalReservation
);

router.patch(
    "/:id/confirm",
    authenticate,
    allowRoles("admin"),
    reservationController.confirmReservation
);

router.patch(
    "/:id/verify",
    authenticate,
    allowRoles("admin"),
    reservationController.confirmReservation
);

router.patch(
    "/:id/reject",
    authenticate,
    allowRoles("admin"),
    reservationController.rejectReservation
);

module.exports = router;