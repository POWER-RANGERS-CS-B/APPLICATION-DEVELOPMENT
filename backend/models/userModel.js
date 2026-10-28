const db = require("../config/db");

exports.findEmployees = async () => {
  const result = await db.query(
    `SELECT id, full_name, email, role, deleted_at
     FROM restaurant.users
     WHERE role IN ('admin', 'staff')
     ORDER BY full_name`
  );

  return result.rows;
};

exports.toggleStaffStatus = async (id) => {
  const result = await db.query(
    `UPDATE restaurant.users
     SET deleted_at = CASE
       WHEN deleted_at IS NULL THEN NOW()
       ELSE NULL
     END
     WHERE id = $1 AND role = 'staff'
     RETURNING id, full_name, email, role, deleted_at`,
    [id]
  );

  return result.rows[0] || null;
};
