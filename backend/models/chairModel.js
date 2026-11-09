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

<<<<<<< HEAD
exports.lockTable = async (tableId) => {
=======
exports.lockTable = async (tableId, actor) => {
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  const client = await db.connect();

  try {
    await client.query("BEGIN");

<<<<<<< HEAD
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
=======
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
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    const lockResult = await client.query(
      `UPDATE restaurant.chairs
       SET status = 'reserved',
           locked_until = NOW() + INTERVAL '2 minutes'
       WHERE table_id = $1
         AND deleted_at IS NULL
<<<<<<< HEAD
         AND status = 'vacant'
=======
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
       RETURNING *`,
      [tableId]
    );

<<<<<<< HEAD
    if (lockResult.rowCount !== chairsResult.rows.length) {
      throw new Error("This table is no longer available. Please choose another table.");
    }
=======
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
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

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

<<<<<<< HEAD
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
=======
    // Only temporary reservations expire; occupied chairs are cleared by staff.
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    const releasedChairs = await client.query(
      `UPDATE restaurant.chairs
       SET status = 'vacant',
           locked_until = NULL,
           updated_at = NOW()
       WHERE status = 'reserved'
         AND (locked_until IS NULL OR locked_until < NOW())
       RETURNING table_id`
    );

<<<<<<< HEAD
    // Free up the corresponding tables as well
    const tableResult = await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'vacant', updated_at = NOW()
       WHERE status IN ('reserved', 'occupied')
         AND id NOT IN (
           SELECT DISTINCT table_id FROM restaurant.chairs WHERE status != 'vacant'
         )
       RETURNING id`
=======
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
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    );

    await client.query("COMMIT");
    return releasedChairs.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
<<<<<<< HEAD
};
=======
};
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
