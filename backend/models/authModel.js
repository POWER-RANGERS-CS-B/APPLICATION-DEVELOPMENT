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

exports.findCustomerByGoogleSub = async (googleSub) => {
  const result = await db.query(
    `SELECT id, full_name, email, contact_number, role,
            google_sub, google_full_name, google_picture_url
     FROM restaurant.users
     WHERE google_sub = $1
       AND role = 'customer'
       AND deleted_at IS NULL`,
    [googleSub]
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

exports.createGoogleCustomer = async ({
  fullName,
  email,
  passwordHash,
  googleSub,
  googleFullName,
  googlePictureUrl,
}) => {
  try {
    const result = await db.query(
      `INSERT INTO restaurant.users
         (full_name, username, email, password_hash, role, contact_number,
          google_sub, google_full_name, google_picture_url)
       VALUES ($1, $2, $2, $3, 'customer', NULL, $4, $5, $6)
       RETURNING id, full_name, email, contact_number, role,
                 google_sub, google_full_name, google_picture_url`,
      [fullName, email, passwordHash, googleSub, googleFullName, googlePictureUrl]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      const conflict = new Error("This Google account or email is already linked to a customer account.");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
};

exports.updateGoogleCustomerProfile = async ({
  userId,
  googleSub,
  googleFullName,
  googlePictureUrl,
}) => {
  try {
    const result = await db.query(
      `UPDATE restaurant.users
       SET google_sub = $2,
           google_full_name = $3,
           google_picture_url = $4,
           updated_at = NOW()
       WHERE id = $1
         AND role = 'customer'
         AND deleted_at IS NULL
         AND google_sub = $2
       RETURNING id, full_name, email, contact_number, role,
                 google_sub, google_full_name, google_picture_url`,
      [userId, googleSub, googleFullName, googlePictureUrl]
    );
    if (!result.rows[0]) {
      const error = new Error("The linked Google customer account could not be found.");
      error.statusCode = 401;
      throw error;
    }
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      const conflict = new Error("This Google account is already linked to another customer.");
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