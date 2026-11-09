const db = require("../config/db");
const auditService = require("../services/auditService");
const { normalizeReservationCustomer } = require("../utils/reservationCustomerValidation");
const { randomBytes } = require("node:crypto");
const QRCode = require("qrcode");

function createReservationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseReservationId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createReservationError("A valid reservation ID is required.");
  }
  return id;
}

async function createCustomerNotification(client, userId, reservation, {
  notificationType,
  title,
  message,
  status,
}) {
  if (!userId) return;
  await client.query(
    `INSERT INTO restaurant.customer_notifications
       (user_id, reservation_id, notification_type, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      userId,
      reservation.id,
      notificationType,
      title,
      message,
      JSON.stringify({
        reservation_code: reservation.reservation_code || null,
        status,
        reservation_token: reservation.reservation_token || null,
      }),
    ]
  );
}

const getReservationColumns = async () => {
  const result = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'restaurant' AND table_name = 'reservations'
  `);

  return new Set(result.rows.map((row) => row.column_name));
};

exports.create = async ({
  userId,
  actorName,
  chairIds = [],
  reservationDate,
  reservationTime,
  customerName,
  contactNumber,
  contactCountry,
  numGuests,
  paymentMethod = "GCash",
  paymentReference = null,
  gcashSenderName = null,
  paymentProofUrl = null,
}) => {
  const customer = normalizeReservationCustomer(customerName, contactNumber, contactCountry);
  if (paymentMethod !== "GCash") {
    throw createReservationError("Reservations require online GCash payment.");
  }
  const normalizedPaymentReference = String(paymentReference || "").trim();
  if (paymentMethod === "GCash" && !normalizedPaymentReference) {
    throw createReservationError("Enter the GCash reference number to submit this reservation.");
  }
  if (paymentMethod === "GCash" && normalizedPaymentReference.length > 128) {
    throw createReservationError("The GCash reference number must be 128 characters or fewer.");
  }
  const normalizedSenderName = String(gcashSenderName || "").trim();
  if (paymentMethod === "GCash" && !normalizedSenderName) {
    throw createReservationError("Enter the GCash payment sender's name.");
  }
  if (paymentMethod === "GCash" && normalizedSenderName.length > 128) {
    throw createReservationError("The GCash sender's name must be 128 characters or fewer.");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (!Array.isArray(chairIds) || !chairIds.length) {
      throw new Error("Please select at least one chair.");
    }

    if (!reservationDate || !reservationTime) {
      throw new Error("Reservation date and time are required.");
    }
    if (!Number.isSafeInteger(Number(numGuests || chairIds.length)) || Number(numGuests || chairIds.length) < 1) {
      throw createReservationError("The number of guests must be a positive whole number.");
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

<<<<<<< HEAD
    // Serialize bookings for this table while checking the requested date/time.
=======
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    const tableStateResult = await client.query(
      `SELECT id, status
       FROM restaurant.restaurant_tables
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [tableId]
    );

<<<<<<< HEAD
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
=======
    if (!tableStateResult.rows[0]) {
      throw new Error("The selected table is no longer available. Please choose another table.");
    }

    const tableStatus = tableStateResult.rows[0].status;
    if (["needs_cleaning", "cleaning", "occupied"].includes(tableStatus)) {
      throw new Error("This table is currently unavailable for reservations because it is under maintenance or cleaning.");
    }

    if (!["vacant", "reserved", "locked"].includes(tableStatus)) {
      throw new Error("The selected table is no longer available. Please choose another table.");
    }

    const tableChairsResult = await client.query(
      `SELECT id, status
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
       FROM restaurant.chairs
       WHERE table_id = $1 AND deleted_at IS NULL
       ORDER BY id
       FOR UPDATE`,
      [tableId]
    );

    const requestedChairIds = [...new Set(chairIds.map(Number))].sort((a, b) => a - b);
    const activeTableChairIds = tableChairsResult.rows.map((chair) => Number(chair.id)).sort((a, b) => a - b);
<<<<<<< HEAD
    
=======

>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    const ownsWholeTable =
      requestedChairIds.length === activeTableChairIds.length &&
      requestedChairIds.every((id, index) => id === activeTableChairIds[index]);

    if (!ownsWholeTable || !tableChairsResult.rows.length) {
      throw new Error("Your table hold expired or is no longer available. Please choose a table again.");
    }

<<<<<<< HEAD
    if (tableChairsResult.rows.some((chair) => chair.status !== "reserved" || !chair.hold_active)) {
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
=======
    const columns = await getReservationColumns();
    if (
      paymentMethod === "GCash" &&
      (!columns.has("gcash_reference") ||
        !columns.has("gcash_sender_name") ||
        !columns.has("payment_status"))
    ) {
      throw createReservationError(
        "Reservation payment storage is not ready. Apply the reservation payment migration and try again.",
        500
      );
    }
    const reservationCode = `RES-${randomBytes(16).toString("hex").toUpperCase()}`;
    const reservationToken = `rsv-${randomBytes(32).toString("base64url")}`;

    const insertFields = [
      "user_id",
      "table_id",
      "num_guests",
      "status",
      "reservation_date",
      "reservation_time",
      "customer_name",
      "contact_number",
    ];
    const insertValues = [
      userId,
      tableId,
      numGuests || chairIds.length,
      "pending_verification",
      reservationDate,
      reservationTime,
      customer.customerName,
      customer.contactNumber,
    ];

    if (columns.has("reservation_code")) {
      insertFields.push("reservation_code");
      insertValues.push(reservationCode);
    }
    if (columns.has("qr_code")) {
      insertFields.push("qr_code");
      insertValues.push(null);
    }
    if (columns.has("reservation_token")) {
      insertFields.push("reservation_token");
      insertValues.push(reservationToken);
    }
    if (columns.has("payment_status")) {
      insertFields.push("payment_status");
      insertValues.push("pending_verification");
    }
    if (columns.has("payment_method")) {
      insertFields.push("payment_method");
      insertValues.push(paymentMethod || "GCash");
    }
    if (columns.has("gcash_reference")) {
      insertFields.push("gcash_reference");
      insertValues.push(normalizedPaymentReference || null);
    }
    if (columns.has("gcash_sender_name")) {
      insertFields.push("gcash_sender_name");
      insertValues.push(normalizedSenderName || null);
    }
    if (columns.has("payment_proof_url")) {
      insertFields.push("payment_proof_url");
      insertValues.push(paymentProofUrl || null);
    }

    const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(", ");
    const reservationResult = await client.query(
      `INSERT INTO restaurant.reservations (${insertFields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      insertValues
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    );

    await client.query(
      `UPDATE restaurant.chairs
<<<<<<< HEAD
       SET status = 'vacant',
=======
       SET status = 'occupied',
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
           locked_until = NULL,
           updated_at = NOW()
       WHERE table_id = $1 AND deleted_at IS NULL`,
      [tableId]
    );

    await client.query(
      `UPDATE restaurant.restaurant_tables
<<<<<<< HEAD
       SET status = 'vacant', updated_at = NOW()
       WHERE id = $1 AND status = 'reserved'`,
=======
       SET status = 'occupied',
           updated_at = NOW()
       WHERE id = $1`,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
      [tableId]
    );

    await auditService.insert(client, {
      userId,
      actorName,
      action: "TABLE_STATUS_CHANGED",
      module: "tables",
      entityId: tableId,
      previousValues: { status: tableStateResult.rows[0].status },
      newValues: { status: "occupied" },
      details: { reservation_id: reservationResult.rows[0].id },
    });

    await auditService.insert(client, {
      userId,
      actorName,
      action: "CHAIR_STATUS_CHANGED",
      module: "chairs",
      entityId: tableId,
      previousValues: {
        chairs: tableChairsResult.rows.map(({ id, status }) => ({ id, status })),
      },
      newValues: {
        chairs: tableChairsResult.rows.map(({ id }) => ({ id, status: "occupied" })),
      },
      details: { reservation_id: reservationResult.rows[0].id },
    });

    await auditService.insert(client, {
      userId,
      actorName,
      action: "RESERVATION_CREATED",
      module: "reservations",
      entityId: reservationResult.rows[0].id,
      newValues: {
        table_id: tableId,
        num_guests: reservationResult.rows[0].num_guests,
        status: reservationResult.rows[0].status,
        reservation_date: reservationResult.rows[0].reservation_date,
        reservation_time: reservationResult.rows[0].reservation_time,
      },
    });

    await createCustomerNotification(client, userId, reservationResult.rows[0], {
      notificationType: "reservation_submitted",
      title: "Reservation submitted",
      message: `Your reservation ${reservationResult.rows[0].reservation_code || ""} is pending confirmation.`.trim(),
      status: reservationResult.rows[0].status,
    });

    await client.query("COMMIT");

    return reservationResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.confirm = async (reservationId, { actorId, actorName } = {}) => {
  const id = parseReservationId(reservationId);
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT id, user_id, status, payment_method, gcash_reference, gcash_sender_name,
              reservation_code, reservation_token
       FROM restaurant.reservations
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) throw createReservationError("Reservation not found.", 404);
    if (current.status !== "pending_verification") {
      throw createReservationError("This reservation has already been reviewed.", 409);
    }
    if (
      current.payment_method === "GCash" &&
      (!String(current.gcash_reference || "").trim() ||
        !String(current.gcash_sender_name || "").trim())
    ) {
      throw createReservationError("A GCash reference number and sender's name are required before confirmation.");
    }

    const columns = await getReservationColumns();
    const updateFields = ["status = 'confirmed'", "updated_at = NOW()"];
    const updateValues = [id];
    if (columns.has("payment_status")) updateFields.push("payment_status = 'paid'");
    if (columns.has("verified_at")) updateFields.push("verified_at = NOW()");
    if (columns.has("qr_code")) {
      if (!current.reservation_code) {
        throw createReservationError("A reservation code is unavailable for receipt generation.", 500);
      }
      if (!current.reservation_token) {
        throw createReservationError("A secure reservation QR token is unavailable.", 500);
      }
      const qrCode = await QRCode.toDataURL(`DINEARI:RES:${current.reservation_token}`, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 280,
      });
      updateValues.push(qrCode);
      updateFields.push(`qr_code = $${updateValues.length}`);
    }

    const result = await client.query(
      `UPDATE restaurant.reservations
       SET ${updateFields.join(", ")}
       WHERE id = $1 AND status = 'pending_verification' AND deleted_at IS NULL
       RETURNING *`,
      updateValues
    );
    if (!result.rows[0]) {
      throw createReservationError("This reservation has already been reviewed.", 409);
    }

    await auditService.insert(client, {
      userId: actorId || null,
      actorName,
      action: "RESERVATION_CONFIRMED",
      module: "reservations",
      entityId: id,
      previousValues: { status: current.status },
      newValues: { status: "confirmed", payment_status: "paid" },
    });

    await createCustomerNotification(client, current.user_id, result.rows[0], {
      notificationType: "reservation_confirmed",
      title: "Reservation confirmed",
      message: `Your reservation ${current.reservation_code || ""} is confirmed and payment is verified.`.trim(),
      status: "confirmed",
    });

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.reject = async (reservationId, reason, { actorId, actorName } = {}) => {
  const id = parseReservationId(reservationId);
  const rejectionReason = String(reason || "").trim();
  if (!rejectionReason) throw createReservationError("A rejection reason is required.");
  if (rejectionReason.length > 500) {
    throw createReservationError("The rejection reason must be 500 characters or fewer.");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT id, user_id, status, table_id, reservation_code, reservation_token
       FROM restaurant.reservations
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) throw createReservationError("Reservation not found.", 404);
    if (current.status !== "pending_verification") {
      throw createReservationError("This reservation has already been reviewed.", 409);
    }

    const columns = await getReservationColumns();
    const updateFields = ["status = 'rejected'", "updated_at = NOW()"];
    const values = [id];
    if (columns.has("payment_status")) updateFields.push("payment_status = 'rejected'");
    if (columns.has("reservation_rejection_reason")) {
      values.push(rejectionReason);
      updateFields.push(`reservation_rejection_reason = $${values.length}`);
    }

    const result = await client.query(
      `UPDATE restaurant.reservations
       SET ${updateFields.join(", ")}
       WHERE id = $1 AND status = 'pending_verification' AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (!result.rows[0]) {
      throw createReservationError("This reservation has already been reviewed.", 409);
    }

    if (current.table_id) {
      const releasedTable = await client.query(
        `UPDATE restaurant.restaurant_tables rt
         SET status = 'vacant', updated_at = NOW()
         WHERE rt.id = $1 AND rt.status = 'occupied'
           AND NOT EXISTS (
             SELECT 1
             FROM restaurant.reservations other
             WHERE other.table_id = rt.id
               AND other.id <> $2
               AND other.deleted_at IS NULL
               AND other.status IN ('pending_verification', 'confirmed', 'verified', 'active')
           )
         RETURNING id`,
        [current.table_id, id]
      );
      if (releasedTable.rows[0]) {
        await client.query(
          `UPDATE restaurant.chairs
           SET status = 'vacant', locked_until = NULL, updated_at = NOW()
           WHERE table_id = $1 AND deleted_at IS NULL`,
          [current.table_id]
        );
      }
    }

    await auditService.insert(client, {
      userId: actorId || null,
      actorName,
      action: "RESERVATION_REJECTED",
      module: "reservations",
      entityId: id,
      previousValues: { status: current.status },
      newValues: { status: "rejected", rejection_reason: rejectionReason },
    });

    await createCustomerNotification(client, current.user_id, result.rows[0], {
      notificationType: "reservation_rejected",
      title: "Reservation rejected",
      message: `Your reservation ${current.reservation_code || ""} was rejected. Reason: ${rejectionReason}`,
      status: "rejected",
    });

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.resubmitPayment = async (token, { reference, senderName }) => {
  const reservationToken = typeof token === "string" ? token.trim() : "";
  const paymentReference = typeof reference === "string" ? reference.trim() : "";
  const paymentSenderName = typeof senderName === "string" ? senderName.trim() : "";
  if (reservationToken.length < 20 || reservationToken.length > 200) {
    throw createReservationError("A valid reservation status token is required.");
  }
  if (!paymentReference || paymentReference.length > 128) {
    throw createReservationError("Enter a valid GCash reference number of 128 characters or fewer.");
  }
  if (!paymentSenderName || paymentSenderName.length > 128) {
    throw createReservationError("Enter a valid sender's name of 128 characters or fewer.");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const columns = await getReservationColumns();
    if (!columns.has("gcash_sender_name")) {
      throw createReservationError("Reservation payment storage is not ready.", 500);
    }
    const reservationResult = await client.query(
      `SELECT id, user_id, table_id, status, payment_method, reservation_token
       FROM restaurant.reservations
       WHERE reservation_token = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [reservationToken]
    );
    const current = reservationResult.rows[0];
    if (!current || current.status !== "rejected" || current.payment_method !== "GCash") {
      throw createReservationError("This reservation cannot be resubmitted for payment verification.", 409);
    }
    if (current.table_id) {
      const tableResult = await client.query(
        `SELECT id, status
         FROM restaurant.restaurant_tables
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [current.table_id]
      );
      const table = tableResult.rows[0];
      if (!table || !["vacant", "reserved", "locked"].includes(table.status)) {
        throw createReservationError("The original table is no longer available. Contact the restaurant before resubmitting.", 409);
      }
      await client.query(
        `UPDATE restaurant.chairs
         SET status = 'occupied', locked_until = NULL, updated_at = NOW()
         WHERE table_id = $1 AND deleted_at IS NULL`,
        [current.table_id]
      );
      await client.query(
        `UPDATE restaurant.restaurant_tables
         SET status = 'occupied', updated_at = NOW()
         WHERE id = $1`,
        [current.table_id]
      );
    }
    const result = await client.query(
      `UPDATE restaurant.reservations
       SET gcash_reference = $2,
           gcash_sender_name = $3,
           payment_status = 'pending_verification',
           status = 'pending_verification',
           reservation_rejection_reason = NULL,
           updated_at = NOW()
       WHERE reservation_token = $1
         AND deleted_at IS NULL
         AND status = 'rejected'
         AND payment_method = 'GCash'
       RETURNING id, reservation_code, customer_name, reservation_date,
                 reservation_time, num_guests, status, payment_status,
                 reservation_rejection_reason, updated_at, created_at, reservation_token`,
      [reservationToken, paymentReference, paymentSenderName]
    );
    if (!result.rows[0]) {
      throw createReservationError("This reservation cannot be resubmitted for payment verification.", 409);
    }
    await auditService.insert(client, {
      userId: current.user_id,
      actorName: current.user_id ? "customer" : "reservation holder",
      action: "RESERVATION_PAYMENT_RESUBMITTED",
      module: "reservations",
      entityId: current.id,
      previousValues: { status: "rejected" },
      newValues: { status: "pending_verification", payment_status: "pending_verification" },
    });
    await createCustomerNotification(client, current.user_id, result.rows[0], {
      notificationType: "reservation_payment_resubmitted",
      title: "Payment details resubmitted",
      message: `Your reservation ${result.rows[0].reservation_code || ""} payment details are waiting for admin verification.`.trim(),
      status: "pending_verification",
    });
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.findStatusByToken = async (token) => {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    throw createReservationError("A valid reservation status token is required.");
  }

  const result = await db.query(
    `SELECT r.reservation_code, r.customer_name, r.contact_number,
            r.num_guests, r.status, r.payment_status,
            r.payment_method, r.reservation_rejection_reason,
            r.arrived_at,
            CASE
              WHEN r.status IN ('confirmed', 'verified', 'active', 'completed')
                AND r.payment_status = 'paid'
              THEN r.qr_code
              ELSE NULL
            END AS qr_code,
            r.updated_at, r.created_at, r.reservation_date::text AS reservation_date,
            r.reservation_time::text AS reservation_time, rt.table_name
     FROM restaurant.reservations r
     LEFT JOIN restaurant.restaurant_tables rt ON rt.id = r.table_id
     WHERE r.reservation_token = $1 AND r.deleted_at IS NULL`,
    [token]
  );
  if (!result.rows[0]) throw createReservationError("Reservation not found.", 404);
  return result.rows[0];
};

exports.validateReceipt = async (reservationCode, { actorId, actorName } = {}) => {
  const code = typeof reservationCode === "string" ? reservationCode.trim() : "";
  if (!code || code.length > 64) throw createReservationError("A valid reservation code is required.");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT id, user_id, reservation_code, customer_name, contact_number,
              reservation_date::text AS reservation_date,
              reservation_time::text AS reservation_time, num_guests, status,
              payment_status, table_id, arrived_at, verified_at,
              arrival_qr_revoked_at,
              (reservation_date + reservation_time + INTERVAL '30 minutes')
                AT TIME ZONE current_setting('TIMEZONE') AS arrival_deadline_at
       FROM restaurant.reservations
       WHERE reservation_code = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [code]
    );
    const current = currentResult.rows[0];
    if (!current) throw createReservationError("Reservation not found.", 404);
    if (current.arrival_qr_revoked_at) {
      throw createReservationError("QR Code Already Used", 409);
    }
    if (String(current.status).toLowerCase() === "active" || current.arrived_at) {
      throw createReservationError("QR Code Already Used", 409);
    }
    if (
      !["confirmed", "verified"].includes(String(current.status).toLowerCase()) ||
      String(current.payment_status).toLowerCase() !== "paid" ||
      !current.verified_at
    ) {
      throw createReservationError("This reservation is not confirmed and paid.", 409);
    }
    const result = await client.query(
      `UPDATE restaurant.reservations
       SET status = 'active',
           arrived_at = COALESCE(arrived_at, NOW()),
           arrived_by_user_id = COALESCE(arrived_by_user_id, $2),
           arrival_qr_revoked_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status IN ('confirmed', 'verified')
         AND payment_status = 'paid'
         AND verified_at IS NOT NULL
         AND arrived_at IS NULL
         AND arrival_qr_revoked_at IS NULL
         AND deleted_at IS NULL
       RETURNING id, customer_name, contact_number, reservation_date::text AS reservation_date,
                 reservation_time::text AS reservation_time, num_guests, status, arrived_at`,
      [current.id, actorId || null]
    );
    if (!result.rows[0]) throw createReservationError("This reservation has already been checked in.", 409);
    const tableResult = await client.query(
      "SELECT table_name FROM restaurant.restaurant_tables WHERE id = $1",
      [current.table_id]
    );
    await auditService.insert(client, {
      userId: actorId || null,
      actorName,
      action: "RESERVATION_CHECKED_IN",
      module: "reservations",
      entityId: current.id,
      previousValues: { status: current.status },
      newValues: { status: "active", arrived_at: result.rows[0].arrived_at },
    });
    await createCustomerNotification(client, current.user_id, {
      id: current.id,
      reservation_code: current.reservation_code,
    }, {
      notificationType: "reservation_arrival_confirmed",
      title: "Reservation check-in confirmed",
      message: `Your reservation ${current.reservation_code || ""} arrival has been confirmed.`.trim(),
      status: "active",
    });
    await client.query("COMMIT");
    return { ...result.rows[0], table_name: tableResult.rows[0]?.table_name || null };
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
     ORDER BY r.reservation_date ASC, r.reservation_time ASC, r.created_at DESC`
  );

  return result.rows;
};

<<<<<<< HEAD
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
=======
exports.archiveHistoricalReservation = async (reservationId, { actorId, actorName } = {}) => {
  const id = parseReservationId(reservationId);
  const historicalStatuses = ["completed", "cancelled", "canceled", "rejected"];
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT id, reservation_code, customer_name, status, payment_status
       FROM restaurant.reservations
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) throw createReservationError("Reservation not found.", 404);
    if (!historicalStatuses.includes(String(current.status || "").toLowerCase())) {
      throw createReservationError(
        "Only completed, cancelled, or rejected reservations can be removed from history.",
        409
      );
    }

    const archivedResult = await client.query(
      `UPDATE restaurant.reservations
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, deleted_at`,
      [id]
    );
    if (!archivedResult.rows[0]) {
      throw createReservationError("Reservation is no longer available.", 409);
    }

    await auditService.insert(client, {
      userId: actorId || null,
      actorName,
      action: "RESERVATION_HISTORY_ARCHIVED",
      module: "reservations",
      entityId: id,
      previousValues: {
        reservation_code: current.reservation_code,
        customer_name: current.customer_name,
        status: current.status,
        payment_status: current.payment_status,
        deleted_at: null,
      },
      newValues: {
        status: current.status,
        deleted_at: archivedResult.rows[0].deleted_at,
      },
    });

    await client.query("COMMIT");
    return archivedResult.rows[0];
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
<<<<<<< HEAD
=======

exports.findForecastHistory = async (asOf) => {
  const result = await db.query(
    `SELECT
       id,
       reservation_date::text AS reservation_date,
       reservation_time::text AS reservation_time,
       num_guests,
       updated_at::text AS updated_at
     FROM restaurant.reservations
     WHERE deleted_at IS NULL
       AND LOWER(COALESCE(status::text, '')) IN ('active', 'completed', 'confirmed')
       AND reservation_date >= $1::date - INTERVAL '1095 days'
       AND reservation_date < $1::date
     ORDER BY reservation_date, reservation_time`,
    [asOf]
  );

  return result.rows;
};
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
