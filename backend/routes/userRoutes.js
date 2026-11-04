const express = require("express");
const userController = require("../controllers/userController");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, allowRoles("admin"), userController.getEmployees);
router.post("/", authenticate, allowRoles("admin"), userController.createStaff);
router.put("/:id", authenticate, allowRoles("admin"), userController.updateStaff);
router.patch(
  "/:id/status",
  authenticate,
  allowRoles("admin"),
  userController.setStaffStatus
);

module.exports = router;
