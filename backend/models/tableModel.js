const db = require("../config/db");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.restaurant_tables
     WHERE deleted_at IS NULL
     ORDER BY id`
  );
  return result.rows;
};

exports.markCleaned = async (tableId) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Reset table status to vacant
    await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'vacant', updated_at = NOW()
       WHERE id = $1`,
      [tableId]
    );

    // Reset all chairs belonging to this table to vacant
    await client.query(
      `UPDATE restaurant.chairs
       SET status = 'vacant', locked_until = NULL, updated_at = NOW()
       WHERE table_id = $1`,
      [tableId]
    );

    // Complete active reservations for this table using a valid constraint status ('completed')
    await client.query(
      `UPDATE restaurant.reservations
       SET status = 'completed', updated_at = NOW()
       WHERE table_id = $1
         AND status = 'active'`,
      [tableId]
    );

    await client.query("COMMIT");
    return { message: "Table cleaned and chairs reset to vacant." };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};