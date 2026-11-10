const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { rateLimit } = require("express-rate-limit");
const { authenticate } = require("../middleware/auth");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." },
});
router.post("/login", loginLimiter, authController.login);
router.get("/session", authenticate, authController.getSession);
router.post("/logout", authController.logout);

module.exports = router;
