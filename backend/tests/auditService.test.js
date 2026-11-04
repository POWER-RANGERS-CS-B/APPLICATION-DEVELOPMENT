const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../config/db");
const auditService = require("../services/auditService");

test("audit values omit credential-like fields recursively", () => {
  const safe = auditService.sanitize({
    email: "actor@example.invalid",
    password: "must-not-be-saved",
    nested: {
      access_token: "must-not-be-saved",
      changed: true,
    },
  });

  assert.deepEqual(safe, {
    email: "actor@example.invalid",
    nested: { changed: true },
  });
});

test("audit values preserve dates as ISO strings", () => {
  assert.equal(
    auditService.sanitize({ updated_at: new Date("2026-01-02T03:04:05.000Z") }).updated_at,
    "2026-01-02T03:04:05.000Z"
  );
});

test("audit insert uses parameterized SQL and serialized JSON values", async () => {
  let inserted;
  const client = {
    async query(sql, values) {
      inserted = { sql, values };
      return { rowCount: 1 };
    },
  };

  await auditService.insert(client, {
    userId: 7,
    actorName: "Admin",
    action: "MENU_ITEM_UPDATED",
    module: "menu",
    entityId: 12,
    previousValues: { price: 10 },
    newValues: { price: 12 },
    details: { password_hash: "must-not-be-saved", source: "admin" },
  });

  assert.match(inserted.sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6::jsonb, \$7::jsonb, \$8::jsonb, NOW\(\)\)/);
  assert.equal(inserted.values[0], 7);
  assert.equal(inserted.values[2], "MENU_ITEM_UPDATED");
  assert.deepEqual(JSON.parse(inserted.values[5]), { price: 10 });
  assert.deepEqual(JSON.parse(inserted.values[6]), { price: 12 });
  assert.deepEqual(JSON.parse(inserted.values[7]), { source: "admin" });
  assert.doesNotMatch(JSON.stringify(inserted.values), /must-not-be-saved/);
});

test("audit transaction rolls back domain work if the audit insert fails", async () => {
  const originalConnect = db.connect;
  const statements = [];
  let released = false;
  db.connect = async () => ({
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith("INSERT INTO restaurant.audit_logs")) {
        throw new Error("simulated audit storage failure");
      }
      return { rowCount: 1 };
    },
    release() {
      released = true;
    },
  });

  try {
    await assert.rejects(
      auditService.transaction(async (client, insertAudit) => {
        await client.query("UPDATE restaurant.menu_items SET price = $1 WHERE id = $2", [12, 1]);
        await insertAudit({ action: "MENU_ITEM_UPDATED", module: "menu" });
      }),
      /simulated audit storage failure/
    );
    assert.equal(statements[0], "BEGIN");
    assert.equal(statements[1], "UPDATE restaurant.menu_items SET price = $1 WHERE id = $2");
    assert.match(statements[2], /INSERT INTO restaurant\.audit_logs/);
    assert.equal(statements[3], "ROLLBACK");
    assert.equal(released, true);
  } finally {
    db.connect = originalConnect;
  }
});
