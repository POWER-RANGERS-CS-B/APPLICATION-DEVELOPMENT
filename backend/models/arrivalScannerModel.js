const db = require("../config/db");
const auditService = require("../services/auditService");
const { parseArrivalQr, classifyArrival } = require("../utils/arrivalQr");

function scanResult(transactionType, row, classification) {
  if (!row || classification.status === "invalid") {
    return {
      scan_status: classification.status,
      message: classification.message,
      can_confirm: false,
    };
  }

  return {
    scan_status: classification.status,
    message: classification.message,
    can_confirm: classification.status === "valid",
    transaction_type: transactionType,
    customer_name: row.customer_name || "Name unavailable",
    transaction_number: transactionType === "dine_in" ? row.order_code : row.reservation_code,
    table_name: row.table_name || null,
    status: row.status,
    payment_status: row.payment_status,
    payment_verified_at: transactionType === "dine_in"
      ? row.payment_verified_at
      : row.verified_at,
    arrival_deadline_at: row.arrival_deadline_at || null,
    reservation_date: transactionType === "reservation" ? row.reservation_date : null,
    reservation_time: transactionType === "reservation" ? row.reservation_time : null,
    guest_count: transactionType === "reservation" ? row.num_guests : null,
    arrived_at: row.arrived_at || null,
    is_late: Boolean(classification.is_late ?? row.is_late),
    total_amount: transactionType === "dine_in" ? Number(row.total_amount || 0) : null,
    refund_amount: transactionType === "dine_in" ? Number(row.refund_amount || 0) : null,
    refund_status: transactionType === "dine_in" ? row.refund_status || "not_applicable" : null,
  };
}

async function findTransaction(queryable, parsedQr, forUpdate = false) {
  if (parsedQr.transactionType === "dine_in") {
    const result = await queryable.query(
      `SELECT o.id, o.user_id, o.order_code, o.type, o.status, o.payment_status,
              o.payment_verified_at, o.dine_in_status, o.arrival_deadline_at,
              o.arrived_at, o.arrival_qr_revoked_at, o.total_amount,
              o.refund_amount, o.refund_status,
              o.arrival_deadline_at < NOW() AS arrival_is_late,
              COALESCE(
                NULLIF(BTRIM(o.customer_name), ''),
                NULLIF(BTRIM(r.customer_name), ''),
                NULLIF(BTRIM(u.full_name), '')
              ) AS customer_name,
              t.table_name
       FROM restaurant.orders o
       LEFT JOIN restaurant.reservations r ON r.id = o.reservation_id
       LEFT JOIN restaurant.users u ON u.id = o.user_id
       LEFT JOIN restaurant.restaurant_tables t ON t.id = o.table_id
       WHERE o.receipt_token = $1 AND o.order_code = $2 AND o.deleted_at IS NULL
       ${forUpdate ? "FOR UPDATE OF o" : ""}`,
      [parsedQr.credential, parsedQr.orderCode]
    );
    return result.rows[0] || null;
  }

  const column = parsedQr.credentialType === "token" ? "reservation_token" : "reservation_code";
  const result = await queryable.query(
    `SELECT r.id, r.user_id, r.reservation_code, r.status, r.payment_status,
            r.verified_at, r.arrived_at, r.arrival_qr_revoked_at,
            r.reservation_date::text AS reservation_date,
            r.reservation_time::text AS reservation_time,
            (r.reservation_date + r.reservation_time + INTERVAL '30 minutes')
              AT TIME ZONE current_setting('TIMEZONE') AS arrival_deadline_at,
            r.num_guests,
            COALESCE(
              NULLIF(BTRIM(r.customer_name), ''),
              NULLIF(BTRIM(u.full_name), '')
            ) AS customer_name,
            t.table_name,
            ((r.reservation_date + r.reservation_time + INTERVAL '30 minutes')
              AT TIME ZONE current_setting('TIMEZONE')) < NOW() AS reservation_expired
     FROM restaurant.reservations r
     LEFT JOIN restaurant.users u ON u.id = r.user_id
     LEFT JOIN restaurant.restaurant_tables t ON t.id = r.table_id
     WHERE r.${column} = $1 AND r.deleted_at IS NULL
     ${forUpdate ? "FOR UPDATE OF r" : ""}`,
    [parsedQr.credential]
  );
  return result.rows[0] || null;
}

function getClassification(type, row) {
  return classifyArrival(type, row);
}

async function logScan(actor, row, transactionType, result, queryable = db) {
  await auditService.insert(queryable, {
    userId: actor?.id || null,
    actorName: actor?.email || "staff",
    action: result === "valid" ? "ARRIVAL_QR_SCAN_VALIDATED" : "ARRIVAL_QR_SCAN_REJECTED",
    module: "arrival_scanner",
    entityId: row?.id || null,
    details: { transaction_type: transactionType || null, result },
  }).catch((error) => {
    if (queryable === db) {
      console.error("Could not record arrival QR scan:", error);
      return;
    }
    throw error;
  });
}

exports.validate = async (qrPayload, actor) => {
  const parsedQr = parseArrivalQr(qrPayload);
  if (!parsedQr) {
    await logScan(actor, null, null, "invalid");
    return scanResult(null, null, {
      status: "invalid",
      message: "Invalid or unrecognized QR code.",
    });
  }

  const row = await findTransaction(db, parsedQr);
  const classification = getClassification(parsedQr.transactionType, row);
  await logScan(actor, row, parsedQr.transactionType, classification.status);
  return scanResult(parsedQr.transactionType, row, classification);
};

