const db = require("../config/db");

<<<<<<< HEAD
exports.createUser = async ({ fullName, email, password, role = "customer" }) => {
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.query(
    `INSERT INTO restaurant.users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, full_name, email, role`,
    [fullName, email, passwordHash, role]
  );

  return result.rows[0];
};

=======
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
exports.findByEmail = async (email) => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.users
<<<<<<< HEAD
     WHERE email = $1
=======
     WHERE lower(email) = lower($1)
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
       AND deleted_at IS NULL`,
    [email]
  );

  return result.rows[0];
<<<<<<< HEAD
=======
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
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
};