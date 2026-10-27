const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authRateLimiter } = require("../middleware/rateLimiters");

router.post("/signup", authRateLimiter, authController.signup);
router.post("/login", authRateLimiter, authController.login);

module.exports = router;
