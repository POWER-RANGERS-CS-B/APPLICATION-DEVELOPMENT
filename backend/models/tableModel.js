const db = require("../config/db");
const auditService = require("../services/auditService");

const TABLE_CLEANING_TRANSITIONS = {
  markNeedsCleaning: {
    from: "occupied",
    to: "needs_cleaning",
    message: "Table marked as needing cleaning.",
    action: "mark this table as needing cleaning",
  },
  startCleaning: {
    from: "needs_cleaning",
    to: "cleaning",
    message: "Cleaning started.",
    action: "start cleaning this table",
  },
  markCleaned: {
    from: "cleaning",
    to: "vacant",
    message: "Table cleaned and chairs reset to vacant.",
    action: "mark this table clean",
  },
};

function createTableError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseTableId(tableId) {
  const parsedId = Number(tableId);
  if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
    throw createTableError("A valid table ID is required.", 400);
  }
  return parsedId;
}

<<<<<<< HEAD
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

=======
exports.findAll = async () => {
  const result = await db.query(
    `SELECT rt.*,
            EXISTS (
              SELECT 1
              FROM restaurant.reservations r
              WHERE r.table_id = rt.id
                AND r.deleted_at IS NULL
                AND r.status IN ('active', 'pending_verification', 'verified', 'confirmed')
                AND (r.reservation_date IS NULL OR r.reservation_date >= CURRENT_DATE)
            ) AS has_active_reservation,
            (
                SELECT COUNT(*)::int
                FROM restaurant.chairs c
                WHERE c.table_id = rt.id AND c.deleted_at IS NULL
            ) AS capacity
     FROM restaurant.restaurant_tables rt
     WHERE rt.deleted_at IS NULL
     ORDER BY rt.id`
  );
  return result.rows;
};

