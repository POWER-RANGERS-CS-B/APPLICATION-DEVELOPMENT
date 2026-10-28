const bcrypt = require("bcryptjs");
const db = require("../config/db");

exports.createUser = async ({ fullName, email, password }) => {
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.query(
    `INSERT INTO restaurant.users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, full_name, email, role`,
    [fullName, email, passwordHash, "customer"]
  );

  return result.rows[0];
};

exports.findByEmail = async (email) => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.users
     WHERE email = $1
       AND deleted_at IS NULL`,
    [email]
  );

  return result.rows[0];
};