const bcrypt = require("bcryptjs");
const db = require("../config/db");
const auditService = require("../services/auditService");

function accountConflict(field) {
  const error = new Error(`A user with this ${field} already exists.`);
  error.statusCode = 409;
  return error;
}

exports.findEmployees = async ({ search = "", role = "all", status = "all" } = {}) => {
  const result = await db.query(
    `SELECT id, full_name, username, email, role, deleted_at, created_at
     FROM restaurant.users
     WHERE role IN ('admin', 'staff', 'cashier')
       AND ($1 = '' OR full_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1)
       AND ($2 = 'all' OR role = $2)
       AND (
         $3 = 'all'
         OR ($3 = 'active' AND deleted_at IS NULL)
         OR ($3 = 'inactive' AND deleted_at IS NOT NULL)
       )
     ORDER BY full_name, id`,
    [search ? `%${search}%` : "", role, status]
  );

  return result.rows;
};

exports.createStaff = async ({ fullName, username, email, password, role = "staff" }, actor) => {
  const passwordHash = await bcrypt.hash(password, 12);

  return auditService.transaction(async (client, audit) => {
    const duplicate = await client.query(
      `SELECT
         bool_or(lower(username) = $1) AS username_taken,
         bool_or(lower(email) = $2) AS email_taken
       FROM restaurant.users
       WHERE lower(username) = $1 OR lower(email) = $2`,
      [username, email]
    );

    if (duplicate.rows[0]?.username_taken) throw accountConflict("username");
    if (duplicate.rows[0]?.email_taken) throw accountConflict("email address");

    const result = await client.query(
      `INSERT INTO restaurant.users
         (full_name, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, username, email, role, deleted_at, created_at`,
      [fullName, username, email, passwordHash, role]
    );
    const staff = result.rows[0];

    await audit({
      userId: actor.id,
      actorName: actor.email,
      action: "STAFF_ACCOUNT_CREATED",
      module: "users",
      entityId: staff.id,
      newValues: {
        full_name: staff.full_name,
        username: staff.username,
        email: staff.email,
        role: staff.role,
      },
    });

    return staff;
  });
};

exports.updateStaff = async (id, { fullName, username, email, role }, actor) => {
  return auditService.transaction(async (client, audit) => {
    const previousResult = await client.query(
      `SELECT id, full_name, username, email, role
       FROM restaurant.users
       WHERE id = $1 AND role IN ('staff', 'cashier')
       FOR UPDATE`,
      [id]
    );
    const previous = previousResult.rows[0];
    if (!previous) return null;

    const duplicate = await client.query(
      `SELECT
         bool_or(lower(username) = $1) AS username_taken,
         bool_or(lower(email) = $2) AS email_taken
       FROM restaurant.users
       WHERE id <> $3
         AND (lower(username) = $1 OR lower(email) = $2)`,
      [username, email, id]
    );

    if (duplicate.rows[0]?.username_taken) throw accountConflict("username");
    if (duplicate.rows[0]?.email_taken) throw accountConflict("email address");

    const result = await client.query(
      `UPDATE restaurant.users
       SET full_name = $2,
           username = $3,
           email = $4,
           role = $5,
           updated_at = NOW()
       WHERE id = $1 AND role IN ('staff', 'cashier')
       RETURNING id, full_name, username, email, role, deleted_at, created_at`,
      [id, fullName, username, email, role,]
    );
    const staff = result.rows[0];
    const roleChanged = previous.role !== staff.role;

    await audit({
      userId: actor.id,
      actorName: actor.email,
      action: roleChanged ? "STAFF_ROLE_CHANGED" : "STAFF_INFORMATION_UPDATED",
      module: "users",
      entityId: staff.id,
      previousValues: {
        full_name: previous.full_name,
        username: previous.username,
        email: previous.email,
        role: previous.role,
      },
      newValues: {
        full_name: staff.full_name,
        username: staff.username,
        email: staff.email,
        role: staff.role,
      },
    });

    return staff;
  });
};

exports.setStaffStatus = async (id, active, actor) => {
  return auditService.transaction(async (client, audit) => {
    const previousResult = await client.query(
      `SELECT id, full_name, username, email, role, deleted_at
       FROM restaurant.users
       WHERE id = $1 AND role IN ('staff', 'cashier')
       FOR UPDATE`,
      [id]
    );
    const previous = previousResult.rows[0];
    if (!previous) return null;

    const isActive = previous.deleted_at === null;
    if (isActive === active) return previous;

    const result = await client.query(
      `UPDATE restaurant.users
       SET deleted_at = CASE WHEN $2 THEN NULL ELSE NOW() END,
           updated_at = NOW()
       WHERE id = $1 AND role IN ('staff', 'cashier')
       RETURNING id, full_name, username, email, role, deleted_at, created_at`,
      [id, active]
    );
    const staff = result.rows[0];

    await audit({
      userId: actor.id,
      actorName: actor.email,
      action: active ? "STAFF_ACCOUNT_ACTIVATED" : "STAFF_ACCOUNT_DEACTIVATED",
      module: "users",
      entityId: staff.id,
      previousValues: { deleted_at: previous.deleted_at },
      newValues: { deleted_at: staff.deleted_at },
      details: { role: staff.role },
    });

    return staff;
  });
};