exports.markOccupiedForWalkIn = async (tableId, actor) => {
  const id = parseTableId(tableId);
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  const client = await db.connect();

  try {
    await client.query("BEGIN");

<<<<<<< HEAD
    // Reset table status to vacant
    const tableResult = await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'vacant', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [parsedTableId]
=======
    const tableResult = await client.query(
      `SELECT id, table_name, status
       FROM restaurant.restaurant_tables
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    );
    const table = tableResult.rows[0];
    if (!table) {
      throw createTableError("Table not found.", 404);
    }

<<<<<<< HEAD
    if (!tableResult.rowCount) {
      throw new Error(`Table #${parsedTableId} was not found.`);
    }

    // Reset all chairs belonging to this table to vacant
    await client.query(
      `UPDATE restaurant.chairs
       SET status = 'vacant', locked_until = NULL, updated_at = NOW()
       WHERE table_id = $1`,
      [parsedTableId]
    );

    // Complete active reservations for this table using a valid constraint status ('completed')
    await client.query(
      `UPDATE restaurant.reservations
       SET status = 'completed', updated_at = NOW()
       WHERE table_id = $1
         AND status = 'active'`,
      [parsedTableId]
=======
    if (table.status !== "vacant") {
      const message = ["reserved", "locked"].includes(table.status)
        ? "This table is reserved or held and cannot be occupied manually."
        : `Cannot occupy this table while its status is ${table.status}.`;
      throw createTableError(message, 409);
    }

    const reservationsResult = await client.query(
      `SELECT id, status, reservation_date, reservation_time
       FROM restaurant.reservations
       WHERE table_id = $1
         AND deleted_at IS NULL
         AND status IN ('active', 'pending_verification', 'verified', 'confirmed')
         AND (reservation_date IS NULL OR reservation_date >= CURRENT_DATE)
       ORDER BY reservation_date, reservation_time, id
       FOR UPDATE`,
      [id]
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    );
    if (reservationsResult.rows.length) {
      throw createTableError(
        "This table has an upcoming active reservation and cannot be occupied manually.",
        409
      );
    }

    const chairsResult = await client.query(
      `SELECT id, status
       FROM restaurant.chairs
       WHERE table_id = $1 AND deleted_at IS NULL
       ORDER BY id
       FOR UPDATE`,
      [id]
    );
    const chairs = chairsResult.rows;
    if (!chairs.length || chairs.some((chair) => chair.status !== "vacant")) {
      throw createTableError(
        "This table has unavailable seats and cannot be occupied manually.",
        409
      );
    }

    await client.query(
      `UPDATE restaurant.chairs
       SET status = 'occupied', locked_until = NULL, updated_at = NOW()
       WHERE table_id = $1 AND deleted_at IS NULL`,
      [id]
    );

    const updatedResult = await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'occupied', updated_at = NOW()
       WHERE id = $1 AND status = 'vacant' AND deleted_at IS NULL
       RETURNING id, table_name, status, position_x, position_y, updated_at`,
      [id]
    );
    const updatedTable = updatedResult.rows[0];
    if (!updatedTable) {
      throw createTableError("This table is no longer available. Refresh and try again.", 409);
    }

    await auditService.insert(client, {
      userId: actor?.id || null,
      actorName: actor?.email || null,
      action: "TABLE_STATUS_CHANGED",
      module: "tables",
      entityId: updatedTable.id,
      previousValues: {
        table_status: table.status,
        chairs,
      },
      newValues: {
        table_status: "occupied",
        occupancy_type: "walk_in",
        chairs: chairs.map(({ id: chairId }) => ({
          id: chairId,
          status: "occupied",
        })),
      },
    });

    await client.query("COMMIT");
    return { message: "Table marked as occupied for walk-in service.", table: updatedTable };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

async function transitionCleaningStatus(tableId, transitionName, actor) {
  const id = parseTableId(tableId);
  const transition = TABLE_CLEANING_TRANSITIONS[transitionName];
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const tableResult = await client.query(
      `SELECT id, table_name, status
       FROM restaurant.restaurant_tables
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );
    const table = tableResult.rows[0];
    if (!table) {
      throw createTableError("Table not found.", 404);
    }

    if (table.status !== transition.from) {
      throw createTableError(
        `Cannot ${transition.action} while its status is ${table.status}.`,
        409
      );
    }

    let chairs = [];
    let activeReservations = [];

    if (transitionName === "markCleaned") {
      const chairsResult = await client.query(
        `SELECT id, status
         FROM restaurant.chairs
         WHERE table_id = $1 AND deleted_at IS NULL
         ORDER BY id
         FOR UPDATE`,
        [id]
      );
      const reservationsResult = await client.query(
        `SELECT id, status
         FROM restaurant.reservations
         WHERE table_id = $1
           AND status IN ('active', 'confirmed', 'verified')
           AND deleted_at IS NULL
         ORDER BY id
         FOR UPDATE`,
        [id]
      );
      chairs = chairsResult.rows;
      activeReservations = reservationsResult.rows;

      await client.query(
        `UPDATE restaurant.chairs
         SET status = 'vacant', locked_until = NULL, updated_at = NOW()
         WHERE table_id = $1 AND deleted_at IS NULL`,
        [id]
      );

      await client.query(
        `UPDATE restaurant.reservations
         SET status = 'completed', updated_at = NOW()
         WHERE table_id = $1
           AND status IN ('active', 'confirmed', 'verified')
           AND deleted_at IS NULL`,
        [id]
      );
    }

    const updatedResult = await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, table_name, status, position_x, position_y, updated_at`,
      [id, transition.to]
    );
    const updatedTable = updatedResult.rows[0];

    if (!updatedTable) {
      throw createTableError("Table not found.", 404);
    }

    await auditService.insert(client, {
      userId: actor?.id || null,
      actorName: actor?.email || null,
      action: "TABLE_STATUS_CHANGED",
      module: "tables",
      entityId: updatedTable.id,
      previousValues: {
        table_status: table.status,
        ...(transitionName === "markCleaned"
          ? {
              chairs,
              active_reservations: activeReservations,
            }
          : {}),
      },
      newValues: {
        table_status: transition.to,
        ...(transitionName === "markCleaned"
          ? {
              chairs: chairs.map(({ id: chairId }) => ({
                id: chairId,
                status: "vacant",
              })),
              completed_reservation_ids: activeReservations.map(({ id: reservationId }) => reservationId),
            }
          : {}),
      },
    });

    await client.query("COMMIT");
    return { message: transition.message, table: updatedTable };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

exports.markNeedsCleaning = async (tableId, actor) =>
  transitionCleaningStatus(tableId, "markNeedsCleaning", actor);

exports.startCleaning = async (tableId, actor) =>
  transitionCleaningStatus(tableId, "startCleaning", actor);

exports.markCleaned = async (tableId, actor) =>
  transitionCleaningStatus(tableId, "markCleaned", actor);
