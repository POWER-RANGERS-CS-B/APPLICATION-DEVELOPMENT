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
      `UPDATE chairs
       SET status = 'occupied',
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = ANY($1::int[])`,
      [chairIds]
    );

    await client.query(
      `UPDATE restaurant_tables
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
     FROM reservations r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN restaurant_tables rt ON rt.id = r.table_id
     WHERE r.deleted_at IS NULL
     ORDER BY r.created_at DESC`
  );

  return result.rows;
};