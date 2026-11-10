const db = require("../config/db");
const auditService = require("../services/auditService");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.chairs
     WHERE deleted_at IS NULL
     ORDER BY id`
  );
  return result.rows;
};

exports.lockTable = async (tableId, actor) => {
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
           locked_until = NOW() + INTERVAL '2 minutes'
       WHERE table_id = $1
         AND deleted_at IS NULL
       RETURNING *`,
      [tableId]
    );

    await auditService.insert(client, {
      userId: actor?.id || null,
      actorName: actor?.email || null,
      action: "TABLE_HOLD_CREATED",
      module: "chairs",
      entityId: tableId,
      previousValues: {
        table_status: table.status,
        chairs: lockResult.rows.map(({ id }) => ({ id, status: "vacant" })),
      },
      newValues: {
        table_status: "reserved",
        chairs: lockResult.rows.map(({ id, status, locked_until }) => ({ id, status, locked_until })),
      },
    });

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

    // Only temporary reservations expire; occupied chairs are cleared by staff.
    const releasedChairs = await client.query(
      `UPDATE restaurant.chairs
       SET status = 'vacant',
           locked_until = NULL,
           updated_at = NOW()
       WHERE status = 'reserved'
         AND (locked_until IS NULL OR locked_until < NOW())
       RETURNING table_id`
    );

    const releasedByTable = new Map();
    for (const chair of releasedChairs.rows) {
       const tableId = String(chair.table_id);
       releasedByTable.set(tableId, (releasedByTable.get(tableId) || 0) + 1);
    }

    for (const [tableId, chairCount] of releasedByTable) {
       await auditService.insert(client, {
         actorName: "System",
         action: "CHAIR_HOLD_EXPIRED",
         module: "chairs",
         entityId: tableId,
         newValues: { chair_status: "vacant" },
         details: { released_chair_count: chairCount },
       });
    }

    await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'vacant', updated_at = NOW()
       WHERE status = 'reserved'
         AND NOT EXISTS (
           SELECT 1
           FROM restaurant.chairs
           WHERE chairs.table_id = restaurant_tables.id
             AND chairs.deleted_at IS NULL
             AND chairs.status <> 'vacant'
         )`
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