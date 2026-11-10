const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");
const { installSessionAuth } = require("./helpers/sessionAuth");
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
const tableRoutes = require("../routes/tableRoutes");
const sessionAuth = installSessionAuth();
test.after(() => sessionAuth.restore());
const originalAuditInsert = auditService.insert;
process.env.JWT_SECRET = "staff-table-occupancy-test-secret";

function configureClient({
  initialStatus = "vacant",
  hasActiveReservation = false,
  initialChairStatus = "vacant",
} = {}) {
  let tableStatus = initialStatus;
  let chairStatus = initialChairStatus;
  const statements = [];
  const client = {
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return { rows: [] };
      }
      if (/SELECT id, table_name, status\s+FROM restaurant\.restaurant_tables/.test(sql)) {
        return {
          rows: [{
            id: 8,
            table_name: "Table 8",
            status: tableStatus,
          }],
        };
      }
      if (/FROM restaurant\.reservations/.test(sql)) {
        return {
          rows: hasActiveReservation
            ? [{ id: 91, status: "confirmed", reservation_date: "2099-01-01", reservation_time: "18:00" }]
            : [],
        };
      }
      if (/SELECT id, status\s+FROM restaurant\.chairs/.test(sql)) {
        return { rows: [{ id: 81, status: chairStatus }] };
      }
      if (/UPDATE restaurant\.chairs/.test(sql)) {
        chairStatus = "occupied";
        return { rows: [] };
      }
      if (/UPDATE restaurant\.restaurant_tables/.test(sql)) {
        tableStatus = "occupied";
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
  return {
    statements,
    getTableStatus: () => tableStatus,
    getChairStatus: () => chairStatus,
  };
}

test("staff walk-in occupancy updates the table and its chairs in one audited transaction", async (t) => {
  const auditedEvents = [];
  auditService.insert = async (_client, event) => {
    auditedEvents.push(event);
  };
  t.after(() => {
    auditService.insert = originalAuditInsert;
  });

  const fixture = configureClient();
  const result = await tableModel.markOccupiedForWalkIn(8, {
    id: 4,
    email: "staff@example.test",
  });

  assert.equal(result.table.status, "occupied");
  assert.equal(fixture.getTableStatus(), "occupied");
  assert.equal(fixture.getChairStatus(), "occupied");
  assert.ok(fixture.statements.some(({ sql }) =>
    /FROM restaurant\.restaurant_tables[\s\S]*FOR UPDATE/.test(sql)
  ));
  assert.ok(fixture.statements.some(({ sql }) => /UPDATE restaurant\.chairs/.test(sql)));
  assert.ok(fixture.statements.some(({ sql }) =>
    /WHERE id = \$1 AND status = 'vacant'/.test(sql)
  ));
  assert.ok(fixture.statements.some(({ sql }) => sql === "COMMIT"));
  assert.equal(auditedEvents[0].action, "TABLE_STATUS_CHANGED");
  assert.equal(auditedEvents[0].newValues.occupancy_type, "walk_in");
});

test("walk-in occupancy rejects reserved tables and active reservation conflicts without updates", async () => {
  const reserved = configureClient({ initialStatus: "reserved" });
  await assert.rejects(
    tableModel.markOccupiedForWalkIn(8, { id: 4 }),
    (error) => error.statusCode === 409 && /reserved or held/.test(error.message)
  );
  assert.equal(
    reserved.statements.some(({ sql }) => /UPDATE restaurant\.(restaurant_tables|chairs)/.test(sql)),
    false
  );

  const reservationConflict = configureClient({ hasActiveReservation: true });
  await assert.rejects(
    tableModel.markOccupiedForWalkIn(8, { id: 4 }),
    (error) => error.statusCode === 409 && /active reservation/.test(error.message)
  );
  assert.equal(
    reservationConflict.statements.some(({ sql }) => /UPDATE restaurant\.(restaurant_tables|chairs)/.test(sql)),
    false
  );
  assert.ok(reservationConflict.statements.some(({ sql }) => sql === "ROLLBACK"));
});

test("walk-in occupancy does not overwrite unavailable chair states", async () => {
  const fixture = configureClient({ initialChairStatus: "reserved" });
  await assert.rejects(
    tableModel.markOccupiedForWalkIn(8, { id: 4 }),
    (error) => error.statusCode === 409 && /unavailable seats/.test(error.message)
  );
  assert.equal(fixture.getTableStatus(), "vacant");
  assert.equal(fixture.getChairStatus(), "reserved");
  assert.equal(
    fixture.statements.some(({ sql }) => /UPDATE restaurant\.(restaurant_tables|chairs)/.test(sql)),
    false
  );
});

test("a second occupancy attempt cannot reuse an already occupied table", async () => {
  const fixture = configureClient();
  await tableModel.markOccupiedForWalkIn(8, { id: 4 });

  await assert.rejects(
    tableModel.markOccupiedForWalkIn(8, { id: 5 }),
    (error) => error.statusCode === 409 && /status is occupied/.test(error.message)
  );
  assert.equal(
    fixture.statements.filter(({ sql }) => /UPDATE restaurant\.restaurant_tables/.test(sql)).length,
    1
  );
});

test("only staff or admins can use the occupancy endpoint", async (t) => {
  const fixture = configureClient();
  auditService.insert = async () => {};
  t.after(() => {
    auditService.insert = originalAuditInsert;
  });

  const app = express();
  app.use(sessionAuth.cookieParser());
  app.use(express.json(), tableRoutes);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}/8/occupy`;

  const unauthenticated = await fetch(baseUrl, { method: "PATCH" });
  assert.equal(unauthenticated.status, 401);

  const customerCookie = sessionAuth.cookieFor("customer", 12);
  const forbidden = await fetch(baseUrl, {
    method: "PATCH",
    headers: { Cookie: customerCookie },
  });
  assert.equal(forbidden.status, 401);

  const staffCookie = sessionAuth.cookieFor("staff", 4);
  const accepted = await fetch(baseUrl, {
    method: "PATCH",
    headers: { Cookie: staffCookie },
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).table.status, "occupied");
  assert.equal(fixture.getTableStatus(), "occupied");
});

test("table listing includes capacity and filters reservation conflicts by active status and date", async () => {
  let queryText = "";
  const originalQuery = db.query;
  db.query = async (query) => {
    queryText = query;
    return { rows: [{ id: 8, status: "vacant", capacity: 4, has_active_reservation: true }] };
  };
  try {
    const tables = await tableModel.findAll();
    assert.equal(tables[0].capacity, 4);
    assert.equal(tables[0].has_active_reservation, true);
    assert.match(queryText, /r\.status IN \('active', 'pending_verification', 'verified', 'confirmed'\)/);
    assert.match(queryText, /r\.reservation_date IS NULL OR r\.reservation_date >= CURRENT_DATE/);
    assert.match(queryText, /COUNT\(\*\)::int/);
  } finally {
    db.query = originalQuery;
  }
});
