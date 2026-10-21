const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { authenticate, allowRoles } = require("../middleware/auth");

router.get("/", authenticate, menuController.getMenu);
router.delete("/:id", authenticate, allowRoles("admin"), menuController.deleteMenuItem);

module.exports = router;
