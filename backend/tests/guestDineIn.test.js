const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");
const express = require("express");
const jwt = require("jsonwebtoken");

const jwtSecret = process.env.JWT_SECRET || "dine-in-auth-test-secret";
process.env.JWT_SECRET = jwtSecret;

const dbPath = require.resolve("../config/db");
const db = {};
const dbModule = new Module(dbPath);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = db;
require.cache[dbPath] = dbModule;

const chairModel = require("../models/chairModel");
const chairController = require("../controllers/chairController");
const orderModel = require("../models/orderModel");
const orderController = require("../controllers/orderController");
const auditService = require("../services/auditService");
const QRCode = require("qrcode");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function tokenFor(role, id = 42) {
  return jwt.sign({ id, role, email: `${role}@example.test` }, jwtSecret);
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function listen(app, t) {
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}/api`;
}

test("dine-in order route requires a customer token and reservations remain protected", async (t) => {
  const originalCreateOrder = orderController.createOrder;
  orderController.createOrder = (req, res) =>
    res.status(201).json({ role: req.user?.role || "guest" });
  const orderRoutesPath = require.resolve("../routes/orderRoutes");
  delete require.cache[orderRoutesPath];
  const orderRoutes = require(orderRoutesPath);
  orderController.createOrder = originalCreateOrder;

  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRoutes);
  app.use("/api/reservations", require("../routes/reservationRoutes"));
  const baseUrl = await listen(app, t);

  const guestResponse = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "dine_in" }),
  });
  assert.equal(guestResponse.status, 401);

  const customerResponse = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: authHeaders(tokenFor("customer")),
    body: JSON.stringify({ type: "dine_in" }),
  });
  assert.equal(customerResponse.status, 201);
  assert.deepEqual(await customerResponse.json(), { role: "customer" });

  const adminResponse = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: authHeaders(tokenFor("admin")),
    body: JSON.stringify({ type: "dine_in" }),
  });
  assert.equal(adminResponse.status, 403);

  const reservationResponse = await fetch(`${baseUrl}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(reservationResponse.status, 401);
});

test("Dine-in payment review is admin-only and arrival requires the QR scanner", async (t) => {
  const methods = [
    "getPendingPaymentOrders",
    "confirmPayment",
    "rejectPayment",
    "getCustomerPaymentStatus",
  ];
  const originals = Object.fromEntries(methods.map((name) => [name, orderController[name]]));
  orderController.getPendingPaymentOrders = (_req, res) => res.json([{ id: 8 }]);
  orderController.confirmPayment = (req, res) => res.json({ role: req.user.role });
  orderController.rejectPayment = (req, res) => res.json({ role: req.user.role });
  orderController.getCustomerPaymentStatus = (req, res) => res.json({ customerId: req.user.id });
  const orderRoutesPath = require.resolve("../routes/orderRoutes");
  delete require.cache[orderRoutesPath];
  const orderRoutes = require(orderRoutesPath);
  methods.forEach((name) => {
    orderController[name] = originals[name];
  });

  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRoutes);
  const baseUrl = await listen(app, t);

  const unauthorizedQueue = await fetch(`${baseUrl}/orders/pending-verification`, {
    headers: authHeaders(tokenFor("customer")),
  });
  assert.equal(unauthorizedQueue.status, 403);

  const adminQueue = await fetch(`${baseUrl}/orders/pending-verification`, {
    headers: authHeaders(tokenFor("admin")),
  });
  assert.equal(adminQueue.status, 200);
  assert.deepEqual(await adminQueue.json(), [{ id: 8 }]);

  const directArrival = await fetch(`${baseUrl}/orders/8/arrival`, {
    method: "PATCH",
    headers: authHeaders(tokenFor("staff")),
  });
  assert.equal(directArrival.status, 404);

  const customerStatus = await fetch(`${baseUrl}/orders/8/payment-status`, {
    headers: authHeaders(tokenFor("customer", 42)),
  });
  assert.equal(customerStatus.status, 200);
  assert.deepEqual(await customerStatus.json(), { customerId: 42 });
});

