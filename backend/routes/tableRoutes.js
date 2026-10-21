const express = require("express");
const router = express.Router();
const tableController = require("../controllers/tableController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.get("/", authenticate, tableController.getTables);
router.patch("/:id/clean", authenticate, allowRoles("admin", "staff"), tableController.cleanTable);

module.exports = router;
