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
       FROM restaurant.chairs
       WHERE id = $1
         AND deleted_at IS NULL`,
      [chairIds[0]]
    );

    const tableId = chairResult.rows[0]?.table_id;

    if (!tableId) {
      throw new Error("Selected chair does not exist.");
    }

    const tableStateResult = await client.query(
      `SELECT id, status
       FROM restaurant.restaurant_tables
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [tableId]
    );

    // Allow both vacant and reserved tables
    if (!tableStateResult.rows[0] || !["vacant", "reserved", "locked"].includes(tableStateResult.rows[0].status)) {
      throw new Error("The selected table is no longer available. Please choose another table.");
    }

    const tableChairsResult = await client.query(
      `SELECT id, status
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

    const reservationResult = await client.query(
      `INSERT INTO restaurant.reservations
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
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
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
       SET status = 'occupied',
           locked_until = NULL,
           updated_at = NOW()
       WHERE table_id = $1 AND deleted_at IS NULL`,
      [tableId]
    );

    await client.query(
      `UPDATE restaurant.restaurant_tables
       SET status = 'occupied',
           updated_at = NOW()
       WHERE id = $1`,
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
     FROM restaurant.reservations r
     LEFT JOIN restaurant.users u ON u.id = r.user_id
     LEFT JOIN restaurant.restaurant_tables rt ON rt.id = r.table_id
     WHERE r.deleted_at IS NULL
     ORDER BY r.created_at DESC`
  );

  return result.rows;
};