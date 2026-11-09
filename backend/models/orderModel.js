const db = require("../config/db");
const QRCode = require("qrcode");
const crypto = require("crypto");
const auditService = require("../services/auditService");
const { buildReceiptUrl } = require("../config/publicUrl");
const { normalizeReservationCustomer } = require("../utils/reservationCustomerValidation");

function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Add at least one menu item to the order.");
  }

  const quantitiesByMenuItem = new Map();

  for (const item of items) {
    const menuItemId = Number(item?.menu_item_id);
    const quantity = Number(item?.quantity);

    if (!Number.isSafeInteger(menuItemId) || menuItemId <= 0) {
      throw new Error("Each order item must have a valid menu item.");
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error("Each order item quantity must be a positive whole number.");
    }

    const combinedQuantity = (quantitiesByMenuItem.get(menuItemId) || 0) + quantity;
    if (!Number.isSafeInteger(combinedQuantity)) {
      throw new Error("The requested item quantity is too large.");
    }
    quantitiesByMenuItem.set(menuItemId, combinedQuantity);
  }

  return Array.from(quantitiesByMenuItem, ([menu_item_id, quantity]) => ({
    menu_item_id,
    quantity,
  }));
}

async function generateOrderCode(client) {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(Math.random() * 900) + 100);

    const existing = await client.query(
      "SELECT 1 FROM restaurant.orders WHERE order_code = $1",
      [code]
    );

    if (!existing.rowCount) {
      return code;
    }
  }

  throw new Error("Cannot generate a unique order code.");
}

