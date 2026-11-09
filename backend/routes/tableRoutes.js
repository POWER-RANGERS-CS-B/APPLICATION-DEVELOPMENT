const express = require("express");
const router = express.Router();
const tableController = require("../controllers/tableController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.get("/", tableController.getTables);
<<<<<<< HEAD
router.patch("/:id/clean", authenticate, allowRoles("admin", "staff"), tableController.cleanTable);
=======
router.patch("/:id/occupy", authenticate, allowRoles("admin", "staff", "cashier"), tableController.markOccupiedForWalkIn);
router.patch("/:id/needs-cleaning", authenticate, allowRoles("admin", "staff", "cashier"), tableController.markNeedsCleaning);
router.patch("/:id/start-cleaning", authenticate, allowRoles("admin", "staff", "cashier"), tableController.startCleaning);
router.patch("/:id/clean", authenticate, allowRoles("admin", "staff", "cashier"), tableController.cleanTable);
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

module.exports = router;