test("dine-in table locks require an authenticated customer", async (t) => {
  const originalLockTable = chairModel.lockTable;
  const locked = [{ id: 21, table_id: 4 }];
  let actor;
  chairModel.lockTable = async (_tableId, requestActor) => {
    actor = requestActor;
    return locked;
  };
  t.after(() => {
    chairModel.lockTable = originalLockTable;
  });

  const app = express();
  app.use(express.json());
  app.use("/api/chairs", require("../routes/chairRoutes"));
  const baseUrl = await listen(app, t);
  const body = JSON.stringify({ tableId: 4, orderType: "dine_in" });

  const guestResponse = await fetch(`${baseUrl}/chairs/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  assert.equal(guestResponse.status, 401);

  const customerResponse = await fetch(`${baseUrl}/chairs/lock`, {
    method: "POST",
    headers: authHeaders(tokenFor("customer")),
    body,
  });
  assert.equal(customerResponse.status, 200);
  assert.deepEqual(await customerResponse.json(), locked);
  assert.equal(actor.id, 42);
  assert.equal(actor.role, "customer");

  const adminResponse = await fetch(`${baseUrl}/chairs/lock`, {
    method: "POST",
    headers: authHeaders(tokenFor("admin")),
    body,
  });
  assert.equal(adminResponse.status, 403);
});

test("order controller rejects guests and associates authenticated Dine-In orders with the customer", async (t) => {
  const originalCreate = orderModel.create;
  let orderInput;
  orderModel.create = async (input) => {
    orderInput = input;
    return { id: 150, order_code: "573", type: "dine_in", table_id: 4 };
  };
  t.after(() => {
    orderModel.create = originalCreate;
  });

  const orderRequest = {
    body: {
      type: "dine_in",
      chairIds: [21, 22],
      items: [{ menu_item_id: 7, quantity: 1 }],
    },
    get: () => "localhost:3000",
    hostname: "localhost",
    protocol: "http",
  };

  const guestResponse = createResponse();
  await orderController.createOrder(orderRequest, guestResponse);
  assert.equal(guestResponse.statusCode, 401);
  assert.equal(orderInput, undefined);

  const customerResponse = createResponse();
  await orderController.createOrder(
    { ...orderRequest, user: { id: 42, role: "customer", email: "customer@example.test" } },
    customerResponse
  );
  assert.equal(customerResponse.statusCode, 201);
  assert.equal(customerResponse.body.id, 150);
  assert.equal(orderInput.userId, 42);
  assert.equal(orderInput.type, "dine_in");
  assert.deepEqual(orderInput.chairIds, [21, 22]);

  const staffResponse = createResponse();
  await orderController.createOrder(
    { ...orderRequest, user: { id: 7, role: "staff" } },
    staffResponse
  );
  assert.equal(staffResponse.statusCode, 403);
});

test("Dine-In order insertion keeps the authenticated customer and selected table linked", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const originalToDataURL = QRCode.toDataURL;
  const statements = [];
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (/FROM restaurant\.chairs\s+WHERE id = \$1/.test(sql)) {
        return { rows: [{ table_id: 4 }] };
      }
      if (/FROM restaurant\.restaurant_tables/.test(sql)) {
        return { rows: [{ id: 4, status: "reserved" }] };
      }
      if (/FROM restaurant\.chairs\s+WHERE table_id = \$1/.test(sql)) {
        return { rows: [{ id: 21, status: "reserved" }, { id: 22, status: "reserved" }] };
      }
      if (/FROM restaurant\.menu_items/.test(sql)) {
        return { rows: [{ id: 7, stock_count: 5, price: "12.50" }] };
      }
      if (/SELECT 1 FROM restaurant\.orders/.test(sql)) {
        return { rowCount: 0, rows: [] };
      }
      if (/INSERT INTO restaurant\.orders/.test(sql)) {
        return {
          rows: [{
            id: 150,
            order_code: values[0],
            user_id: values[1],
            table_id: values[3],
            type: values[4],
          }],
        };
      }
      if (/SELECT price FROM restaurant\.menu_items/.test(sql)) {
        return { rows: [{ price: "12.50" }] };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  db.connect = async () => client;
  auditService.insert = async () => {};
  QRCode.toDataURL = async () => "data:image/png;base64,receipt";
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
    QRCode.toDataURL = originalToDataURL;
  });

  const result = await orderModel.create({
    userId: 42,
    actorName: "customer@example.test",
    type: "dine_in",
    chairIds: [21, 22],
    items: [{ menu_item_id: 7, quantity: 1 }],
    gcashReference: "GCASH-TEST-REF",
    gcashSenderName: "Test Sender",
    receiptBaseUrl: "http://localhost:3000",
  });

  const orderInsert = statements.find(({ sql }) => /INSERT INTO restaurant\.orders/.test(sql));
  assert.ok(orderInsert);
  assert.match(orderInsert.sql, /table_id/);
  assert.equal(orderInsert.values[1], 42);
  assert.equal(orderInsert.values[3], 4);
  assert.equal(orderInsert.values[4], "dine_in");
  assert.equal(orderInsert.values[5], "pending");
  assert.equal(orderInsert.values[6], "pending_verification");
  assert.equal(orderInsert.values[8], "GCASH-TEST-REF");
  assert.equal(orderInsert.values[9], "Test Sender");
  assert.equal(orderInsert.values[10], "pending_verification");
  assert.equal(orderInsert.values[14], null);
  assert.equal(result.id, 150);
  assert.equal(result.table_id, 4);
  assert.ok(statements.some(({ sql }) => sql === "COMMIT"));
});
