const db = require("../config/db");

const SENSITIVE_KEY = /(password|secret|token|authorization|api.?key|credential)/i;

function sanitize(value, depth = 0) {
  if (value instanceof Date) return value.toISOString();
  if (depth > 5 || value === null || typeof value !== "object") {
    if (typeof value === "string") return value.slice(0, 1000);
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .slice(0, 100)
      .map(([key, item]) => [key, sanitize(item, depth + 1)])
  );
}

async function insert(client, event) {
  const {
    userId = null,
    actorName = null,
    action,
    module,
    entityId = null,
    previousValues = null,
    newValues = null,
    details = null,
  } = event;

  await client.query(
    `INSERT INTO restaurant.audit_logs
       (user_id, actor_name, action, module, entity_id,
        previous_values, new_values, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, NOW())`,
    [
      userId,
      actorName ? String(actorName).slice(0, 255) : null,
      String(action).slice(0, 100),
      String(module).slice(0, 100),
      entityId === null || entityId === undefined ? null : String(entityId).slice(0, 255),
      previousValues === null ? null : JSON.stringify(sanitize(previousValues)),
      newValues === null ? null : JSON.stringify(sanitize(newValues)),
      details === null ? null : JSON.stringify(sanitize(details)),
    ]
  );
}

async function record(event) {
  try {
    await insert(db, event);
    return true;
  } catch {
    console.error("Audit event could not be recorded.");
    return false;
  }
}

async function transaction(work) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client, (event) => insert(client, event));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      console.error("Audit-enabled transaction rollback failed.");
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { insert, record, sanitize, transaction };
