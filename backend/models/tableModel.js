const db = require("../config/db");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM restaurant_tables
     WHERE deleted_at IS NULL
     ORDER BY id`
  );

  return result.rows;
};

exports.markCleaned = async (tableId) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE restaurant_tables
       SET status = 'vacant', updated_at = NOW()
       WHERE id = $1`,
      [tableId]
    );

    await client.query(
      `UPDATE chairs
       SET status = 'vacant', locked_until = NULL, updated_at = NOW()
       WHERE table_id = $1`,
      [tableId]
    );

    await client.query(
      `UPDATE reservations
       SET status = 'finished', updated_at = NOW()
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
