const bcrypt = require("bcryptjs");
const db = require("../config/db");

exports.createUser = async ({ fullName, email, password }) => {
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, 'customer')
     RETURNING id, full_name, email, role`,
    [fullName, email, passwordHash]
  );

  return result.rows[0];
};

exports.findByEmail = async (email) => {
  const result = await db.query(
    `SELECT *
     FROM users
     WHERE email = $1
       AND deleted_at IS NULL`,
    [email]
  );

  return result.rows[0];
};
