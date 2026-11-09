const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

router.post("/login", authController.login);
router.post("/register", authController.registerCustomer);
router.post("/logout", authenticate, authController.logout);

module.exports = router;
