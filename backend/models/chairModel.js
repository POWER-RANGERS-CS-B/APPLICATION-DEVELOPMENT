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

exports.lockChairs = async (chairIds) => {
  const result = await db.query(
    `UPDATE chairs
     SET status = 'locked',
         locked_until = NOW() + INTERVAL '10 minutes',
         updated_at = NOW()
     WHERE id = ANY($1::int[])
       AND status = 'vacant'
       AND deleted_at IS NULL
     RETURNING *`,
    [chairIds]
  );

  try {
    await client.query("BEGIN");

    // Atomically claim a vacant table. Concurrent requests can only have one winner.
    const tableResult = await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'reserved', updated_at = NOW()
       WHERE id = $1
         AND deleted_at IS NULL
         AND status = 'vacant'
       RETURNING id`,
      [tableId]
    );

    if (!tableResult.rows[0]) {
      throw new Error("This table is no longer available. Please choose another table.");
    }

    const chairsResult = await client.query(
      `SELECT id, status
       FROM restaurant.chairs
       WHERE table_id = $1 AND deleted_at IS NULL
       ORDER BY id
       FOR UPDATE`,
      [tableId]
    );

    if (!chairsResult.rows.length || chairsResult.rows.some((chair) => chair.status !== "vacant")) {
      throw new Error("This table is no longer available. Please choose another table.");
    }

    // Lock all chairs belonging to this table.
    const lockResult = await client.query(
      `UPDATE restaurant.chairs
       SET status = 'reserved',
           locked_until = NOW() + INTERVAL '2 minutes'
       WHERE table_id = $1
         AND deleted_at IS NULL
         AND status = 'vacant'
       RETURNING *`,
      [tableId]
    );

    if (lockResult.rowCount !== chairsResult.rows.length) {
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

  return result.rows;
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

    await client.query(
      `UPDATE restaurant.chairs c
       SET status = 'vacant', locked_until = NULL, updated_at = NOW()
       WHERE c.deleted_at IS NULL
         AND c.status = 'occupied'
         AND EXISTS (
           SELECT 1
           FROM restaurant.reservations cancelled
           WHERE cancelled.table_id = c.table_id
             AND cancelled.status = 'cancelled'
             AND cancelled.deleted_at IS NULL
         )
         AND NOT EXISTS (
           SELECT 1
           FROM restaurant.reservations checked_in
           WHERE checked_in.table_id = c.table_id
             AND checked_in.status = 'checked_in'
             AND checked_in.deleted_at IS NULL
         )`
    );

    // Release expired temporary holds; checked-in guests keep their occupied chairs.
    const releasedChairs = await client.query(
      `UPDATE restaurant.chairs
       SET status = 'vacant',
           locked_until = NULL,
           updated_at = NOW()
       WHERE status = 'reserved'
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
