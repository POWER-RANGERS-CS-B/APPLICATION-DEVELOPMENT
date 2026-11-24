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
const acceptedImageTypes = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (acceptedImageTypes.get(extension) !== file.mimetype) {
      const error = new Error("Only supported image files can be uploaded.");
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

// Anyone can view the menu items list
router.get("/", menuController.getMenu);

// Secure Admin-Only Paths for handling structural changes
router.post("/", authenticate, allowRoles("admin"), upload.single("image"), menuController.createMenuItem);
router.put("/:id", authenticate, allowRoles("admin"), upload.single("image"), menuController.updateMenuItem);
router.delete("/:id", authenticate, allowRoles("admin"), menuController.softDeleteMenuItem);

module.exports = router; 