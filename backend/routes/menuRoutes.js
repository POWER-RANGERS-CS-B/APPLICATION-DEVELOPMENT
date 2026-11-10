const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { authenticate, allowRoles } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const { randomUUID } = require("node:crypto");

const extensionByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Configure storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../frontend/images/menu-images"));
  },
  filename: (req, file, cb) => {
    cb(null, randomUUID() + extensionByMimeType[file.mimetype]);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const expectedExtension = extensionByMimeType[file.mimetype];
    if (!expectedExtension || path.extname(file.originalname).toLowerCase() !== expectedExtension) {
      return cb(new Error("Upload a JPG, PNG, or WebP image."));
    }
    return cb(null, true);
  },
});

// Anyone can view the menu items list
router.get("/", menuController.getMenu);

// Secure Admin-Only Paths for handling structural changes
router.post("/", authenticate, allowRoles("admin"), upload.single("image"), menuController.createMenuItem);
router.put("/:id", authenticate, allowRoles("admin"), upload.single("image"), menuController.updateMenuItem);
router.delete("/:id", authenticate, allowRoles("admin"), menuController.softDeleteMenuItem);

module.exports = router; 
