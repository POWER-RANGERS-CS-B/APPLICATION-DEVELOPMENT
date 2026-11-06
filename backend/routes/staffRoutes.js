const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.get("/kds", authenticate, allowRoles("staff", "admin"), staffController.getKitchenDisplay);

module.exports = router;
