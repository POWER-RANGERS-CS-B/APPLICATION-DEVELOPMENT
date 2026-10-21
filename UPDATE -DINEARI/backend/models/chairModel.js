const db = require("../config/db");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM chairs
     WHERE deleted_at IS NULL
     ORDER BY id`
  );

  return result.rows;
};

exports.lockTable = async (tableId) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const tableResult = await client.query(
      `SELECT id, status
       FROM restaurant_tables
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

    const chairResult = await client.query(
      `SELECT id, status
       FROM chairs
       WHERE table_id = $1 AND deleted_at IS NULL
       ORDER BY id
       FOR UPDATE`,
      [tableId]
    );

    if (!chairResult.rows.length) {
      throw new Error("This table has no seats configured.");
    }
    if (chairResult.rows.some((chair) => chair.status !== "vacant")) {
      throw new Error("This table is no longer available. Please choose another table.");
    }

    const lockResult = await client.query(
      `UPDATE chairs
       SET status = 'locked',
           locked_until = NOW() + INTERVAL '10 minutes',
           updated_at = NOW()
       WHERE table_id = $1
         AND status = 'vacant'
         AND deleted_at IS NULL
       RETURNING *`,
      [tableId]
    );

    if (lockResult.rowCount !== chairResult.rows.length) {
      throw new Error("This table is no longer available. Please choose another table.");
    }

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
  const result = await db.query(
    `UPDATE chairs
     SET status = 'vacant',
         locked_until = NULL,
         updated_at = NOW()
     WHERE status = 'locked'
       AND locked_until < NOW()
     RETURNING *`
  );

  return result.rows;
};