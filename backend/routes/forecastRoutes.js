const express = require("express");
const forecastController = require("../controllers/forecastController");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();
const adminOnly = [authenticate, allowRoles("admin")];

router.get("/reservations", ...adminOnly, forecastController.getForecast);
router.post(
  "/reservations/generate",
  ...adminOnly,
  forecastController.generateForecast
);

module.exports = router;
