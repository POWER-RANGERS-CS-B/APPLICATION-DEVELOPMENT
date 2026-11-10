const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { installSessionAuth } = require("./helpers/sessionAuth");
const db = require("../config/db");
const auditService = require("../services/auditService");
const reservationModel = require("../models/reservationModel");
const reservationRoutes = require("../routes/reservationRoutes");
const sessionAuth = installSessionAuth();
test.after(() => sessionAuth.restore());

test("historical reservation archive is soft, audited, and transactional", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const statements = [];
  const auditEvents = [];
  const reservation = {
    id: 21,
    reservation_code: "RES-HISTORY-21",
    customer_name: "Customer Name",
    status: "completed",
    payment_status: "paid",
    deleted_at: null,
  };

  db.connect = async () => ({
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (/SELECT id, reservation_code, customer_name, status, payment_status/.test(sql)) {
        return { rows: reservation.deleted_at ? [] : [{ ...reservation }] };
      }
      if (/UPDATE restaurant\.reservations/.test(sql)) {
        reservation.deleted_at = "2026-11-07T09:00:00.000Z";
        return { rows: [{ id: reservation.id, deleted_at: reservation.deleted_at }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  auditService.insert = async (_client, event) => auditEvents.push(event);
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
  });

  const archived = await reservationModel.archiveHistoricalReservation(21, {
    actorId: 7,
    actorName: "admin@example.test",
  });
  assert.equal(archived.id, 21);
  assert.ok(archived.deleted_at);
  assert.equal(reservation.status, "completed");
  assert.ok(statements.some(({ sql }) => sql === "COMMIT"));
  const archiveUpdate = statements.find(({ sql }) => /UPDATE restaurant\.reservations/.test(sql));
  assert.deepEqual(archiveUpdate.values, [21]);
  assert.match(archiveUpdate.sql, /SET deleted_at = NOW\(\), updated_at = NOW\(\)/);
  assert.equal(auditEvents[0].action, "RESERVATION_HISTORY_ARCHIVED");
  assert.equal(auditEvents[0].entityId, 21);

  await assert.rejects(
    reservationModel.archiveHistoricalReservation(21),
    (error) => error.statusCode === 404
  );
});

test("active and pending reservations cannot be archived", async (t) => {
  const originalConnect = db.connect;
  const statements = [];
  db.connect = async () => ({
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (/SELECT id, reservation_code, customer_name, status, payment_status/.test(sql)) {
        return {
          rows: [{
            id: Number(values[0]),
            reservation_code: "RES-CURRENT",
            customer_name: "Current Customer",
            status: Number(values[0]) === 22 ? "active" : "pending_verification",
            payment_status: "pending_verification",
          }],
        };
      }
      return { rows: [] };
    },
    release() {},
  });
  t.after(() => {
    db.connect = originalConnect;
  });

  for (const id of [22, 23]) {
    await assert.rejects(
      reservationModel.archiveHistoricalReservation(id),
      (error) => error.statusCode === 409
    );
  }
  assert.equal(
    statements.filter(({ sql }) => /UPDATE restaurant\.reservations/.test(sql)).length,
    0
  );
});

test("only admins can archive historical reservations through the API", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const statements = [];
  const auditEvents = [];
  let archived = false;
  db.connect = async () => ({
    async query(sql) {
      statements.push(sql);
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (/SELECT id, reservation_code, customer_name, status, payment_status/.test(sql)) {
        return {
          rows: archived ? [] : [{
            id: 21,
            reservation_code: "RES-HISTORY-21",
            customer_name: "Customer Name",
            status: "rejected",
            payment_status: "rejected",
          }],
        };
      }
      if (/UPDATE restaurant\.reservations/.test(sql)) {
        archived = true;
        return { rows: [{ id: 21, deleted_at: "2026-11-07T09:00:00.000Z" }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  auditService.insert = async (_client, event) => auditEvents.push(event);
  const app = express();
  app.use(sessionAuth.cookieParser());
  app.use(express.json());
  app.use("/api/reservations", reservationRoutes);
  const server = app.listen(0);
  t.after(async () => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/reservations/21`;
  const staffToken = sessionAuth.cookieFor("staff", 8);
  const staffResponse = await fetch(baseUrl, {
    method: "DELETE",
    headers: {
      Cookie: staffToken,
      Connection: "close",
    },
  });
  assert.equal(staffResponse.status, 403);

  const adminToken = sessionAuth.cookieFor("admin", 7);
  const adminResponse = await fetch(baseUrl, {
      method: "DELETE",
      headers: {
        Cookie: adminToken,
        Connection: "close",
      },
    });
  assert.equal(adminResponse.status, 200);
  assert.deepEqual(await adminResponse.json(), {
    id: 21,
    deleted_at: "2026-11-07T09:00:00.000Z",
  });
  assert.ok(statements.includes("COMMIT"));
  assert.equal(auditEvents[0].action, "RESERVATION_HISTORY_ARCHIVED");
});
