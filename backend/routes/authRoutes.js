const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.post("/signup", authController.signup);
router.post("/staff", authenticate, allowRoles("admin"), authController.createStaff);
router.post("/login", authController.login);

module.exports = router;
