const userModel = require("../models/userModel");

exports.getEmployees = async (req, res) => {
  try {
    res.json(await userModel.findEmployees());
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    res.status(500).json({ message: "Failed to fetch employees." });
  }
};

exports.toggleStaffStatus = async (req, res) => {
  if (String(req.user.id) === req.params.id) {
    return res.status(400).json({ message: "You cannot suspend your own account." });
  }

  try {
    const user = await userModel.toggleStaffStatus(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    res.json(user);
  } catch (error) {
    console.error("Failed to update staff status:", error);
    res.status(500).json({ message: "Failed to update staff status." });
  }
};
