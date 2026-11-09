const db = require("../config/db");

exports.findPage = async ({
  page,
  pageSize,
  search,
  userId,
  action,
  module,
  startDate,
  endDate,
}) => {
  const conditions = [];
  const values = [];
  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (search) {
    const parameter = addValue(`%${search}%`);
    conditions.push(`(
      COALESCE(a.actor_name, u.full_name, '') ILIKE ${parameter}
      OR a.action ILIKE ${parameter}
      OR COALESCE(a.module, '') ILIKE ${parameter}
      OR COALESCE(a.entity_id, '') ILIKE ${parameter}
      OR COALESCE(a.details::text, '') ILIKE ${parameter}
    )`);
  }
  if (userId === "anonymous") {
    conditions.push("a.user_id IS NULL");
  } else if (userId) {
    conditions.push(`a.user_id = ${addValue(Number(userId))}`);
  }
  if (action) conditions.push(`a.action = ${addValue(action)}`);
  if (module) conditions.push(`a.module = ${addValue(module)}`);
  if (startDate) conditions.push(`a.created_at >= ${addValue(startDate)}::date`);
  if (endDate) conditions.push(`a.created_at < (${addValue(endDate)}::date + INTERVAL '1 day')`);

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const totalResult = await db.query(
    `SELECT COUNT(*)::integer AS total
     FROM restaurant.audit_logs AS a
     LEFT JOIN restaurant.users AS u ON u.id = a.user_id
     ${whereClause}`,
    values
  );

  const offset = (page - 1) * pageSize;
  const pageValues = [...values, pageSize, offset];
  const pageResult = await db.query(
    `SELECT
       a.log_id,
       a.user_id,
       COALESCE(
         a.actor_name,
         u.full_name,
         CASE WHEN a.user_id IS NULL THEN 'Unauthenticated' ELSE 'User #' || a.user_id END
       ) AS actor_name,
       a.action,
       a.module,
       a.entity_id,
       a.previous_values,
       a.new_values,
       a.details,
       a.created_at
     FROM restaurant.audit_logs AS a
     LEFT JOIN restaurant.users AS u ON u.id = a.user_id
     ${whereClause}
     ORDER BY a.created_at DESC, a.log_id DESC
     LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
    pageValues
  );

  const [usersResult, actionsResult, modulesResult] = await Promise.all([
    db.query(
      `SELECT DISTINCT a.user_id,
         COALESCE(a.actor_name, u.full_name, CASE WHEN a.user_id IS NULL THEN 'Unauthenticated' ELSE 'User #' || a.user_id END) AS actor_name
       FROM restaurant.audit_logs AS a
       LEFT JOIN restaurant.users AS u ON u.id = a.user_id
       ORDER BY actor_name`
    ),
    db.query("SELECT DISTINCT action FROM restaurant.audit_logs ORDER BY action"),
    db.query("SELECT DISTINCT module FROM restaurant.audit_logs WHERE module IS NOT NULL ORDER BY module"),
  ]);
  const total = totalResult.rows[0].total;

  return {
    items: pageResult.rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    filters: {
      users: usersResult.rows,
      actions: actionsResult.rows.map((row) => row.action),
      modules: modulesResult.rows.map((row) => row.module),
    },
  };
};
