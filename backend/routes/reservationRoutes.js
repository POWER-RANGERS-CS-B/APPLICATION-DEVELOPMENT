const express = require("express");
const router = express.Router();
const reservationController = require("../controllers/reservationController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.post(
    "/",
<<<<<<< HEAD
=======
    authenticate,
    allowRoles("customer"),
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
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

<<<<<<< HEAD
router.patch(
    "/:id/status",
    authenticate,
    allowRoles("admin", "staff"),
    reservationController.updateReservationStatus
);

module.exports = router;
=======
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
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
