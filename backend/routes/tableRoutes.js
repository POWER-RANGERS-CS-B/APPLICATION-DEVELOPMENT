const express = require("express");
const router = express.Router();
const tableController = require("../controllers/tableController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.get("/", tableController.getTables);
router.patch("/:id/needs-cleaning", authenticate, allowRoles("admin", "staff"), tableController.markNeedsCleaning);
router.patch("/:id/start-cleaning", authenticate, allowRoles("admin", "staff"), tableController.startCleaning);
router.patch("/:id/clean", authenticate, allowRoles("admin", "staff"), tableController.cleanTable);

module.exports = router;
