const test = require("node:test");
const assert = require("node:assert/strict");

const executedStatements = [];
const mockDb = {
  async query(sql) {
    const statement = sql.trim();
    executedStatements.push(statement);
    if (statement.startsWith("SELECT o.id")) return { rows: [dineInCurrent] };
    if (statement.startsWith("SELECT r.id")) return { rows: [reservationCurrent] };
    return { rows: [] };
  },
  async connect() {
    return {
      async query(sql) {
        const statement = sql.trim();
        executedStatements.push(statement);
        if (statement === "BEGIN" || statement === "COMMIT" || statement === "ROLLBACK") {
          return { rows: [] };
        }
        if (statement.startsWith("SELECT o.id")) {
          return { rows: [dineInCurrent] };
        }
        if (statement.startsWith("SELECT r.id")) {
          return { rows: [reservationCurrent] };
        }
        if (statement.startsWith("UPDATE restaurant.orders")) {
          return { rows: [dineInUpdated] };
        }
        if (statement.startsWith("UPDATE restaurant.reservations")) {
          return { rows: [reservationUpdated] };
        }
        if (statement.startsWith("SELECT table_name")) {
          return { rows: [{ table_name: "Table 1" }] };
        }
        return { rows: [] };
      },
      release() {},
    };
  },
};

const dbPath = require.resolve("../config/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: mockDb,
};

const auditService = require("../services/auditService");
auditService.insert = async () => {};
const arrivalScannerModel = require("../models/arrivalScannerModel");

const dineInCurrent = {
  id: 1,
  user_id: 5,
  order_code: "123",
  type: "dine_in",
  status: "preparing",
  payment_status: "paid",
  payment_verified_at: new Date().toISOString(),
  dine_in_status: "awaiting_arrival",
  arrival_deadline_at: new Date(Date.now() + 60_000).toISOString(),
  arrived_at: null,
  arrival_qr_revoked_at: null,
  customer_name: "Registered Customer",
  table_name: "Table 1",
};

const reservationCurrent = {
  id: 2,
  user_id: 6,
  reservation_code: "RES-123",
  status: "confirmed",
  payment_status: "paid",
  verified_at: new Date().toISOString(),
  arrived_at: null,
  arrival_qr_revoked_at: null,
  reservation_date: new Date().toISOString().slice(0, 10),
  reservation_time: "23:59:00",
  num_guests: 2,
  customer_name: "Reservation Customer",
  table_name: "Table 1",
  reservation_expired: false,
};

const dineInUpdated = {
  id: dineInCurrent.id,
  user_id: dineInCurrent.user_id,
  order_code: dineInCurrent.order_code,
  status: dineInCurrent.status,
  payment_status: dineInCurrent.payment_status,
  payment_verified_at: dineInCurrent.payment_verified_at,
  dine_in_status: "arrived",
  arrival_deadline_at: dineInCurrent.arrival_deadline_at,
  arrived_at: new Date().toISOString(),
  customer_name: null,
  table_id: 1,
};

const reservationUpdated = {
  id: reservationCurrent.id,
  user_id: reservationCurrent.user_id,
  reservation_code: reservationCurrent.reservation_code,
  status: "active",
  payment_status: reservationCurrent.payment_status,
  verified_at: reservationCurrent.verified_at,
  arrived_at: new Date().toISOString(),
  reservation_date: reservationCurrent.reservation_date,
  reservation_time: reservationCurrent.reservation_time,
  num_guests: reservationCurrent.num_guests,
  customer_name: null,
  table_id: 1,
};

