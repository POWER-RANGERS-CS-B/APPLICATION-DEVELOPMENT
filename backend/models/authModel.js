const db = require("../config/db");

exports.findByEmail = async (email) => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.users
     WHERE lower(email) = lower($1)
       AND deleted_at IS NULL`,
    [email]
  );

  return result.rows[0];
};

exports.createCustomer = async ({ fullName, email, contactNumber, passwordHash }) => {
  try {
    return await db.query(
      `INSERT INTO restaurant.users
         (full_name, username, email, password_hash, role, contact_number)
       VALUES ($1, $2, $2, $3, 'customer', $4)
       RETURNING id, full_name, email, contact_number, role`,
      [fullName, email, passwordHash, contactNumber]
    ).then((result) => result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      const conflict = new Error("An account with this email address already exists.");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
};

exports.revokeToken = async (userId, tokenId, expiresAt) => {
  await db.query(
    `INSERT INTO restaurant.revoked_auth_tokens (token_id, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_id) DO NOTHING`,
    [tokenId, userId, expiresAt]
  );
};