async function createArrivalNotification(client, type, row) {
  if (!row.user_id) return;
  const isDineIn = type === "dine_in";
  const transactionNumber = isDineIn ? row.order_code : row.reservation_code;
  const tableValue = row.table_name ? ` at ${row.table_name}` : "";
  const message = `Your ${isDineIn ? "dine-in order" : "reservation"} ${transactionNumber} arrival${tableValue} has been confirmed.`;

  if (isDineIn) {
    await client.query(
      `INSERT INTO restaurant.customer_notifications
         (user_id, order_id, notification_type, title, message, metadata)
       VALUES ($1, $2, 'dine_in_arrival_confirmed', 'Arrival confirmed', $3, $4::jsonb)`,
      [row.user_id, row.id, message, JSON.stringify({
        order_code: transactionNumber,
        status: "arrived",
        arrived_at: row.arrived_at,
      })]
    );
    return;
  }

  await client.query(
    `INSERT INTO restaurant.customer_notifications
       (user_id, reservation_id, notification_type, title, message, metadata)
     VALUES ($1, $2, 'reservation_arrival_confirmed', 'Reservation check-in confirmed', $3, $4::jsonb)`,
    [row.user_id, row.id, message, JSON.stringify({
      reservation_code: transactionNumber,
      status: "active",
      arrived_at: row.arrived_at,
    })]
  );
}

exports.confirm = async (qrPayload, actor) => {
  const parsedQr = parseArrivalQr(qrPayload);
  if (!parsedQr) {
    await logScan(actor, null, null, "invalid");
    return scanResult(null, null, {
      status: "invalid",
      message: "Invalid or unrecognized QR code.",
    });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await findTransaction(client, parsedQr, true);
    const classification = getClassification(parsedQr.transactionType, current);
    if (classification.status !== "valid") {
      await logScan(actor, current, parsedQr.transactionType, classification.status, client);
      await client.query("COMMIT");
      return scanResult(parsedQr.transactionType, current, classification);
    }

    const isDineIn = parsedQr.transactionType === "dine_in";
    const updateResult = isDineIn
      ? await client.query(
        `UPDATE restaurant.orders
         SET dine_in_status = 'arrived',
             arrived_at = NOW(),
             arrived_by_user_id = $2,
             arrival_qr_revoked_at = NOW(),
             refund_amount = CASE
               WHEN arrival_deadline_at < NOW() THEN ROUND(total_amount * 0.50, 2)
               ELSE 0
             END,
             refund_status = CASE
               WHEN arrival_deadline_at < NOW() THEN 'pending'
               ELSE 'not_applicable'
             END,
             updated_at = NOW()
         WHERE id = $1
           AND type = 'dine_in'
           AND payment_status = 'paid'
           AND payment_verified_at IS NOT NULL
           AND dine_in_status IN ('awaiting_arrival', 'expired')
           AND arrival_deadline_at IS NOT NULL
           AND arrival_qr_revoked_at IS NULL
           AND status <> 'cancelled'
           AND deleted_at IS NULL
         RETURNING id, user_id, order_code, status, payment_status,
                   payment_verified_at, dine_in_status, arrival_deadline_at,
                   arrived_at, customer_name, table_id, total_amount,
                   refund_amount, refund_status`,
        [current.id, actor.id]
      )
      : await client.query(
        `UPDATE restaurant.reservations
         SET status = 'active',
             arrived_at = NOW(),
             arrived_by_user_id = $2,
             arrival_qr_revoked_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND status IN ('confirmed', 'verified')
           AND payment_status = 'paid'
           AND arrived_at IS NULL
           AND arrival_qr_revoked_at IS NULL
           AND deleted_at IS NULL
         RETURNING id, user_id, reservation_code, status, payment_status,
                   verified_at, arrived_at, reservation_date::text AS reservation_date,
                   reservation_time::text AS reservation_time,
                   (reservation_date + reservation_time + INTERVAL '30 minutes')
                     AT TIME ZONE current_setting('TIMEZONE') AS arrival_deadline_at,
                   num_guests, customer_name, table_id`,
        [current.id, actor.id]
      );

    const updated = updateResult.rows[0];
    if (!updated) {
      const refreshed = await findTransaction(client, parsedQr, true);
      const latestClassification = getClassification(parsedQr.transactionType, refreshed);
      await logScan(actor, refreshed, parsedQr.transactionType, latestClassification.status, client);
      await client.query("COMMIT");
      return scanResult(parsedQr.transactionType, refreshed, latestClassification);
    }

    updated.customer_name = current.customer_name;
    const tableResult = await client.query(
      "SELECT table_name FROM restaurant.restaurant_tables WHERE id = $1",
      [updated.table_id]
    );
    updated.table_name = tableResult.rows[0]?.table_name || current.table_name;
    await createArrivalNotification(client, parsedQr.transactionType, updated);
    await auditService.insert(client, {
      userId: actor.id,
      actorName: actor.email || "staff",
      action: isDineIn ? "DINE_IN_CUSTOMER_ARRIVED" : "RESERVATION_CHECKED_IN",
      module: isDineIn ? "orders" : "reservations",
      entityId: updated.id,
      previousValues: isDineIn
        ? { dine_in_status: current.dine_in_status }
        : { status: current.status },
      newValues: {
        status: isDineIn ? updated.dine_in_status : updated.status,
        arrived_at: updated.arrived_at,
        arrived_by_user_id: actor.id,
      },
    });
    await client.query("COMMIT");

    return scanResult(parsedQr.transactionType, updated, {
      status: "confirmed",
      message: "Arrival confirmed. The customer has been checked in.",
      is_late: classification.is_late,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Could not roll back arrival check-in transaction:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
};
