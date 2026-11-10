const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

router.post("/login", authController.login);
router.post("/register", authController.registerCustomer);
router.get("/google/client-id", authController.googleClientConfig);
router.post("/google", authController.googleAuth);
router.post("/logout", authenticate, authController.logout);

module.exports = router;
