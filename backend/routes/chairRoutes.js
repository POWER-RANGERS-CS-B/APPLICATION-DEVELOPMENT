const express = require("express");
const router = express.Router();
const chairController = require("../controllers/chairController");

router.get("/", chairController.getChairs);
<<<<<<< HEAD
router.post("/lock", chairController.lockTable);
=======
router.post("/lock", authenticate, chairController.lockTable);
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

module.exports = router;
