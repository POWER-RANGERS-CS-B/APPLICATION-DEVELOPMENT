const db = require("../config/db");

exports.findAll = async ({ reservationDate = null, reservationTime = null } = {}) => {
  await db.query(
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
  await db.query(
    `UPDATE restaurant.restaurant_tables t
     SET status = 'vacant', updated_at = NOW()
     WHERE t.deleted_at IS NULL
      AND t.status = 'occupied'
      AND EXISTS (
         SELECT 1
         FROM restaurant.reservations cancelled
         WHERE cancelled.table_id = t.id
           AND cancelled.status = 'cancelled'
           AND cancelled.deleted_at IS NULL
       )
       AND NOT EXISTS (
         SELECT 1
         FROM restaurant.reservations checked_in
         WHERE checked_in.table_id = t.id
           AND checked_in.status = 'checked_in'
           AND checked_in.deleted_at IS NULL
       )`
  );

  const result = await db.query(
    `SELECT t.*,
       CASE
         WHEN $1::date IS NOT NULL AND $2::time IS NOT NULL AND EXISTS (
           SELECT 1
           FROM restaurant.reservations r
           WHERE r.table_id = t.id
             AND r.deleted_at IS NULL
             AND r.status IN ('active', 'confirmed', 'checked_in')
             AND r.reservation_date = $1::date
             AND r.reservation_time = $2::time
         ) THEN 'reserved'
         ELSE t.status
       END AS effective_status
     FROM restaurant.restaurant_tables t
     WHERE t.deleted_at IS NULL
     ORDER BY t.id`,
    [reservationDate, reservationTime]
  );

  return result.rows;
};

exports.markCleaned = async (tableId) => {
  const parsedTableId = Number(tableId);
  if (!Number.isSafeInteger(parsedTableId) || parsedTableId <= 0) {
    throw new Error("A valid table ID is required.");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Reset table status to vacant
    const tableResult = await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'vacant', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [parsedTableId]
    );

    if (!tableResult.rowCount) {
      throw new Error(`Table #${parsedTableId} was not found.`);
    }

    // Reset all chairs belonging to this table to vacant
    await client.query(
      `UPDATE chairs
       SET status = 'vacant', locked_until = NULL, updated_at = NOW()
       WHERE table_id = $1`,
      [parsedTableId]
    );

    await client.query(
      `UPDATE reservations
       SET status = 'finished', updated_at = NOW()
       WHERE table_id = $1
         AND status = 'active'`,
      [parsedTableId]
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
