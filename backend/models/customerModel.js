const db = require("../config/db");

function createCustomerError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

exports.getProfile = async (userId) => {
  const result = await db.query(
    `SELECT id, full_name, email, contact_number, preferred_theme
     FROM restaurant.users
     WHERE id = $1 AND role = 'customer' AND deleted_at IS NULL`,
    [userId]
  );
  if (!result.rows[0]) throw createCustomerError("Customer account not found.", 404);
  return result.rows[0];
};

exports.updateProfile = async (userId, { fullName, email, contactNumber }) => {
  try {
    const result = await db.query(
      `UPDATE restaurant.users
       SET full_name = $2, email = $3, username = $3, contact_number = $4,
           updated_at = NOW()
       WHERE id = $1 AND role = 'customer' AND deleted_at IS NULL
       RETURNING id, full_name, email, contact_number, preferred_theme`,
      [userId, fullName, email, contactNumber]
    );
    if (!result.rows[0]) throw createCustomerError("Customer account not found.", 404);
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      throw createCustomerError("An account with this email address already exists.", 409);
    }
    throw error;
  }
};

exports.updateSettings = async (userId, { preferredTheme }) => {
  const result = await db.query(
    `UPDATE restaurant.users
     SET preferred_theme = $2, updated_at = NOW()
     WHERE id = $1 AND role = 'customer' AND deleted_at IS NULL
     RETURNING preferred_theme`,
    [userId, preferredTheme]
  );
  if (!result.rows[0]) throw createCustomerError("Customer account not found.", 404);
  return result.rows[0];
};

exports.listNotifications = async (userId) => {
  const result = await db.query(
    `SELECT id, reservation_id, order_id, notification_type, title, message, metadata,
            created_at, read_at
     FROM restaurant.customer_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return result.rows;
};

exports.getUnreadNotificationCount = async (userId) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM restaurant.customer_notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return Number(result.rows[0]?.unread_count || 0);
};

exports.getReservation = async (userId, reservationId) => {
  const result = await db.query(
    `SELECT r.reservation_code, r.customer_name, r.contact_number,
            r.num_guests, r.status, r.payment_status, r.payment_method,
            r.gcash_reference, r.arrived_at,
            r.reservation_rejection_reason,
            CASE
              WHEN r.status IN ('confirmed', 'verified', 'active', 'completed')
                AND r.payment_status = 'paid'
              THEN r.qr_code
              ELSE NULL
            END AS qr_code,
            r.updated_at, r.created_at,
            r.reservation_date::text AS reservation_date,
            r.reservation_time::text AS reservation_time,
            rt.table_name
     FROM restaurant.reservations r
     LEFT JOIN restaurant.restaurant_tables rt ON rt.id = r.table_id
     WHERE r.id = $1 AND r.user_id = $2 AND r.deleted_at IS NULL`,
    [reservationId, userId]
  );
  if (!result.rows[0]) throw createCustomerError("Reservation not found.", 404);
  return result.rows[0];
};

exports.markNotificationRead = async (userId, notificationId, isRead = true) => {
  const result = await db.query(
    `UPDATE restaurant.customer_notifications
     SET read_at = CASE WHEN $3 THEN COALESCE(read_at, NOW()) ELSE NULL END
     WHERE id = $1 AND user_id = $2
     RETURNING id, read_at`,
    [notificationId, userId, isRead]
  );
  if (!result.rows[0]) throw createCustomerError("Notification not found.", 404);
  return result.rows[0];
};

exports.markAllNotificationsRead = async (userId) => {
  const result = await db.query(
    `UPDATE restaurant.customer_notifications
     SET read_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL
     RETURNING id`,
    [userId]
  );
  return { updatedCount: result.rowCount ?? result.rows.length };
};

exports.deleteNotification = async (userId, notificationId) => {
  const result = await db.query(
    `DELETE FROM restaurant.customer_notifications
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );
  if (!result.rows[0]) throw createCustomerError("Notification not found.", 404);
  return { id: result.rows[0].id };
};

exports.revokeToken = async (userId, tokenId, expiresAt) => {
  await db.query(
    `INSERT INTO restaurant.revoked_auth_tokens (token_id, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_id) DO NOTHING`,
    [tokenId, userId, expiresAt]
  );
};
