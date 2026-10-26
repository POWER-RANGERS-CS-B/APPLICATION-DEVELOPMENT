const db = require("../config/db");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.chairs
     WHERE deleted_at IS NULL
     ORDER BY id`
  );
  return result.rows;
};

exports.lockTable = async (tableId) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Check if the table itself exists and is vacant
    const tableResult = await client.query(
      `SELECT id, status
       FROM restaurant.restaurant_tables
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [tableId]
    );
    const table = tableResult.rows[0];

    if (!table) {
      throw new Error("Selected table does not exist.");
    }
    if (table.status !== "vacant") {
      throw new Error("This table is no longer available. Please choose another table.");
    }

    // 2. Update the table status to 'reserved' (which matches the database check constraint)
    await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'reserved', updated_at = NOW()
       WHERE id = $1`,
      [tableId]
    );

    // 3. Lock all chairs belonging to this table
    const lockResult = await client.query(
      `UPDATE restaurant.chairs
       SET status = 'reserved',
           locked_until = NOW() + INTERVAL '2 minutes', // Changed from 10 minutes to 2 minutes
           updated_at = NOW()
       WHERE table_id = $1
         AND deleted_at IS NULL
       RETURNING *`,
      [tableId]
    );

    await client.query("COMMIT");
    return lockResult.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.releaseExpiredLocks = async () => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Release expired or stale chair locks
    const releasedChairs = await client.query(
      `UPDATE restaurant.chairs
       SET status = 'vacant',
           locked_until = NULL,
           updated_at = NOW()
       WHERE status IN ('reserved', 'occupied')
         AND (locked_until IS NULL OR locked_until < NOW())
       RETURNING table_id`
    );

    // Free up the corresponding tables as well
    const tableResult = await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'vacant', updated_at = NOW()
       WHERE status IN ('reserved', 'occupied')
         AND id NOT IN (
           SELECT DISTINCT table_id FROM restaurant.chairs WHERE status != 'vacant'
         )
       RETURNING id`
    );

    await client.query("COMMIT");
    return releasedChairs.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};