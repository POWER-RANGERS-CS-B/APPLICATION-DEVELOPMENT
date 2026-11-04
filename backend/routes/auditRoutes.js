const express = require("express");
const auditController = require("../controllers/auditController");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, allowRoles("admin"), auditController.getAuditLogs);

module.exports = router;
