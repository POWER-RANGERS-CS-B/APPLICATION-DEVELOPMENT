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

test("category sales query aggregates actual item subtotals by canonical category", async (t) => {
  const originalQuery = db.query;
  let queryText = "";
  db.query = async (sql) => {
    queryText = sql;
    return {
      rows: [
        { category: "Appetizers", total: "125.00" },
        { category: "Beverages", total: "60.00" },
        { category: "Desserts", total: "0" },
        { category: "Main Course", total: "300.00" },
      ],
    };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const rows = await orderModel.getCategorySales();

  assert.deepEqual(rows.map(({ category }) => category), [
    "Appetizers",
    "Beverages",
    "Desserts",
    "Main Course",
  ]);
  assert.match(queryText, /SUM\(oi\.subtotal\)/);
  assert.match(queryText, /JOIN restaurant\.orders o/);
  assert.match(queryText, /JOIN restaurant\.menu_items mi/);
  assert.match(queryText, /WHEN 'rice meals' THEN 'main course'/);
  assert.match(queryText, /oi\.deleted_at IS NULL/);
  assert.match(queryText, /o\.deleted_at IS NULL/);
  assert.doesNotMatch(queryText, /SUM\(o\.total_amount\)/);
});

test("public receipt lookup returns only receipt fields and non-deleted items", async (t) => {
  const originalQuery = db.query;
  const statements = [];
  db.query = async (sql) => {
    statements.push(sql);
    if (statements.length === 1) {
      return {
        rows: [{
          id: 12,
          order_code: "123",
          type: "takeout",
          status: "preparing",
          payment_status: "unpaid",
          payment_method: "Card",
          total_amount: "25.00",
          customer_name: "Guest",
          contact_number: "private",
          receipt_token: "private",
          created_at: "2026-11-05T00:00:00Z",
        }],
      };
    }

    return {
      rows: [{
        item_name: "Test item",
        quantity: 1,
        unit_price: "25.00",
        subtotal: "25.00",
      }],
    };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const receipt = await orderModel.findReceiptByCodeAndToken(
    "123",
    "a".repeat(64)
  );

  assert.equal(receipt.order_code, "123");
  assert.equal(receipt.items.length, 1);
  assert.equal("id" in receipt, false);
  assert.equal("contact_number" in receipt, false);
  assert.equal("receipt_token" in receipt, false);
  assert.match(statements[0], /o\.receipt_token = \$2/);
  assert.match(statements[1], /oi\.deleted_at IS NULL/);
});

test("KDS order payload excludes receipt capabilities", async (t) => {
  const originalQuery = db.query;
  let queryText = "";
  db.query = async (sql) => {
    queryText = sql;
    return { rows: [] };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  await orderModel.findKdsOrders();

  assert.match(queryText, /SELECT\s+o\.id,\s+o\.order_code,\s+o\.type,\s+o\.table_id/s);
  assert.match(queryText, /LEFT JOIN restaurant\.restaurant_tables t ON t\.id = o\.table_id/);
  assert.doesNotMatch(queryText, /receipt_token|qr_code|\*/);
});

test("receipt endpoint rejects malformed references without querying the database", async (t) => {
  const originalLookup = orderModel.findReceiptByCodeAndToken;
  let lookupCalled = false;
  orderModel.findReceiptByCodeAndToken = async () => {
    lookupCalled = true;
    return null;
  };
  t.after(() => {
    orderModel.findReceiptByCodeAndToken = originalLookup;
  });

  const response = {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await orderController.getReceipt(
    { query: { code: "123", token: "short" } },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(lookupCalled, false);
  assert.equal(response.headers["Cache-Control"], "no-store");
});
