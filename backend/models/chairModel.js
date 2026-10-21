const db = require("../config/db");

exports.findAll = async () => {
  const result = await db.query(
    `SELECT *
     FROM chairs
     WHERE deleted_at IS NULL
     ORDER BY id`
  );

  return result.rows;
};

exports.lockChairs = async (chairIds) => {
  const result = await db.query(
    `UPDATE chairs
     SET status = 'locked',
         locked_until = NOW() + INTERVAL '10 minutes',
         updated_at = NOW()
     WHERE id = ANY($1::int[])
       AND status = 'vacant'
       AND deleted_at IS NULL
     RETURNING *`,
    [chairIds]
  );

  if (result.rowCount !== chairIds.length) {
    throw new Error("Some chairs are no longer available.");
  }

  return result.rows;
};

exports.releaseExpiredLocks = async () => {
  const result = await db.query(
    `UPDATE chairs
     SET status = 'vacant',
         locked_until = NULL,
         updated_at = NOW()
     WHERE status = 'locked'
       AND locked_until < NOW()
     RETURNING *`
  );

  return result.rows;
};
