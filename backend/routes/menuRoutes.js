const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { authenticate, allowRoles } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

// Configure storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../frontend/images/menu-images"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Anyone can view the menu items list
router.get("/", menuController.getMenu);

// Secure Admin-Only Paths for handling structural changes
router.post("/", authenticate, allowRoles("admin"), upload.single("image"), menuController.createMenuItem);
router.put("/:id", authenticate, allowRoles("admin"), upload.single("image"), menuController.updateMenuItem);
router.delete("/:id", authenticate, allowRoles("admin"), menuController.softDeleteMenuItem);

module.exports = router; 