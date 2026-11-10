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

function configureReservationMocks(initialReservation) {
  const originalConnect = db.connect;
  const originalQuery = db.query;
  const originalAuditInsert = auditService.insert;
  const statements = [];
  const auditEvents = [];
  const reservation = { ...initialReservation };

  db.query = async () => ({
    rows: [
      "payment_status",
      "verified_at",
      "qr_code",
      "reservation_rejection_reason",
    ].map((column_name) => ({ column_name })),
  });
  db.connect = async () => ({
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (/SELECT id, user_id, status, payment_method, gcash_reference/.test(sql)) {
        return { rows: [{ ...reservation }] };
      }
      if (/SELECT id, user_id, status, table_id/.test(sql)) {
        return { rows: [{ ...reservation }] };
      }
      if (/UPDATE restaurant\.reservations/.test(sql)) {
        if (sql.includes("status = 'confirmed'")) {
          reservation.status = "confirmed";
          reservation.payment_status = "paid";
          reservation.verified_at = "2026-11-05T10:00:00Z";
          reservation.qr_code = values[1];
        } else {
          reservation.status = "rejected";
          reservation.payment_status = "rejected";
          reservation.reservation_rejection_reason = values[1];
        }
        return { rows: [{ ...reservation }] };
      }
      if (/UPDATE restaurant\.restaurant_tables/.test(sql)) {
        return { rows: [{ id: reservation.table_id }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  auditService.insert = async (_client, event) => auditEvents.push(event);

  return {
    auditEvents,
    restore() {
      db.connect = originalConnect;
      db.query = originalQuery;
      auditService.insert = originalAuditInsert;
    },
    statements,
  };
}

test("Admin confirmation atomically marks payment paid and prevents repeat confirmation", async (t) => {
  const mocks = configureReservationMocks({
    id: 41,
    user_id: 19,
    status: "pending_verification",
    payment_method: "GCash",
    gcash_reference: "GCASH-41",
    gcash_sender_name: "Customer Sender",
    reservation_code: "RES-41-UNIQUE",
    reservation_token: `rsv-${"x".repeat(32)}`,
    table_id: 8,
  });
  t.after(mocks.restore);

  const confirmed = await reservationModel.confirm(41, {
    actorId: 7,
    actorName: "admin@example.test",
  });
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.payment_status, "paid");
  assert.match(confirmed.qr_code, /^data:image\/png;base64,/);
  assert.equal(
    mocks.statements.filter(({ sql }) => /INSERT INTO restaurant\.customer_notifications/.test(sql)).length,
    1
  );
  const confirmationNotification = mocks.statements.find(({ sql }) =>
    /INSERT INTO restaurant\.customer_notifications/.test(sql)
  );
  assert.equal(JSON.parse(confirmationNotification.values[5]).reservation_token, `rsv-${"x".repeat(32)}`);
  assert.ok(mocks.statements.some(({ sql }) => sql === "COMMIT"));
  assert.equal(mocks.auditEvents[0].action, "RESERVATION_CONFIRMED");

  await assert.rejects(
    reservationModel.confirm(41),
    (error) => error.statusCode === 409
  );
  assert.equal(
    mocks.statements.filter(({ sql }) => /UPDATE restaurant\.reservations/.test(sql)).length,
    1
  );
});

test("Admin cannot confirm a GCash reservation without its reference number", async (t) => {
  const mocks = configureReservationMocks({
    id: 42,
    status: "pending_verification",
    payment_method: "GCash",
    gcash_reference: " ",
    gcash_sender_name: "",
    reservation_code: "RES-42-UNIQUE",
    table_id: 9,
  });
  t.after(mocks.restore);

  await assert.rejects(
    reservationModel.confirm(42),
    /GCash reference number and sender's name are required/
  );
  assert.equal(
    mocks.statements.some(({ sql }) => /UPDATE restaurant\.reservations/.test(sql)),
    false
  );
  assert.ok(mocks.statements.some(({ sql }) => sql === "ROLLBACK"));
});

test("Admin rejection requires a reason, preserves it, and releases the table transactionally", async (t) => {
  const mocks = configureReservationMocks({
    id: 43,
    user_id: 19,
    status: "pending_verification",
    payment_method: "GCash",
    gcash_reference: "GCASH-43",
    gcash_sender_name: "Customer Sender",
    table_id: 10,
  });
  t.after(mocks.restore);

  const rejected = await reservationModel.reject(43, "Payment reference could not be verified.", {
    actorId: 7,
    actorName: "admin@example.test",
  });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.payment_status, "rejected");
  assert.equal(rejected.reservation_rejection_reason, "Payment reference could not be verified.");
  assert.equal(
    mocks.statements.filter(({ sql }) => /INSERT INTO restaurant\.customer_notifications/.test(sql)).length,
    1
  );
  assert.ok(mocks.statements.some(({ sql }) => /UPDATE restaurant\.restaurant_tables/.test(sql)));
  assert.ok(mocks.statements.some(({ sql }) => /UPDATE restaurant\.chairs/.test(sql)));
  assert.ok(mocks.statements.some(({ sql }) => sql === "COMMIT"));
  assert.equal(mocks.auditEvents[0].action, "RESERVATION_REJECTED");
});

test("Reservation rejection cannot be submitted without a reason", async () => {
  await assert.rejects(
    reservationModel.reject(44, "  "),
    /A rejection reason is required/
  );
});

test("customer payment resubmission validates fields and returns to pending verification", async (t) => {
  const originalConnect = db.connect;
  const originalQuery = db.query;
  const originalAuditInsert = auditService.insert;
  const statements = [];
  const auditEvents = [];
  const reservation = {
    id: 45,
    user_id: 19,
    table_id: 12,
    status: "rejected",
    payment_method: "GCash",
  };
  db.query = async () => ({
    rows: [{ column_name: "gcash_sender_name" }],
  });
  db.connect = async () => ({
    async query(sql, values = []) {
      statements.push(sql);
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (/SELECT id, user_id, table_id, status, payment_method/.test(sql)) {
        return { rows: [{ ...reservation }] };
      }
      if (/SELECT id, status[\s\S]*FROM restaurant\.restaurant_tables/.test(sql)) {
        return { rows: [{ id: reservation.table_id, status: "vacant" }] };
      }
      if (/UPDATE restaurant\.reservations/.test(sql)) {
        reservation.status = "pending_verification";
        reservation.payment_status = "pending_verification";
        reservation.gcash_reference = values[1];
        reservation.gcash_sender_name = values[2];
        return { rows: [{ ...reservation }] };
      }
      return { rows: [] };
    },
    release() {},
  });
  auditService.insert = async (_client, event) => auditEvents.push(event);
  t.after(() => {
    db.connect = originalConnect;
    db.query = originalQuery;
    auditService.insert = originalAuditInsert;
  });

  const pending = await reservationModel.resubmitPayment(
    `rsv-${"x".repeat(32)}`,
    { reference: "GCASH-45-NEW", senderName: "Sender Name" }
  );
  assert.equal(pending.status, "pending_verification");
  assert.equal(pending.payment_status, "pending_verification");
  assert.equal(pending.gcash_reference, "GCASH-45-NEW");
  assert.equal(pending.gcash_sender_name, "Sender Name");
  assert.equal(
    statements.filter((sql) => /INSERT INTO restaurant\.customer_notifications/.test(sql)).length,
    1
  );
  assert.ok(statements.includes("COMMIT"));
  assert.equal(auditEvents[0].action, "RESERVATION_PAYMENT_RESUBMITTED");

  await assert.rejects(
    reservationModel.resubmitPayment(`rsv-${"x".repeat(32)}`, {
      reference: " ",
      senderName: "Sender Name",
    }),
    /reference number/
  );
});

test("reservation QR validation requires paid confirmation and prevents duplicate check-in", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const reservation = {
    id: 46,
    customer_name: "Customer Name",
    contact_number: "+639171234567",
    reservation_date: "2026-11-06",
    reservation_time: "18:00",
    num_guests: 2,
    status: "confirmed",
    payment_status: "paid",
    verified_at: new Date().toISOString(),
    table_id: 13,
  };
  const auditEvents = [];
  db.connect = async () => ({
    async query(sql) {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (/SELECT id, user_id, reservation_code/.test(sql)) return { rows: [{ ...reservation }] };
      if (/UPDATE restaurant\.reservations/.test(sql)) {
        reservation.status = "active";
        reservation.arrived_at = new Date();
        reservation.arrival_qr_revoked_at = new Date();
        return { rows: [{ ...reservation }] };
      }
      if (/SELECT table_name/.test(sql)) return { rows: [{ table_name: "Table 2" }] };
      return { rows: [] };
    },
    release() {},
  });
  auditService.insert = async (_client, event) => auditEvents.push(event);
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
  });

  const checkedIn = await reservationModel.validateReceipt("RES-46-UNIQUE", {
    actorId: 7,
    actorName: "admin@example.test",
  });
  assert.equal(checkedIn.status, "active");
  assert.equal(checkedIn.table_name, "Table 2");
  assert.equal(auditEvents[0].action, "RESERVATION_CHECKED_IN");
  await assert.rejects(
    reservationModel.validateReceipt("RES-46-UNIQUE"),
    (error) => error.statusCode === 409
  );
});

test("staff accounts cannot confirm or reject reservations", async (t) => {
  const app = express();
  app.use(sessionAuth.cookieParser());
  app.use(express.json());
  app.use("/api/reservations", reservationRoutes);
  const server = app.listen(0);
  const cookie = sessionAuth.cookieFor("staff", 8);
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  for (const [path, body] of [
    ["/api/reservations/51/confirm", undefined],
    ["/api/reservations/51/reject", { reason: "Not available" }],
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        ...(body ? { "Content-Type": "application/json" } : {}),
        Connection: "close",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, 403);
  }
});
