const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

const dbPath = require.resolve("../config/db");
const db = {};
const dbModule = new Module(dbPath);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = db;
require.cache[dbPath] = dbModule;

const orderModel = require("../models/orderModel");
const auditService = require("../services/auditService");
const QRCode = require("qrcode");

function mockClient(handler) {
  const statements = [];
  return {
    statements,
    client: {
      async query(sql, values = []) {
        statements.push({ sql, values });
        return handler(sql, values);
      },
      release() {},
    },
  };
}

test("admin confirmation starts the deadline and creates the confirmed QR and customer notification", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const originalToDataURL = QRCode.toDataURL;
  const confirmedOrder = {
    id: 8,
    user_id: 42,
    order_code: "481",
    type: "dine_in",
    payment_status: "paid",
    dine_in_status: "awaiting_arrival",
    payment_verified_at: new Date(),
    arrival_deadline_at: new Date(Date.now() + 30 * 60 * 1000),
    receipt_token: "private-token",
    qr_code: "data:image/png;base64,confirmed",
  };
  const mock = mockClient((sql) => {
    if (/SELECT id, user_id, order_code, type, status, payment_status/.test(sql)) {
      return {
        rows: [{
          id: 8,
          user_id: 42,
          order_code: "481",
          type: "dine_in",
          status: "pending",
          payment_status: "pending_verification",
          gcash_reference: "REF-1",
          gcash_sender_name: "Customer",
          receipt_token: "private-token",
          table_id: 4,
        }],
      };
    }
    if (/UPDATE restaurant\.orders\s+SET payment_status = 'paid'/.test(sql)) {
      return { rows: [confirmedOrder] };
    }
    return { rows: [], rowCount: 1 };
  });
  db.connect = async () => mock.client;
  auditService.insert = async () => {};
  QRCode.toDataURL = async (url) => {
    assert.match(url, /receipt\.html/);
    return confirmedOrder.qr_code;
  };
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
    QRCode.toDataURL = originalToDataURL;
  });

  const result = await orderModel.confirmPayment(8, { id: 1, email: "admin@example.test" }, "https://dine-ari.example");
  assert.equal(result.payment_status, "paid");
  assert.equal(result.dine_in_status, "awaiting_arrival");
  assert.ok(mock.statements.some(({ sql }) => /NOW\(\) \+ INTERVAL '30 minutes'/.test(sql)));
  assert.ok(mock.statements.some(({ sql, values }) =>
    /INSERT INTO restaurant\.customer_notifications/.test(sql) &&
    values[2] === "dine_in_payment_confirmed"
  ));
});

test("Dine-in rejection cancels the order, releases an unused table, and notifies the customer", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const mock = mockClient((sql) => {
    if (/SELECT id, user_id, order_code, type, payment_status, table_id/.test(sql)) {
      return {
        rows: [{
          id: 9,
          user_id: 42,
          order_code: "482",
          type: "dine_in",
          payment_status: "pending_verification",
          table_id: 5,
        }],
      };
    }
    if (/UPDATE restaurant\.orders\s+SET payment_status = 'rejected'/.test(sql)) {
      return { rows: [{ id: 9, user_id: 42, order_code: "482", payment_status: "rejected" }] };
    }
    if (/UPDATE restaurant\.restaurant_tables/.test(sql)) return { rows: [{ id: 5 }] };
    return { rows: [], rowCount: 1 };
  });
  db.connect = async () => mock.client;
  auditService.insert = async () => {};
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
  });

  const result = await orderModel.rejectPayment(9, "Reference does not match.", { id: 1 });
  assert.equal(result.payment_status, "rejected");
  assert.ok(mock.statements.some(({ sql, values }) =>
    /SET payment_status = 'rejected'/.test(sql) &&
    values[1] === "Reference does not match."
  ));
  assert.ok(mock.statements.some(({ sql }) => /SET status = 'vacant'/.test(sql)));
  assert.ok(mock.statements.some(({ sql, values }) =>
    /INSERT INTO restaurant\.customer_notifications/.test(sql) &&
    values[2] === "dine_in_payment_rejected"
  ));
});

test("an overdue dine-in order remains active and QR-eligible without a premature refund", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const mock = mockClient((sql) => {
    if (/UPDATE restaurant\.orders\s+SET dine_in_status = 'expired'/.test(sql)) {
      return { rows: [{ id: 10 }] };
    }
    return { rows: [], rowCount: 1 };
  });
  db.connect = async () => mock.client;
  auditService.insert = async () => {};
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
  });

  assert.equal(await orderModel.expireUnarrivedDineIns(), 1);
  const expiration = mock.statements.find(({ sql }) => /UPDATE restaurant\.orders\s+SET dine_in_status = 'expired'/.test(sql));
  assert.ok(expiration);
  assert.match(expiration.sql, /payment_verified_at IS NOT NULL/);
  assert.match(expiration.sql, /dine_in_status = 'awaiting_arrival'/);
  assert.match(expiration.sql, /arrived_at IS NULL/);
  assert.match(expiration.sql, /arrival_deadline_at <= NOW\(\)/);
  assert.doesNotMatch(expiration.sql, /status = 'cancelled'/);
  assert.doesNotMatch(expiration.sql, /refund_status = 'pending'/);
});

test("customer Dine-in payment status is scoped to the owner and withholds an unconfirmed QR", async (t) => {
  const originalQuery = db.query;
  let queryText = "";
  db.query = async (sql) => {
    queryText = sql;
    return {
      rows: [{
        id: 12,
        user_id: 42,
        type: "dine_in",
        payment_status: "pending_verification",
        qr_code: "unconfirmed",
      }],
    };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const order = await orderModel.findCustomerPaymentStatus(12, 42);
  assert.match(queryText, /o\.id = \$1 AND o\.user_id = \$2/);
  assert.match(queryText, /t\.table_name/);
  assert.match(queryText, /o\.gcash_reference, o\.gcash_sender_name/);
  assert.equal(order.qr_code, null);
});
