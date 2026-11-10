const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

const dbPath = require.resolve("../config/db");
const db = {
  query: async () => ({ rows: [] }),
  connect: async () => {
    throw new Error("A database client mock was not configured.");
  },
};
const dbModule = new Module(dbPath);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = db;
require.cache[dbPath] = dbModule;

const auditService = require("../services/auditService");
const tableModel = require("../models/tableModel");

function configureClient(initialStatus = "occupied") {
  let tableStatus = initialStatus;
  const statements = [];
  const client = {
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      if (/SELECT id, table_name, status/.test(sql)) {
        return {
          rows: [{
            id: 8,
            table_name: "Table 8",
            status: tableStatus,
          }],
        };
      }
      if (/SELECT id, status\s+FROM restaurant\.chairs/.test(sql)) {
        return { rows: [{ id: 81, status: "occupied" }] };
      }
      if (/SELECT id, status\s+FROM restaurant\.reservations/.test(sql)) {
        return { rows: [{ id: 91, status: "active" }] };
      }
      if (/UPDATE restaurant\.restaurant_tables/.test(sql)) {
        tableStatus = params[1];
        return {
          rows: [{
            id: 8,
            table_name: "Table 8",
            status: tableStatus,
            position_x: 120,
            position_y: 80,
            updated_at: "2026-11-05T00:00:00Z",
          }],
        };
      }
      return { rows: [] };
    },
    release() {},
  };
  db.connect = async () => client;
  return { statements, getStatus: () => tableStatus };
}

test("staff cleaning workflow persists only the allowed table status transitions", async (t) => {
  const originalInsert = auditService.insert;
  const auditedEvents = [];
  auditService.insert = async (_client, event) => {
    auditedEvents.push(event);
  };
  t.after(() => {
    auditService.insert = originalInsert;
  });

  const { statements, getStatus } = configureClient();
  const actor = { id: 4, email: "staff@example.test" };

  const needsCleaning = await tableModel.markNeedsCleaning(8, actor);
  assert.equal(getStatus(), "needs_cleaning");
  assert.equal(needsCleaning.table.status, "needs_cleaning");
  assert.equal(
    statements.some(({ sql }) => /UPDATE restaurant\.chairs/.test(sql)),
    false
  );

  const cleaning = await tableModel.startCleaning(8, actor);
  assert.equal(getStatus(), "cleaning");
  assert.equal(cleaning.table.status, "cleaning");

  const clean = await tableModel.markCleaned(8, actor);
  assert.equal(getStatus(), "vacant");
  assert.equal(clean.table.status, "vacant");
  assert.ok(statements.some(({ sql }) => /UPDATE restaurant\.chairs/.test(sql)));
  assert.ok(statements.some(({ sql }) => /UPDATE restaurant\.reservations/.test(sql)));
  assert.deepEqual(
    auditedEvents.map(({ newValues }) => newValues.table_status),
    ["needs_cleaning", "cleaning", "vacant"]
  );
  assert.ok(statements.some(({ sql }) => sql === "COMMIT"));
});

test("staff cannot skip the cleaning steps or clean an occupied table directly", async (t) => {
  const { statements, getStatus } = configureClient("occupied");

  await assert.rejects(
    tableModel.markCleaned(8, { id: 4 }),
    (error) => error.statusCode === 409
  );

  assert.equal(getStatus(), "occupied");
  assert.equal(
    statements.some(({ sql }) => /UPDATE restaurant\.(restaurant_tables|chairs|reservations)/.test(sql)),
    false
  );
  assert.ok(statements.some(({ sql }) => sql === "ROLLBACK"));
});

test("table cleaning rejects invalid IDs without opening a transaction", async () => {
  let connectCalled = false;
  const originalConnect = db.connect;
  db.connect = async () => {
    connectCalled = true;
    throw new Error("Unexpected connection.");
  };

  try {
    await assert.rejects(
      tableModel.markNeedsCleaning("1; DROP TABLE restaurant_tables", { id: 4 }),
      (error) => error.statusCode === 400
    );
    assert.equal(connectCalled, false);
  } finally {
    db.connect = originalConnect;
  }
});
