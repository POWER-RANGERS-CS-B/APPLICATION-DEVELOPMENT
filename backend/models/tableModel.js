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

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.restaurant_tables
     WHERE deleted_at IS NULL
     ORDER BY id`
  );
  return result.rows;
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
         WHERE table_id = $1 AND status = 'active' AND deleted_at IS NULL
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
           AND status = 'active'
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
