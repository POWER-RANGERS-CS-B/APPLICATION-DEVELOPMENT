const db = require("../config/db");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM menu_items
     WHERE deleted_at IS NULL
     ORDER BY category, item_name`
  );

  return result.rows;
};

exports.softDelete = async (id) => {
  const result = await db.query(
    `UPDATE menu_items
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return result.rows[0];
};
