const express = require("express");
const userController = require("../controllers/userController");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, allowRoles("admin"), userController.getEmployees);
router.patch(
  "/:id/status",
  authenticate,
  allowRoles("admin"),
  userController.toggleStaffStatus
);

module.exports = router;
