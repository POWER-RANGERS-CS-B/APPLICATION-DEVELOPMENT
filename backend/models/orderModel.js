const db = require("../config/db");
const QRCode = require("qrcode");
const crypto = require("crypto");

async function generateOrderCode(client) {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(Math.random() * 900) + 100);

    const existing = await client.query(
      "SELECT 1 FROM orders WHERE order_code = $1",
      [code]
    );

    if (!existing.rowCount) {
      return code;
    }
  }

  throw new Error("Cannot generate a unique order code.");
}

exports.create = async ({ userId, type, chairIds = [], items = [], paymentMethod = "Cash" }) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    let total = 0;
    let reservationId = null;
    const orderItems = [];

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Add at least one menu item before placing the order.");
    }

    if (type === "dine_in") {
      if (!chairIds.length) {
        throw new Error("Please select at least one chair for dine-in.");
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
        throw new Error("The selected table is no longer available. Please choose another table.");
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

      const dateValue = reservationDate || new Date().toISOString().split("T")[0];
      const timeValue = reservationTime || new Date().toTimeString().split(" ")[0];
      const resolvedName = customerName || "Customer";
      const resolvedContact = contactNumber || "N/A";

      const reservationResult = await client.query(
        `INSERT INTO restaurant.reservations
         (user_id, table_id, num_guests, status, reservation_date, reservation_time, customer_name, contact_number)
         VALUES ($1, $2, $3, 'checked_in', $4, $5, $6, $7)
         RETURNING id`,
        [userId, tableId, chairIds.length]
      );

      reservationId = reservationResult.rows[0].id;

      await client.query(
        `UPDATE chairs
         SET status = 'occupied', locked_until = NULL, updated_at = NOW()
         WHERE id = ANY($1::int[])`,
        [chairIds]
      );

    }

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for item ${item.menu_item_id}.`);
      }

      const menuResult = await client.query(
        `UPDATE restaurant.menu_items
         SET stock_count = stock_count - $2,
             updated_at = NOW()
         WHERE id = $1
           AND deleted_at IS NULL
           AND stock_count >= $2
         RETURNING price`,
        [item.menu_item_id, quantity]
      );

      const menuItem = menuResult.rows[0];

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
    }

    const orderCode = await generateOrderCode(client);

    const receiptToken = crypto.randomBytes(32).toString("hex");

    const receiptUrl =
      `http://192.168.43.118:3000/receipt.html?code=${orderCode}&token=${receiptToken}`;

    const qrCode = await QRCode.toDataURL(receiptUrl);

    const orderResult = await client.query(
      `INSERT INTO orders
   (
     order_code,
     user_id,
     reservation_id,
     type,
     status,
     payment_status,
     payment_method,
     total_amount,
     qr_code,
     receipt_token
   )
   VALUES (
     $1,
     $2,
     $3,
     $4,
     'preparing',
     'paid',
     $5,
     $6,
     $7,
     $8
   )
   RETURNING *`,
      [
        orderCode,
        userId,
        reservationId,
        type,
        paymentMethod,
        total,
        qrCode,
        receiptToken
      ]
    );

    const order = orderResult.rows[0];

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items
         (order_id, menu_item_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.menuItemId, item.quantity, item.unitPrice, item.unitPrice * item.quantity]
      );
    }

    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.findKdsOrders = async () => {
  const result = await db.query(
    `SELECT *
     FROM orders
     WHERE deleted_at IS NULL
       AND status IN ('pending', 'preparing', 'ready')
     ORDER BY created_at DESC`
  );

  return result.rows;
};

exports.updateStatus = async (id, status) => {
  if (!["preparing", "ready", "completed"].includes(status)) {
    throw new Error("Invalid order status.");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

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
         FROM order_history
         WHERE order_id = $1`,
        [id]
      );

      if (!existingHistory.rowCount) {
        const userResult = await client.query(
          `SELECT full_name, email
           FROM users
           WHERE id = $1`,
          [order.user_id]
        );

        const user = userResult.rows[0] || {};

        const itemsResult = await client.query(
          `SELECT 
             mi.item_name,
             oi.quantity,
             oi.unit_price,
             oi.subtotal
           FROM order_items oi
           LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
           WHERE oi.order_id = $1`,
          [id]
        );

        const orderedItems = itemsResult.rows
          .map((item) => {
            return `${item.item_name} x${item.quantity} - ₱${Number(item.subtotal).toFixed(2)}`;
          })
          .join(", ");

        await client.query(
          `INSERT INTO order_history
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
            user.full_name || "Customer",
            user.email || "N/A",
            order.type,
            order.payment_method || "Cash",
            order.payment_status || "paid",
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

    await client.query("COMMIT");

    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.softDelete = async (id) => {
  const result = await db.query(
    `UPDATE orders
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return result.rows[0];
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
       o.created_at,
       u.full_name
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.order_code = $1
       AND o.receipt_token = $2
       AND o.deleted_at IS NULL`,
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
     FROM order_items oi
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = $1`,
    [order.id]
  );

  return {
    ...order,
    items: itemsResult.rows,
  };
};

exports.findOrderHistory = async () => {
  const result = await db.query(
    `SELECT *
     FROM order_history
     ORDER BY completed_at DESC`
  );

  return result.rows;
};

exports.getTodayIncome = async () => {
  const result = await db.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total_income
     FROM order_history
     WHERE DATE(completed_at) = CURRENT_DATE`
  );

  return result.rows[0];
};
