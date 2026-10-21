const express = require("express");
const router = express.Router();
const historyController = require("../controllers/historyController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.get("/", authenticate, allowRoles("admin"), historyController.getHistory);

module.exports = router;
