const express = require("express");
const router = express.Router();
const chairController = require("../controllers/chairController");

router.get("/", chairController.getChairs);
router.post("/lock", chairController.lockTable);

module.exports = router;
