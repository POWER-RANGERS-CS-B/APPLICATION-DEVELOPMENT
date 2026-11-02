const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authModel = require("../models/authModel");

// Helper function to validate allowed email domains
const isValidEmailDomain = (email) => {
  if (!email) return false;
  
  // PASTED HERE: Allows ANY domain as long as it has a valid format (e.g., text@domain.suffix)
  const domainRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  return domainRegex.test(email.trim());
};

exports.signup = async (req, res) => {
  try {
    const { email } = req.body;

    // Reject signup if email is completely missing or lacks a valid @domain.suffix structure
    if (!isValidEmailDomain(email)) {
      return res.status(400).json({ 
        message: "Invalid email format. Please provide a complete email address (e.g., user@example.com)." 
      });
    }

    const user = await authModel.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Reject login if email lacks a valid @domain.suffix structure
    if (!isValidEmailDomain(email)) {
      return res.status(400).json({ 
        message: "Invalid email format. Please log in using a complete email address (e.g., user@example.com)." 
      });
    }

    const user = await authModel.findByEmail(email.trim());

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
