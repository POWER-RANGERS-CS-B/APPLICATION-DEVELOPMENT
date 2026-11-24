const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { rateLimit } = require("express-rate-limit");

const authAttemptRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please try again later." },
});

router.post("/login", authAttemptRateLimit, authController.login);
router.post("/register", authAttemptRateLimit, authController.registerCustomer);
router.get("/google/client-id", authController.googleClientConfig);
router.post("/google", authAttemptRateLimit, authController.googleAuth);
router.post("/logout", authenticate, authController.logout);

module.exports = router;