<<<<<<< HEAD
exports.create = async ({
  userId,
=======
async function createOrderNotification(client, order, {
  notificationType,
  title,
  message,
  status,
  refundAmount,
}) {
  if (!order.user_id) return;
  await client.query(
    `INSERT INTO restaurant.customer_notifications
       (user_id, order_id, notification_type, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      order.user_id,
      order.id,
      notificationType,
      title,
      message,
      JSON.stringify({
        order_code: order.order_code,
        status,
        refund_amount: refundAmount ?? null,
        arrival_deadline_at: order.arrival_deadline_at || null,
      }),
    ]
  );
}

async function releaseDineInTable(client, tableId, orderId) {
  if (!tableId) return;
  const released = await client.query(
    `UPDATE restaurant.restaurant_tables rt
     SET status = 'vacant', updated_at = NOW()
     WHERE rt.id = $1 AND rt.status = 'occupied'
       AND NOT EXISTS (
         SELECT 1
         FROM restaurant.orders other
         WHERE other.table_id = rt.id
           AND other.id <> $2
           AND other.deleted_at IS NULL
           AND other.status NOT IN ('completed', 'cancelled')
           AND other.payment_status <> 'rejected'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM restaurant.reservations r
         WHERE r.table_id = rt.id
           AND r.deleted_at IS NULL
           AND r.status IN ('pending_verification', 'confirmed', 'verified', 'active')
       )
     RETURNING id`,
    [tableId, orderId]
  );
  if (released.rows[0]) {
    await client.query(
      `UPDATE restaurant.chairs
       SET status = 'vacant', locked_until = NULL, updated_at = NOW()
       WHERE table_id = $1 AND deleted_at IS NULL`,
      [tableId]
    );
  }
}

async function restoreDineInOrderInventory(client, orderId, actorName) {
  const items = await client.query(
    `SELECT menu_item_id, quantity
     FROM restaurant.order_items
     WHERE order_id = $1 AND deleted_at IS NULL`,
    [orderId]
  );
  for (const item of items.rows) {
    const restored = await client.query(
      `UPDATE restaurant.menu_items
       SET stock_count = stock_count + $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, stock_count`,
      [item.menu_item_id, item.quantity]
    );
    if (restored.rows[0]) {
      await auditService.insert(client, {
        userId: null,
        actorName,
        action: "INVENTORY_RESTORED",
        module: "inventory",
        entityId: item.menu_item_id,
        newValues: { stock_count: restored.rows[0].stock_count },
        details: { order_id: orderId, quantity: item.quantity },
      });
    }
  }
}

exports.create = async ({
  userId,
  actorName,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  type,
  chairIds = [],
  items = [],
  paymentMethod = "GCash",
<<<<<<< HEAD
=======
  gcashReference = null,
  gcashSenderName = null,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  reservationDate = null,
  reservationTime = null,
  customerName = null,
  contactNumber = null,
<<<<<<< HEAD
  receiptBaseUrl = null,
}) => {
=======
  contactCountry = null,
  receiptBaseUrl = null,
}) => {
  items = normalizeOrderItems(items);
  const hasCustomerDetails = Boolean(customerName || contactNumber || contactCountry);
  const customer = hasCustomerDetails
    ? normalizeReservationCustomer(customerName, contactNumber, contactCountry)
    : null;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  const client = await db.connect();

  try {
    await client.query("BEGIN");

<<<<<<< HEAD
=======
    if (type === "dine_in" && paymentMethod !== "GCash") {
      throw new Error("Dine-in orders require GCash payment.");
    }
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    if (!["GCash", "Card"].includes(paymentMethod)) {
      throw new Error("Unavailable payment method. Please choose GCash or Card.");
    }

    if (!["dine_in", "takeout"].includes(type)) {
      throw new Error("A valid order type is required. Select a table for dine-in before ordering.");
    }

<<<<<<< HEAD
    let total = 0;
    let reservationId = null;
    const orderItems = [];

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Add at least one menu item before placing the order.");
    }
=======
    const normalizedGcashReference = String(gcashReference || "").trim();
    const normalizedGcashSenderName = String(gcashSenderName || "").trim();
    if (type === "dine_in" && !normalizedGcashReference) {
      throw new Error("Enter the GCash reference number to submit this dine-in order.");
    }
    if (type === "dine_in" && normalizedGcashReference.length > 128) {
      throw new Error("The GCash reference number must be 128 characters or fewer.");
    }
    if (type === "dine_in" && !normalizedGcashSenderName) {
      throw new Error("Enter the GCash payment sender's name.");
    }
    if (type === "dine_in" && normalizedGcashSenderName.length > 128) {
      throw new Error("The GCash sender's name must be 128 characters or fewer.");
    }

    let total = 0;
    let reservationId = null;
    let tableId = null;
    const inventoryChanges = [];
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

    if (type === "dine_in") {
      if (!chairIds.length) {
        throw new Error("Please select at least one chair for dine-in.");
      }

      const chairResult = await client.query(
        `SELECT table_id
         FROM restaurant.chairs
         WHERE id = $1
           AND deleted_at IS NULL`,
        [chairIds[0]]
      );

      tableId = chairResult.rows[0]?.table_id;

      if (!tableId) {
        throw new Error("Selected chair does not exist.");
      }

<<<<<<< HEAD
      // Atomically convert the hold to occupied so only one order can claim it.
      const tableResult = await client.query(
        `UPDATE restaurant.restaurant_tables
         SET status = 'occupied', updated_at = NOW()
         WHERE id = $1
           AND deleted_at IS NULL
           AND status = 'reserved'
         RETURNING id`,
        [tableId]
      );
      
      if (!tableResult.rows[0]) {
=======
      const tableResult = await client.query(
        `SELECT id, status
         FROM restaurant.restaurant_tables
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [tableId]
      );
      
      // CHANGE THIS LINE: Allow both 'vacant' and 'reserved' tables
      if (!tableResult.rows[0] || !["vacant", "reserved"].includes(tableResult.rows[0].status)) {
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
        throw new Error("The selected table is no longer available. Please choose another table.");
      }

      const tableChairsResult = await client.query(
<<<<<<< HEAD
        `SELECT id, status, (locked_until > NOW()) AS hold_active
=======
        `SELECT id, status
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
         FROM restaurant.chairs
         WHERE table_id = $1 AND deleted_at IS NULL
         ORDER BY id
         FOR UPDATE`,
        [tableId]
<<<<<<< HEAD
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

      const dateValue = reservationDate || new Date().toISOString().split("T")[0];
      const timeValue = reservationTime || new Date().toTimeString().split(" ")[0];
      const resolvedName = customerName || "Customer";
      const resolvedContact = contactNumber || "N/A";

      const reservationResult = await client.query(
        `INSERT INTO restaurant.reservations
         (user_id, table_id, num_guests, status, reservation_date, reservation_time, customer_name, contact_number)
         VALUES ($1, $2, $3, 'checked_in', $4, $5, $6, $7)
         RETURNING id`,
        [userId, tableId, chairIds.length, dateValue, timeValue, resolvedName, resolvedContact]
=======
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
      );

      const requestedChairIds = [...new Set(chairIds.map(Number))].sort((a, b) => a - b);
      const activeTableChairIds = tableChairsResult.rows.map((chair) => Number(chair.id)).sort((a, b) => a - b);
      
      const ownsWholeTable =
        requestedChairIds.length === activeTableChairIds.length &&
        requestedChairIds.every((id, index) => id === activeTableChairIds[index]);

      if (!ownsWholeTable || !tableChairsResult.rows.length) {
        throw new Error("Your table hold expired or is no longer available. Please choose a table again.");
      }

      if (!ownsWholeTable) {
        throw new Error("Your table hold expired or is no longer available. Please choose a table again.");
      }

      if (customer) {
        const dateValue = reservationDate || new Date().toISOString().split("T")[0];
        const timeValue = reservationTime || new Date().toTimeString().split(" ")[0];
        const reservationResult = await client.query(
          `INSERT INTO restaurant.reservations
           (user_id, table_id, num_guests, status, reservation_date, reservation_time, customer_name, contact_number)
           VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
           RETURNING id`,
          [userId, tableId, chairIds.length, dateValue, timeValue, customer.customerName, customer.contactNumber]
        );
        reservationId = reservationResult.rows[0].id;
      }

      await auditService.insert(client, {
        userId,
        actorName,
        action: "TABLE_STATUS_CHANGED",
        module: "tables",
        entityId: tableId,
        previousValues: { status: tableResult.rows[0].status },
        newValues: { status: "occupied" },
        details: reservationId ? { reservation_id: reservationId } : null,
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
        details: reservationId ? { reservation_id: reservationId } : null,
      });

      await client.query(
        `UPDATE restaurant.chairs
        SET status = 'occupied', locked_until = NULL, updated_at = NOW()
        WHERE table_id = $1 AND deleted_at IS NULL`,
<<<<<<< HEAD
=======
        [tableId]
      );

      await client.query(
        `UPDATE restaurant.restaurant_tables
         SET status = 'occupied', updated_at = NOW()
         WHERE id = $1`,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
        [tableId]
      );

    }

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for item ${item.menu_item_id}.`);
      }

      const menuResult = await client.query(
<<<<<<< HEAD
        `UPDATE restaurant.menu_items
         SET stock_count = stock_count - $2,
             updated_at = NOW()
=======
        `SELECT *
         FROM restaurant.menu_items
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
         WHERE id = $1
           AND deleted_at IS NULL
           AND stock_count >= $2
         RETURNING price`,
        [item.menu_item_id, quantity]
      );

      const menuItem = menuResult.rows[0];
      const availableStock = Number(menuItem?.stock_count);

<<<<<<< HEAD
      if (!menuItem) {
        throw new Error(`Not enough stock for item ${item.menu_item_id}.`);
      }

      const unitPrice = Number(menuItem.price);
      total += unitPrice * quantity;
      orderItems.push({
        menuItemId: Number(item.menu_item_id),
        quantity,
        unitPrice,
      });
=======
      if (
        !menuItem ||
        !Number.isSafeInteger(availableStock) ||
        availableStock < item.quantity
      ) {
        throw new Error(`Not enough stock for item ${item.menu_item_id}.`);
      }

      total += Number(menuItem.price) * item.quantity;
      inventoryChanges.push({
        menu_item_id: menuItem.id,
        quantity: item.quantity,
        previous_stock_count: availableStock,
        new_stock_count: availableStock - item.quantity,
      });

      await client.query(
        `UPDATE restaurant.menu_items
         SET stock_count = stock_count - $2,
             updated_at = NOW()
         WHERE id = $1`,
        [item.menu_item_id, item.quantity]
      );
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    }

    const orderCode = await generateOrderCode(client);

    const receiptToken = crypto.randomBytes(32).toString("hex");

<<<<<<< HEAD
    const baseUrl =
      receiptBaseUrl ||
      process.env.PUBLIC_BASE_URL ||
      process.env.BASE_URL ||
      process.env.FRONTEND_URL ||
      `http://localhost:${process.env.PORT || 3000}`;

    const receiptUrl = new URL("/receipt.html", baseUrl);
    receiptUrl.searchParams.set("code", orderCode);
    receiptUrl.searchParams.set("token", receiptToken);

    const qrCode = await QRCode.toDataURL(receiptUrl.toString());
=======
    if (!receiptBaseUrl) {
      throw new Error("Receipt base URL is not configured.");
    }

    const receiptUrl = buildReceiptUrl(receiptBaseUrl, orderCode, receiptToken);
    const qrCode = type === "dine_in" ? null : await QRCode.toDataURL(receiptUrl);
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

    const orderResult = await client.query(
      `INSERT INTO restaurant.orders
   (
     order_code,
     user_id,
     reservation_id,
     table_id,
     type,
     status,
     payment_status,
     payment_method,
     gcash_reference,
     gcash_sender_name,
     dine_in_status,
     total_amount,
     customer_name,
     contact_number,
     qr_code,
     receipt_token
   )
   VALUES (
     $1,
     $2,
     $3,
     $4,
     $5,
     $6,
     $7,
     $8,
     $9,
     $10,
     $11,
     $12,
     $13,
     $14,
     $15,
     $16
   )
   RETURNING *`,
      [
        orderCode,
        userId,
        reservationId,
        tableId,
        type,
        type === "dine_in" ? "pending" : "preparing",
        type === "dine_in" ? "pending_verification" : "unpaid",
        paymentMethod,
        type === "dine_in" ? normalizedGcashReference : null,
        type === "dine_in" ? normalizedGcashSenderName : null,
        type === "dine_in" ? "pending_verification" : null,
        total,
        customer?.customerName || null,
        customer?.contactNumber || null,
        qrCode,
        receiptToken
      ]
    );

    const order = orderResult.rows[0];

<<<<<<< HEAD
    for (const item of orderItems) {
=======
    for (const item of items) {
      const priceResult = await client.query(
        "SELECT price FROM restaurant.menu_items WHERE id = $1",
        [item.menu_item_id]
      );

      const price = Number(priceResult.rows[0].price);

>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
      await client.query(
        `INSERT INTO restaurant.order_items
         (order_id, menu_item_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.menuItemId, item.quantity, item.unitPrice, item.unitPrice * item.quantity]
      );
    }

    await auditService.insert(client, {
      userId,
      actorName,
      action: "ORDER_CREATED",
      module: "orders",
      entityId: order.id,
      newValues: {
        order_code: order.order_code,
        type: order.type,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        total_amount: order.total_amount,
        reservation_id: order.reservation_id,
      },
      details: {
        items: items.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })),
      },
    });

    if (type === "dine_in") {
      await createOrderNotification(client, order, {
        notificationType: "dine_in_payment_submitted",
        title: "Dine-in payment submitted",
        message: `Your dine-in order ${order.order_code} is pending payment verification.`,
        status: "pending_verification",
      });
    }

    for (const change of inventoryChanges) {
      await auditService.insert(client, {
        userId,
        actorName,
        action: "INVENTORY_DEDUCTED",
        module: "inventory",
        entityId: change.menu_item_id,
        previousValues: { stock_count: change.previous_stock_count },
        newValues: { stock_count: change.new_stock_count },
        details: { order_id: order.id, quantity: change.quantity },
      });
    }

    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505" && error.constraint === "orders_dine_in_gcash_reference_unique") {
      throw new Error("This GCash reference number has already been submitted.");
    }
    throw error;
  } finally {
    client.release();
  }
};

function parseOrderId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("A valid order ID is required.");
  }
  return id;
}

exports.findPendingPaymentOrders = async () => {
  const result = await db.query(
    `SELECT o.id, o.order_code, o.user_id, o.type, o.table_id, t.table_name,
            o.total_amount, o.payment_method, o.payment_status,
            o.gcash_reference, o.gcash_sender_name, o.created_at
     FROM restaurant.orders o
     LEFT JOIN restaurant.restaurant_tables t ON t.id = o.table_id
     WHERE o.deleted_at IS NULL
       AND o.type = 'dine_in'
       AND o.payment_status = 'pending_verification'
     ORDER BY o.created_at ASC`
  );
  return result.rows;
};

exports.findDineInPaymentRequests = async () => {
  const result = await db.query(
    `SELECT o.id, o.order_code, o.user_id, o.type, o.table_id, t.table_name,
            o.total_amount, o.payment_method, o.payment_status,
            o.gcash_reference, o.gcash_sender_name,
            COALESCE(
              NULLIF(BTRIM(o.customer_name), ''),
              NULLIF(BTRIM(r.customer_name), ''),
              NULLIF(BTRIM(u.full_name), '')
            ) AS customer_name,
            u.full_name AS account_name, o.created_at, o.payment_verified_at
     FROM restaurant.orders o
     LEFT JOIN restaurant.reservations r ON r.id = o.reservation_id
     LEFT JOIN restaurant.users u ON u.id = o.user_id
     LEFT JOIN restaurant.restaurant_tables t ON t.id = o.table_id
     WHERE o.deleted_at IS NULL
       AND o.type = 'dine_in'
       AND o.payment_status IN ('pending_verification', 'paid', 'rejected')
     ORDER BY o.created_at DESC`
  );
  return result.rows;
};

exports.findPendingDineInRefunds = async () => {
  const result = await db.query(
    `SELECT o.id, o.order_code, o.table_id, o.refund_amount, o.total_amount,
            o.expired_at, o.refund_status,
            COALESCE(NULLIF(BTRIM(o.customer_name), ''), NULLIF(BTRIM(u.full_name), ''))
              AS customer_name
     FROM restaurant.orders o
     LEFT JOIN restaurant.users u ON u.id = o.user_id
     WHERE o.deleted_at IS NULL
       AND o.type = 'dine_in'
       AND o.refund_status = 'pending'
     ORDER BY o.arrived_at NULLS FIRST, o.expired_at ASC`
  );
  return result.rows;
};

exports.findDineInRefunds = async () => {
  const result = await db.query(
    `SELECT o.id, o.order_code, o.refund_amount, o.total_amount,
            o.refund_status, o.arrived_at, o.arrival_deadline_at,
            o.refund_processing_started_at, processing_cashier.full_name AS processing_cashier_name,
            o.refund_completed_at,
            COALESCE(NULLIF(BTRIM(o.customer_name), ''), NULLIF(BTRIM(r.customer_name), ''),
                     NULLIF(BTRIM(u.full_name), '')) AS customer_name,
            cashier.full_name AS cashier_name
     FROM restaurant.orders o
     LEFT JOIN restaurant.users u ON u.id = o.user_id
     LEFT JOIN restaurant.reservations r ON r.id = o.reservation_id
     LEFT JOIN restaurant.users processing_cashier ON processing_cashier.id = o.refund_processing_by_user_id
     LEFT JOIN restaurant.users cashier ON cashier.id = o.refund_completed_by_user_id
     WHERE o.deleted_at IS NULL
       AND o.type = 'dine_in'
       AND o.arrived_at IS NOT NULL
       AND o.arrived_at > o.arrival_deadline_at
       AND o.refund_status IN ('pending', 'processing', 'completed')
     ORDER BY CASE o.refund_status
                WHEN 'pending' THEN 0
                WHEN 'processing' THEN 1
                ELSE 2
              END,
              o.refund_completed_at DESC NULLS FIRST, o.arrived_at DESC`
  );
  return result.rows;
};

exports.findLateArrivalRefunds = async () => {
  const result = await db.query(
    `SELECT o.id, o.order_code, o.total_amount, o.refund_amount, o.refund_status,
            o.contact_number, u.email AS customer_email,
            o.arrived_at, o.arrival_deadline_at, o.refund_processing_started_at,
            processing_cashier.full_name AS processing_cashier_name, o.refund_completed_at,
            cashier.full_name AS cashier_name,
            COALESCE(NULLIF(BTRIM(o.customer_name), ''), NULLIF(BTRIM(r.customer_name), ''),
                     NULLIF(BTRIM(u.full_name), '')) AS customer_name
     FROM restaurant.orders o
     LEFT JOIN restaurant.users u ON u.id = o.user_id
     LEFT JOIN restaurant.reservations r ON r.id = o.reservation_id
     LEFT JOIN restaurant.users processing_cashier ON processing_cashier.id = o.refund_processing_by_user_id
     LEFT JOIN restaurant.users cashier ON cashier.id = o.refund_completed_by_user_id
     WHERE o.deleted_at IS NULL
       AND o.type = 'dine_in'
       AND o.payment_status = 'paid'
       AND o.arrived_at IS NOT NULL
       AND o.arrived_at > o.arrival_deadline_at
       AND o.refund_status IN ('pending', 'processing', 'completed')
     ORDER BY CASE o.refund_status
                WHEN 'pending' THEN 0
                WHEN 'processing' THEN 1
                ELSE 2
              END,
              o.refund_completed_at DESC NULLS LAST, o.arrived_at DESC`
  );
  return result.rows;
};

exports.startLateArrivalRefundProcessing = async (orderId, actor) => {
  const id = parseOrderId(orderId);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE restaurant.orders
       SET refund_status = 'processing',
           refund_processing_by_user_id = $2,
           refund_processing_started_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND deleted_at IS NULL
         AND type = 'dine_in'
         AND payment_status = 'paid'
         AND refund_status = 'pending'
         AND arrived_at IS NOT NULL
         AND arrived_at > arrival_deadline_at
       RETURNING id, order_code, refund_amount, refund_status,
                 refund_processing_by_user_id, refund_processing_started_at`,
      [id, actor.id]
    );
    const refund = result.rows[0];
    if (!refund) {
      const error = new Error("This late-arrival refund is no longer pending.");
      error.statusCode = 409;
      throw error;
    }

    await auditService.insert(client, {
      userId: actor.id,
      actorName: actor.email || "cashier",
      action: "DINE_IN_LATE_ARRIVAL_REFUND_PROCESSING_STARTED",
      module: "orders",
      entityId: refund.id,
      newValues: {
        refund_status: refund.refund_status,
        refund_processing_by_user_id: refund.refund_processing_by_user_id,
        refund_processing_started_at: refund.refund_processing_started_at,
      },
    });
    await client.query("COMMIT");
    return refund;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.completeLateArrivalRefund = async (orderId, actor) => {
  const id = parseOrderId(orderId);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE restaurant.orders
       SET refund_status = 'completed',
           refund_completed_by_user_id = $2,
           refund_completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND deleted_at IS NULL
         AND type = 'dine_in'
         AND payment_status = 'paid'
         AND refund_status = 'processing'
         AND arrived_at IS NOT NULL
         AND arrived_at > arrival_deadline_at
       RETURNING id, order_code, refund_amount, refund_status,
                 refund_processing_by_user_id, refund_processing_started_at,
                 refund_completed_by_user_id, refund_completed_at`,
      [id, actor.id]
    );
    const refund = result.rows[0];
    if (!refund) {
      const error = new Error("This late-arrival refund is not currently processing.");
      error.statusCode = 409;
      throw error;
    }

    await auditService.insert(client, {
      userId: actor.id,
      actorName: actor.email || "cashier",
      action: "DINE_IN_LATE_ARRIVAL_REFUND_COMPLETED",
      module: "orders",
      entityId: refund.id,
      newValues: {
        refund_status: refund.refund_status,
        refund_processing_by_user_id: refund.refund_processing_by_user_id,
        refund_processing_started_at: refund.refund_processing_started_at,
        refund_completed_by_user_id: refund.refund_completed_by_user_id,
        refund_completed_at: refund.refund_completed_at,
      },
    });
    await client.query("COMMIT");
    return refund;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.confirmPayment = async (orderId, actor, receiptBaseUrl) => {
  const id = parseOrderId(orderId);
  if (!receiptBaseUrl) throw new Error("Receipt base URL is not configured.");
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT id, user_id, order_code, type, status, payment_status,
              gcash_reference, gcash_sender_name, receipt_token, table_id
       FROM restaurant.orders
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error("Order not found.");
    if (current.type !== "dine_in" || current.payment_status !== "pending_verification") {
      const error = new Error("This dine-in payment has already been reviewed.");
      error.statusCode = 409;
      throw error;
    }
    if (!String(current.gcash_reference || "").trim() ||
        !String(current.gcash_sender_name || "").trim()) {
      throw new Error("A GCash reference number and sender's name are required before confirmation.");
    }

    const receiptUrl = buildReceiptUrl(receiptBaseUrl, current.order_code, current.receipt_token);
    const qrCode = await QRCode.toDataURL(receiptUrl);
    const result = await client.query(
      `UPDATE restaurant.orders
       SET payment_status = 'paid',
           payment_verified_at = NOW(),
           arrival_deadline_at = NOW() + INTERVAL '30 minutes',
           dine_in_status = 'awaiting_arrival',
           status = 'preparing',
           qr_code = $2,
           updated_at = NOW()
       WHERE id = $1 AND payment_status = 'pending_verification'
       RETURNING *`,
      [id, qrCode]
    );
    const order = result.rows[0];
    if (!order) {
      const error = new Error("This dine-in payment has already been reviewed.");
      error.statusCode = 409;
      throw error;
    }

    await auditService.insert(client, {
      userId: actor?.id || null,
      actorName: actor?.email || actor?.full_name || "admin",
      action: "DINE_IN_PAYMENT_CONFIRMED",
      module: "orders",
      entityId: id,
      previousValues: { payment_status: current.payment_status },
      newValues: {
        payment_status: order.payment_status,
        payment_verified_at: order.payment_verified_at,
        arrival_deadline_at: order.arrival_deadline_at,
      },
    });
    await createOrderNotification(client, order, {
      notificationType: "dine_in_payment_confirmed",
      title: "Dine-in payment confirmed",
      message: `Payment for dine-in order ${order.order_code} is confirmed. Please arrive within 30 minutes.`,
      status: "paid",
    });

    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.rejectPayment = async (orderId, reason, actor) => {
  const id = parseOrderId(orderId);
  const rejectionReason = String(reason || "Payment could not be verified.").trim().slice(0, 500);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT id, user_id, order_code, type, payment_status, table_id
       FROM restaurant.orders
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error("Order not found.");
    if (current.type !== "dine_in" || current.payment_status !== "pending_verification") {
      const error = new Error("This dine-in payment has already been reviewed.");
      error.statusCode = 409;
      throw error;
    }

    const result = await client.query(
      `UPDATE restaurant.orders
       SET payment_status = 'rejected',
           payment_rejection_reason = $2,
           dine_in_status = 'rejected',
           status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1 AND payment_status = 'pending_verification'
       RETURNING *`,
      [id, rejectionReason]
    );
    const order = result.rows[0];
    await restoreDineInOrderInventory(client, id, actor?.email || actor?.full_name || "admin");
    await releaseDineInTable(client, current.table_id, id);
    await auditService.insert(client, {
      userId: actor?.id || null,
      actorName: actor?.email || actor?.full_name || "admin",
      action: "DINE_IN_PAYMENT_REJECTED",
      module: "orders",
      entityId: id,
      previousValues: { payment_status: current.payment_status },
      newValues: { payment_status: order.payment_status, reason: rejectionReason },
    });
    await createOrderNotification(client, order, {
      notificationType: "dine_in_payment_rejected",
      title: "Dine-in payment rejected",
      message: `Payment for dine-in order ${order.order_code} was rejected. ${rejectionReason}`,
      status: "rejected",
    });

    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.expireUnarrivedDineIns = async () => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const expiredResult = await client.query(
      `UPDATE restaurant.orders
       SET dine_in_status = 'expired',
           expired_at = COALESCE(expired_at, NOW()),
           updated_at = NOW()
       WHERE deleted_at IS NULL
         AND type = 'dine_in'
         AND payment_status = 'paid'
         AND payment_verified_at IS NOT NULL
         AND dine_in_status = 'awaiting_arrival'
         AND arrived_at IS NULL
         AND arrival_deadline_at <= NOW()
       RETURNING id`,
      []
    );

    await client.query("COMMIT");
    return expiredResult.rows.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.findCustomerPaymentStatus = async (orderId, userId) => {
  const id = parseOrderId(orderId);
  const result = await db.query(
    `SELECT o.id, o.order_code, o.type, o.status, o.payment_status, o.payment_method,
            o.table_id, t.table_name,
            o.total_amount, o.dine_in_status, o.payment_verified_at,
            o.arrival_deadline_at, o.arrived_at, o.expired_at, o.refund_amount,
            o.refund_status, o.payment_rejection_reason, o.qr_code,
            o.gcash_reference, o.gcash_sender_name
     FROM restaurant.orders o
     LEFT JOIN restaurant.restaurant_tables t ON t.id = o.table_id
     WHERE o.id = $1 AND o.user_id = $2 AND o.type = 'dine_in' AND o.deleted_at IS NULL`,
    [id, userId]
  );
  const order = result.rows[0];
  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }
  if (order.payment_status !== "paid") order.qr_code = null;
  return order;
};

exports.findKdsOrders = async () => {
  const result = await db.query(
<<<<<<< HEAD
    `SELECT *
     FROM restaurant.orders
     WHERE deleted_at IS NULL
       AND status IN ('pending', 'preparing', 'ready')
     ORDER BY created_at DESC`
=======
    `SELECT
       o.id,
       o.order_code,
       o.type,
       o.table_id,
       t.table_name,
       o.status,
       o.payment_status,
       o.payment_method,
       o.dine_in_status,
       o.arrival_deadline_at,
       o.total_amount,
       o.customer_name,
       o.created_at
     FROM restaurant.orders o
     LEFT JOIN restaurant.restaurant_tables t ON t.id = o.table_id
     WHERE o.deleted_at IS NULL
       AND o.status IN ('pending', 'preparing', 'ready')
       AND (o.type <> 'dine_in' OR o.dine_in_status IS NULL OR o.payment_status = 'paid')
     ORDER BY o.created_at DESC`
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  );

  return result.rows;
};

<<<<<<< HEAD
exports.updateStatus = async (id, status) => {
  if (!["preparing", "ready", "completed"].includes(status)) {
    throw new Error("Invalid order status.");
  }

=======
exports.updateStatus = async (id, status, actor) => {
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const previousResult = await client.query(
      `SELECT id, order_code, type, status, payment_status, dine_in_status
       FROM restaurant.orders
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );
    const previous = previousResult.rows[0];
    if (!previous) {
      throw new Error("Order not found.");
    }
    if (
      previous.type === "dine_in" &&
      ["pending_verification", "rejected"].includes(previous.payment_status)
    ) {
      throw new Error("This dine-in order cannot enter the kitchen before payment is verified.");
    }
    if (
      previous.type === "dine_in" &&
      status === "completed" &&
      previous.dine_in_status === "awaiting_arrival"
    ) {
      throw new Error("Record the customer's dine-in arrival before completing the order.");
    }

    const result = await client.query(
      `UPDATE restaurant.orders
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );

    const order = result.rows[0];

    if (!order) {
      throw new Error("Order not found.");
    }

    if (status === "completed") {
      const existingHistory = await client.query(
        `SELECT id
         FROM restaurant.order_history
         WHERE order_id = $1`,
        [id]
      );

      if (!existingHistory.rowCount) {
<<<<<<< HEAD
        const userResult = await client.query(
          `SELECT full_name, email
           FROM restaurant.users
           WHERE id = $1`,
          [order.user_id]
        );

        const user = userResult.rows[0] || {};

=======
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
        const itemsResult = await client.query(
          `SELECT 
             mi.item_name,
             oi.quantity,
             oi.unit_price,
             oi.subtotal
           FROM restaurant.order_items oi
           LEFT JOIN restaurant.menu_items mi ON mi.id = oi.menu_item_id
           WHERE oi.order_id = $1`,
          [id]
        );

        const orderedItems = itemsResult.rows
          .map((item) => {
            return `${item.item_name} x${item.quantity} - ₱${Number(item.subtotal).toFixed(2)}`;
          })
          .join(", ");

        await client.query(
          `INSERT INTO restaurant.order_history
           (
             order_id,
             order_code,
             customer_name,
             customer_email,
             order_type,
             payment_method,
             payment_status,
             total_amount,
             ordered_items,
             completed_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            order.id,
            order.order_code,
            order.customer_name || "Guest",
            "N/A",
            order.type,
            order.payment_method || "GCash",
<<<<<<< HEAD
            order.payment_status || "paid",
=======
            order.payment_status || "unpaid",
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
            order.total_amount,
            orderedItems
          ]
        );
      }

      if (order.type === "dine_in" && order.reservation_id) {
        const reservationResult = await client.query(
          `SELECT table_id
           FROM restaurant.reservations
           WHERE id = $1
           FOR UPDATE`,
          [order.reservation_id]
        );

        const tableId = reservationResult.rows[0]?.table_id;

        if (tableId) {
          await client.query(
            `UPDATE restaurant.reservations
             SET status = 'completed', updated_at = NOW()
             WHERE id = $1 AND status IN ('active', 'checked_in')`,
            [order.reservation_id]
          );

          await client.query(
            `UPDATE restaurant.chairs
             SET status = 'vacant', locked_until = NULL, updated_at = NOW()
             WHERE table_id = $1 AND deleted_at IS NULL`,
            [tableId]
          );

          await client.query(
            `UPDATE restaurant.restaurant_tables
             SET status = 'vacant', updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL`,
            [tableId]
          );
        }
      }
    }

    await auditService.insert(client, {
      userId: actor?.id || null,
      actorName: actor?.email || null,
      action: "ORDER_STATUS_UPDATED",
      module: "orders",
      entityId: order.id,
      previousValues: {
        status: previous.status,
        payment_status: previous.payment_status,
      },
      newValues: {
        status: order.status,
        payment_status: order.payment_status,
      },
    });

    await client.query("COMMIT");

    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

<<<<<<< HEAD
exports.softDelete = async (id) => {
  const result = await db.query(
    `UPDATE restaurant.orders
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
=======
exports.softDelete = async (id, actor) => {
  const client = await db.connect();
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

  try {
    await client.query("BEGIN");
    const previousResult = await client.query(
      "SELECT id, order_code, status FROM restaurant.orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id]
    );
    const previous = previousResult.rows[0];
    if (!previous) {
      await client.query("ROLLBACK");
      return null;
    }

    const result = await client.query(
      `UPDATE restaurant.orders
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, order_code, status, deleted_at`,
      [id]
    );
    const order = result.rows[0];

    await auditService.insert(client, {
      userId: actor?.id || null,
      actorName: actor?.email || null,
      action: "ORDER_CANCELLED",
      module: "orders",
      entityId: order.id,
      previousValues: { status: previous.status },
      newValues: { deleted_at: order.deleted_at, status: order.status },
    });

    await client.query("COMMIT");
    const orderResponse = { ...order };
    delete orderResponse.receipt_token;
    return orderResponse;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.findReceiptByCodeAndToken = async (code, token) => {
  const orderResult = await db.query(
    `SELECT
       o.id,
       o.order_code,
       o.type,
       o.status,
       o.payment_status,
       o.payment_method,
       o.total_amount,
<<<<<<< HEAD
       o.created_at,
       u.full_name
     FROM restaurant.orders o
     LEFT JOIN restaurant.users u ON u.id = o.user_id
=======
       o.customer_name,
       o.created_at
     FROM restaurant.orders o
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
     WHERE o.order_code = $1
       AND o.receipt_token = $2
       AND o.deleted_at IS NULL
       AND (o.type <> 'dine_in' OR o.dine_in_status IS NULL OR o.payment_status = 'paid')`,
    [code, token]
  );

  const order = orderResult.rows[0];

  if (!order) {
    return null;
  }

  const itemsResult = await db.query(
    `SELECT
      mi.item_name,
       oi.quantity,
       oi.unit_price,
       oi.subtotal
     FROM restaurant.order_items oi
     LEFT JOIN restaurant.menu_items mi ON mi.id = oi.menu_item_id
<<<<<<< HEAD
     WHERE oi.order_id = $1`,
=======
    WHERE oi.order_id = $1
      AND oi.deleted_at IS NULL
    ORDER BY oi.id`,
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
    [order.id]
  );

  return {
    order_code: order.order_code,
    type: order.type,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    total_amount: order.total_amount,
    customer_name: order.customer_name,
    created_at: order.created_at,
    items: itemsResult.rows,
  };
};

exports.getCategorySales = async () => {
  const result = await db.query(
    `WITH categories(category, normalized_name) AS (
       VALUES
         ('Appetizers', 'appetizers'),
         ('Beverages', 'beverages'),
         ('Desserts', 'desserts'),
         ('Main Course', 'main course')
     ),
     totals AS (
       SELECT
         c.category,
         SUM(oi.subtotal) AS total
       FROM restaurant.order_items oi
       JOIN restaurant.orders o
         ON o.id = oi.order_id
        AND o.deleted_at IS NULL
       JOIN restaurant.menu_items mi
         ON mi.id = oi.menu_item_id
       JOIN categories c
         ON CASE lower(btrim(mi.category))
              WHEN 'rice meals' THEN 'main course'
              ELSE lower(btrim(mi.category))
            END = c.normalized_name
       WHERE oi.deleted_at IS NULL
       GROUP BY c.category
     )
     SELECT
       c.category,
       COALESCE(t.total, 0) AS total
     FROM categories c
     LEFT JOIN totals t ON t.category = c.category
     ORDER BY CASE c.category
       WHEN 'Appetizers' THEN 1
       WHEN 'Beverages' THEN 2
       WHEN 'Desserts' THEN 3
       WHEN 'Main Course' THEN 4
     END`
  );

  return result.rows;
};

exports.findOrderHistory = async () => {
  const result = await db.query(
    `SELECT *
     FROM restaurant.order_history
     ORDER BY completed_at DESC`
  );

  return result.rows;
};

exports.getTodayIncome = async () => {
  const result = await db.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total_income
     FROM restaurant.order_history
     WHERE DATE(completed_at) = CURRENT_DATE`
  );

  return result.rows[0];
};
<<<<<<< HEAD
=======

exports.normalizeOrderItems = normalizeOrderItems;
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
