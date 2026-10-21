const express = require("express");
const router = express.Router();
const chairController = require("../controllers/chairController");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, chairController.getChairs);
router.post("/lock", authenticate, chairController.lockChairs);

module.exports = router;
