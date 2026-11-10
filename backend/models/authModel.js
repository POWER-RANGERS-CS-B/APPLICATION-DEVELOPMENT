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

exports.revokeToken = async (userId, tokenId, expiresAt) => {
  await db.query(
    "DELETE FROM restaurant.revoked_auth_tokens WHERE expires_at <= NOW()"
  );
  await db.query(
    `INSERT INTO restaurant.revoked_auth_tokens (token_id, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_id) DO NOTHING`,
    [tokenId, userId, expiresAt]
  );
};

exports.isTokenRevoked = async (tokenId) => {
  const result = await db.query(
    `SELECT 1
     FROM restaurant.revoked_auth_tokens
     WHERE token_id = $1 AND expires_at > NOW()
     LIMIT 1`,
    [tokenId]
  );
  return result.rowCount > 0;
};

exports.findActiveAccount = async (userId) => {
  const result = await db.query(
    `SELECT id, email, role
     FROM restaurant.users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return result.rows[0] || null;
};