test("late paid dine-in QR is confirmed and the refund amount is returned", async () => {
  const originalDeadline = dineInCurrent.arrival_deadline_at;
  const originalStatus = dineInCurrent.dine_in_status;
  const originalTotal = dineInCurrent.total_amount;
  const originalUpdatedDeadline = dineInUpdated.arrival_deadline_at;
  const originalUpdatedTotal = dineInUpdated.total_amount;
  const originalRefundAmount = dineInUpdated.refund_amount;
  const originalRefundStatus = dineInUpdated.refund_status;
  dineInCurrent.arrival_deadline_at = new Date(Date.now() - 60_000).toISOString();
  dineInCurrent.dine_in_status = "expired";
  dineInCurrent.total_amount = "200.00";
  dineInUpdated.arrival_deadline_at = dineInCurrent.arrival_deadline_at;
  dineInUpdated.total_amount = "200.00";
  dineInUpdated.refund_amount = "100.00";
  dineInUpdated.refund_status = "pending";

  try {
    const result = await arrivalScannerModel.confirm(
      `https://dine-ari.example/receipt.html?code=123&token=${"a".repeat(64)}`,
      { id: 9, email: "staff@example.test" }
    );
    assert.equal(result.scan_status, "confirmed");
    assert.equal(result.is_late, true);
    assert.equal(result.customer_name, "Registered Customer");
    assert.equal(result.total_amount, 200);
    assert.equal(result.refund_amount, 100);
    assert.equal(result.refund_status, "pending");
    assert.ok(result.arrived_at);
    assert.match(executedStatements.find((sql) => sql.startsWith("SELECT o.id")), /FOR UPDATE OF o/);
    const updateSql = executedStatements.find((sql) => sql.startsWith("UPDATE restaurant.orders"));
    assert.match(updateSql, /arrival_qr_revoked_at = NOW\(\)/);
    assert.match(updateSql, /ROUND\(total_amount \* 0\.50, 2\)/);
    assert.match(executedStatements.find((sql) => sql.startsWith("SELECT o.id")), /COALESCE\([\s\S]*o\.customer_name[\s\S]*u\.full_name/);
  } finally {
    dineInCurrent.arrival_deadline_at = originalDeadline;
    dineInCurrent.dine_in_status = originalStatus;
    dineInCurrent.total_amount = originalTotal;
    dineInUpdated.arrival_deadline_at = originalUpdatedDeadline;
    dineInUpdated.total_amount = originalUpdatedTotal;
    dineInUpdated.refund_amount = originalRefundAmount;
    dineInUpdated.refund_status = originalRefundStatus;
  }
});

test("rescanning a used dine-in QR reports QR Code Already Used", async () => {
  const originalRevokedAt = dineInCurrent.arrival_qr_revoked_at;
  dineInCurrent.arrival_qr_revoked_at = new Date();

  try {
    const result = await arrivalScannerModel.validate(
      `https://dine-ari.example/receipt.html?code=123&token=${"a".repeat(64)}`,
      { id: 9, email: "staff@example.test" }
    );
    assert.equal(result.scan_status, "already_used");
    assert.equal(result.message, "QR Code Already Used");
  } finally {
    dineInCurrent.arrival_qr_revoked_at = originalRevokedAt;
  }
});

test("failed dine-in payment verification does not consume the QR", async () => {
  const originalPaymentStatus = dineInCurrent.payment_status;
  const originalVerifiedAt = dineInCurrent.payment_verified_at;
  dineInCurrent.payment_status = "pending_verification";
  dineInCurrent.payment_verified_at = null;
  executedStatements.length = 0;

  try {
    const result = await arrivalScannerModel.confirm(
      `https://dine-ari.example/receipt.html?code=123&token=${"a".repeat(64)}`,
      { id: 9, email: "staff@example.test" }
    );
    assert.equal(result.scan_status, "pending_payment");
    assert.equal(executedStatements.some((sql) => sql.startsWith("UPDATE restaurant.orders")), false);
  } finally {
    dineInCurrent.payment_status = originalPaymentStatus;
    dineInCurrent.payment_verified_at = originalVerifiedAt;
  }
});

test("failed reservation payment verification does not consume the QR", async () => {
  const originalPaymentStatus = reservationCurrent.payment_status;
  const originalVerifiedAt = reservationCurrent.verified_at;
  reservationCurrent.payment_status = "pending_verification";
  reservationCurrent.verified_at = null;
  executedStatements.length = 0;

  try {
    const result = await arrivalScannerModel.confirm(
      `DINEARI:RES:rsv-${"A".repeat(43)}`,
      { id: 9, email: "staff@example.test" }
    );
    assert.equal(result.scan_status, "pending_payment");
    assert.equal(executedStatements.some((sql) => sql.startsWith("UPDATE restaurant.reservations")), false);
  } finally {
    reservationCurrent.payment_status = originalPaymentStatus;
    reservationCurrent.verified_at = originalVerifiedAt;
  }
});

test("confirmed dine-in response retains the joined customer name", async () => {
  const result = await arrivalScannerModel.confirm(
    `https://dine-ari.example/receipt.html?code=123&token=${"a".repeat(64)}`,
    { id: 9, email: "staff@example.test" }
  );

  assert.equal(result.scan_status, "confirmed");
  assert.equal(result.customer_name, "Registered Customer");
});

test("confirmed reservation response retains its customer name", async () => {
  const result = await arrivalScannerModel.confirm(
    `DINEARI:RES:rsv-${"A".repeat(43)}`,
    { id: 9, email: "staff@example.test" }
  );

  assert.equal(result.scan_status, "confirmed");
  assert.equal(result.customer_name, "Reservation Customer");
  assert.match(executedStatements.find((sql) => sql.startsWith("SELECT r.id")), /COALESCE\([\s\S]*r\.customer_name[\s\S]*u\.full_name/);
});
