const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

const dbPath = require.resolve("../config/db");
const db = { query: async () => ({ rows: [] }) };
const dbModule = new Module(dbPath);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = db;
require.cache[dbPath] = dbModule;

const orderModel = require("../models/orderModel");
const orderController = require("../controllers/orderController");

test("dine-in payment inbox query returns only dine-in payment requests with customer and table details", async (t) => {
  const originalQuery = db.query;
  let queryText = "";
  db.query = async (sql) => {
    queryText = sql;
    return { rows: [] };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  await orderModel.findDineInPaymentRequests();

  assert.match(queryText, /o\.type = 'dine_in'/);
  assert.match(queryText, /o\.payment_status IN \('pending_verification', 'paid', 'rejected'\)/);
  assert.match(queryText, /LEFT JOIN restaurant\.users u ON u\.id = o\.user_id/);
  assert.match(queryText, /LEFT JOIN restaurant\.reservations r ON r\.id = o\.reservation_id/);
  assert.match(queryText, /LEFT JOIN restaurant\.restaurant_tables t ON t\.id = o\.table_id/);
  assert.match(queryText, /NULLIF\(BTRIM\(o\.customer_name\), ''\)/);
  assert.match(queryText, /u\.full_name AS account_name/);
  assert.match(queryText, /FROM restaurant\.orders o/);
});

test("dine-in payment inbox endpoint disables caching and returns model records", async (t) => {
  const originalFindRequests = orderModel.findDineInPaymentRequests;
  const records = [{ id: 12, type: "dine_in", payment_status: "pending_verification" }];
  orderModel.findDineInPaymentRequests = async () => records;
  t.after(() => {
    orderModel.findDineInPaymentRequests = originalFindRequests;
  });

  let cacheControl;
  let responseBody;
  const response = {
    set(name, value) {
      if (name === "Cache-Control") cacheControl = value;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };

  await orderController.getDineInPaymentRequests({}, response);

  assert.equal(cacheControl, "no-store");
  assert.equal(responseBody, records);
});
