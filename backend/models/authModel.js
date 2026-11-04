const db = require("../config/db");

exports.findByEmail = async (email) => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.users
     WHERE lower(email) = lower($1)
       AND role IN ('admin', 'staff')
       AND deleted_at IS NULL`,
    [email]
  );

  return result.rows[0];
};