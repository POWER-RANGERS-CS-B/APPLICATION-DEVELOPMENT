const express = require("express");
const router = express.Router();
const chairController = require("../controllers/chairController");
const { rateLimit } = require("express-rate-limit");

const guestTableLockLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many table selection requests. Please try again shortly." },
});

router.get("/", chairController.getChairs);
router.post("/lock", guestTableLockLimiter, chairController.lockTable);

module.exports = router;
