const db = require("../config/db");
const auditService = require("../services/auditService");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.restaurant_tables
     WHERE deleted_at IS NULL
     ORDER BY id`
  );
  return result.rows;
};

exports.markCleaned = async (tableId, actor) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const tableResult = await client.query(
      "SELECT id, status FROM restaurant.restaurant_tables WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [tableId]
    );
    const table = tableResult.rows[0];
    if (!table) {
      throw new Error("Table not found.");
    }

    const chairsResult = await client.query(
      `SELECT id, status
       FROM restaurant.chairs
       WHERE table_id = $1 AND deleted_at IS NULL
       ORDER BY id
       FOR UPDATE`,
      [tableId]
    );

    const reservationsResult = await client.query(
      `SELECT id, status
       FROM restaurant.reservations
       WHERE table_id = $1 AND status = 'active' AND deleted_at IS NULL
       ORDER BY id
       FOR UPDATE`,
      [tableId]
    );

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

    await auditService.insert(client, {
      userId: actor?.id || null,
      actorName: actor?.email || null,
      action: "TABLE_CLEANED",
      module: "tables",
      entityId: table.id,
      previousValues: {
        table_status: table.status,
        chairs: chairsResult.rows,
        active_reservations: reservationsResult.rows,
      },
      newValues: {
        table_status: "vacant",
        chairs: chairsResult.rows.map(({ id }) => ({ id, status: "vacant" })),
        completed_reservation_ids: reservationsResult.rows.map(({ id }) => id),
      },
    });

    await client.query("COMMIT");
    return { message: "Table cleaned and chairs reset to vacant." };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};