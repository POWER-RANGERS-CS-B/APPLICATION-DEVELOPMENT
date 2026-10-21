const db = require("../config/db");

exports.getDeletedRecords = async () => {
  const result = await db.query(
    `SELECT 'orders' AS source, id, deleted_at FROM orders WHERE deleted_at IS NOT NULL
     UNION ALL
     SELECT 'menu_items' AS source, id, deleted_at FROM menu_items WHERE deleted_at IS NOT NULL
     UNION ALL
     SELECT 'users' AS source, id, deleted_at FROM users WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC`
  );

  return result.rows;
};
