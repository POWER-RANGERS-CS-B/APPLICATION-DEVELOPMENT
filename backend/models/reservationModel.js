const db = require("../config/db");

exports.create = async ({
  userId,
  chairIds = [],
  reservationDate,
  reservationTime,
  customerName,
  contactNumber,
  numGuests,
}) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (!chairIds.length) {
      throw new Error("Please select at least one chair.");
    }

    if (!reservationDate || !reservationTime) {
      throw new Error("Reservation date and time are required.");
    }

    const chairResult = await client.query(
      `SELECT table_id
       FROM chairs
       WHERE id = $1
         AND deleted_at IS NULL`,
      [chairIds[0]]
    );

    const tableId = chairResult.rows[0]?.table_id;

    if (!tableId) {
      throw new Error("Selected chair does not exist.");
    }

    // Serialize bookings for this table while checking the requested date/time.
    const tableStateResult = await client.query(
      `SELECT id, status
       FROM restaurant.restaurant_tables
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [tableId]
    );

    if (!tableStateResult.rows[0] || tableStateResult.rows[0].status !== "reserved") {
      throw new Error("The selected table is no longer available. Please choose another table.");
    }

    const conflictingReservation = await client.query(
      `SELECT id
       FROM restaurant.reservations
       WHERE table_id = $1
         AND deleted_at IS NULL
         AND status IN ('active', 'confirmed', 'checked_in')
         AND reservation_date = $2::date
         AND reservation_time = $3::time
       LIMIT 1`,
      [tableId, reservationDate, reservationTime]
    );

    if (conflictingReservation.rowCount) {
      throw new Error("That table is already reserved for this date and time. Please choose another table or time.");
    }

    const tableChairsResult = await client.query(
      `SELECT id, status, (locked_until > NOW()) AS hold_active
       FROM restaurant.chairs
       WHERE table_id = $1 AND deleted_at IS NULL
       ORDER BY id
       FOR UPDATE`,
      [tableId]
    );

    const requestedChairIds = [...new Set(chairIds.map(Number))].sort((a, b) => a - b);
    const activeTableChairIds = tableChairsResult.rows.map((chair) => Number(chair.id)).sort((a, b) => a - b);
    
    const ownsWholeTable =
      requestedChairIds.length === activeTableChairIds.length &&
      requestedChairIds.every((id, index) => id === activeTableChairIds[index]);

    if (!ownsWholeTable || !tableChairsResult.rows.length) {
      throw new Error("Your table hold expired or is no longer available. Please choose a table again.");
    }

    if (tableChairsResult.rows.some((chair) => chair.status !== "reserved" || !chair.hold_active)) {
      throw new Error("Your table hold expired or is no longer available. Please choose a table again.");
    }

    const reservationResult = await client.query(
      `INSERT INTO reservations
       (
         user_id,
         table_id,
         num_guests,
         status,
         reservation_date,
         reservation_time,
         customer_name,
         contact_number
       )
       VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        tableId,
        numGuests || chairIds.length,
        reservationDate,
        reservationTime,
        customerName || "Customer",
        contactNumber || "N/A",
      ]
    );

    await client.query(
      `UPDATE restaurant.chairs
       SET status = 'vacant',
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = ANY($1::int[])`,
      [chairIds]
    );

    await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'vacant', updated_at = NOW()
       WHERE id = $1 AND status = 'reserved'`,
      [tableId]
    );

    await client.query("COMMIT");

    return reservationResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.findAll = async () => {
  const result = await db.query(
    `SELECT
       r.*,
       u.full_name,
       u.email,
       rt.table_name
     FROM reservations r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN restaurant_tables rt ON rt.id = r.table_id
     WHERE r.deleted_at IS NULL
     ORDER BY r.reservation_date ASC, r.reservation_time ASC, r.created_at DESC`
  );

  return result.rows;
};

exports.updateStatus = async (reservationId, status) => {
  if (!Number.isSafeInteger(Number(reservationId)) || Number(reservationId) <= 0) {
    throw new Error("A valid reservation ID is required.");
  }
  if (!["checked_in", "cancelled", "completed"].includes(status)) {
    throw new Error("Invalid reservation status.");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const reservationResult = await client.query(
      `SELECT id, table_id, status
       FROM restaurant.reservations
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [Number(reservationId)]
    );
    const reservation = reservationResult.rows[0];
    if (!reservation) throw new Error("Reservation not found.");

    const currentStatus = String(reservation.status).toLowerCase();
    const openStatuses = ["active", "confirmed", "checked_in"];
    if (!openStatuses.includes(currentStatus)) {
      throw new Error("This reservation has already been closed.");
    }

    if (status === "checked_in") {
      if (currentStatus === "checked_in") {
        await client.query("COMMIT");
        return { ...reservation, status: "checked_in" };
      }

      const tableResult = await client.query(
        `UPDATE restaurant.restaurant_tables
         SET status = 'occupied', updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL AND status = 'vacant'
         RETURNING id`,
        [reservation.table_id]
      );
      if (!tableResult.rowCount) {
        throw new Error("This table is currently occupied. It cannot be checked in yet.");
      }

      await client.query(
        `UPDATE restaurant.chairs
         SET status = 'occupied', locked_until = NULL, updated_at = NOW()
         WHERE table_id = $1 AND deleted_at IS NULL`,
        [reservation.table_id]
      );
    }

    if (status === "completed" || status === "cancelled") {
      if (currentStatus === "checked_in") {
        if (status === "cancelled") {
          throw new Error("A checked-in guest must be marked completed after their visit.");
        }

        const openOrder = await client.query(
          `SELECT id
           FROM restaurant.orders
           WHERE reservation_id = $1
             AND deleted_at IS NULL
             AND status <> 'completed'
           LIMIT 1`,
          [Number(reservationId)]
        );
        if (openOrder.rowCount) {
          throw new Error("Complete the linked food order before completing this reservation.");
        }

        await client.query(
          `UPDATE restaurant.chairs
           SET status = 'vacant', locked_until = NULL, updated_at = NOW()
           WHERE table_id = $1 AND deleted_at IS NULL`,
          [reservation.table_id]
        );
        await client.query(
          `UPDATE restaurant.restaurant_tables
           SET status = 'vacant', updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`,
          [reservation.table_id]
        );
      }
    }

    if (status === "cancelled") {
      await client.query(
        `UPDATE restaurant.chairs
         SET status = 'vacant', locked_until = NULL, updated_at = NOW()
         WHERE table_id = $1 AND deleted_at IS NULL`,
        [reservation.table_id]
      );
      await client.query(
        `UPDATE restaurant.restaurant_tables
         SET status = 'vacant', updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL`,
        [reservation.table_id]
      );
    }

    const updated = await client.query(
      `UPDATE restaurant.reservations
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [Number(reservationId), status]
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
