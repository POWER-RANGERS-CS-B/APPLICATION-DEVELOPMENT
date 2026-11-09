const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const Module = require("node:module");
const path = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");

const dbPath = require.resolve("../config/db");
const db = {};
const dbModule = new Module(dbPath);
dbModule.filename = dbPath;
dbModule.loaded = true;
dbModule.exports = db;
require.cache[dbPath] = dbModule;

const orderModel = require("../models/orderModel");
const auditService = require("../services/auditService");
const { allowRoles } = require("../middleware/auth");

function mockClient(updateRows) {
  const statements = [];
  return {
    statements,
    client: {
      async query(sql, values = []) {
        statements.push({ sql, values });
        if (/UPDATE restaurant\.orders/.test(sql)) {
          return { rows: updateRows };
        }
        return { rows: [] };
      },
      release() {},
    },
  };
}

test("cashier completion records cashier identity and completion time for a processing late refund", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const completedRefund = {
    id: 21,
    order_code: "481",
    refund_amount: "100.00",
    refund_status: "completed",
    refund_processing_by_user_id: 14,
    refund_processing_started_at: new Date().toISOString(),
    refund_completed_by_user_id: 15,
    refund_completed_at: new Date().toISOString(),
  };
  const mock = mockClient([completedRefund]);
  db.connect = async () => mock.client;
  auditService.insert = async () => {};
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
  });

  const result = await orderModel.completeLateArrivalRefund(21, {
    id: 15,
    role: "cashier",
    email: "cashier@example.test",
  });

  assert.equal(result.refund_status, "completed");
  assert.equal(result.refund_completed_by_user_id, 15);
  const update = mock.statements.find(({ sql }) => /UPDATE restaurant\.orders/.test(sql));
  assert.equal(update.values[1], 15);
  assert.match(update.sql, /refund_status = 'processing'/);
  assert.match(update.sql, /arrived_at > arrival_deadline_at/);
  assert.ok(mock.statements.some(({ sql }) => sql === "COMMIT"));
});

test("refund processing is assigned atomically to the cashier starting it", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const processingRefund = {
    id: 21,
    order_code: "481",
    refund_amount: "100.00",
    refund_status: "processing",
    refund_processing_by_user_id: 15,
    refund_processing_started_at: new Date().toISOString(),
  };
  const mock = mockClient([processingRefund]);
  db.connect = async () => mock.client;
  auditService.insert = async () => {};
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
  });

  const result = await orderModel.startLateArrivalRefundProcessing(21, {
    id: 15,
    role: "cashier",
    email: "cashier@example.test",
  });
  const update = mock.statements.find(({ sql }) => /UPDATE restaurant\.orders/.test(sql));

  assert.equal(result.refund_status, "processing");
  assert.equal(result.refund_processing_by_user_id, 15);
  assert.match(update.sql, /refund_status = 'pending'/);
  assert.match(update.sql, /refund_processing_started_at = NOW\(\)/);
  assert.match(update.sql, /arrived_at > arrival_deadline_at/);
  assert.ok(mock.statements.some(({ sql }) => sql === "COMMIT"));
});

test("refund queue returns pending, processing, and completed late dine-in arrivals from PostgreSQL", async (t) => {
  const originalQuery = db.query;
  const rows = [{
    id: 21,
    order_code: "481",
    customer_name: "Customer Name",
    total_amount: "200.00",
    refund_amount: "100.00",
    refund_status: "pending",
    arrived_at: new Date().toISOString(),
    arrival_deadline_at: new Date(Date.now() - 60_000).toISOString(),
  }, {
    id: 23,
    order_code: "483",
    customer_name: "Processing Customer",
    total_amount: "400.00",
    refund_amount: "200.00",
    refund_status: "processing",
    processing_cashier_name: "Casey Cashier",
    refund_processing_started_at: new Date().toISOString(),
    arrived_at: new Date().toISOString(),
    arrival_deadline_at: new Date(Date.now() - 60_000).toISOString(),
  }, {
    id: 22,
    order_code: "482",
    customer_name: "Another Customer",
    total_amount: "300.00",
    refund_amount: "150.00",
    refund_status: "completed",
    cashier_name: "Casey Cashier",
    refund_completed_at: new Date().toISOString(),
    arrived_at: new Date().toISOString(),
    arrival_deadline_at: new Date(Date.now() - 60_000).toISOString(),
  }];
  let queryText = "";
  db.query = async (sql) => {
    queryText = sql;
    return { rows };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const refunds = await orderModel.findLateArrivalRefunds();

  assert.deepEqual(refunds, rows);
  assert.match(queryText, /o\.payment_status = 'paid'/);
  assert.match(queryText, /o\.arrived_at > o\.arrival_deadline_at/);
  assert.match(queryText, /o\.refund_status IN \('pending', 'processing', 'completed'\)/);
  assert.match(queryText, /o\.total_amount, o\.refund_amount/);
  assert.match(queryText, /o\.contact_number, u\.email AS customer_email/);
  assert.match(queryText, /refund_processing_started_at/);
  assert.match(queryText, /restaurant\.users u ON u\.id = o\.user_id/);
  assert.match(queryText, /cashier\.full_name AS cashier_name/);
  assert.deepEqual(refunds.map(({ refund_status }) => refund_status), ["pending", "processing", "completed"]);
});

test("admin refund history includes only actual late arrivals and completion audit details", async (t) => {
  const originalQuery = db.query;
  const rows = [{
    id: 21,
    order_code: "481",
    customer_name: "Customer Name",
    total_amount: "200.00",
    refund_amount: "100.00",
    refund_status: "completed",
    cashier_name: "Casey Cashier",
    refund_completed_at: new Date().toISOString(),
  }];
  let queryText = "";
  db.query = async (sql) => {
    queryText = sql;
    return { rows };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const refunds = await orderModel.findDineInRefunds();

  assert.deepEqual(refunds, rows);
  assert.match(queryText, /o\.arrived_at > o\.arrival_deadline_at/);
  assert.match(queryText, /refund_completed_by_user_id/);
  assert.match(queryText, /cashier\.full_name AS cashier_name/);
  assert.match(queryText, /o\.refund_completed_at/);
  assert.match(queryText, /'pending', 'processing', 'completed'/);
});

test("cashier workspace is inside Staff Workspace and separate from admin refund monitoring", () => {
  const htmlPath = path.join(__dirname, "..", "..", "frontend", "staff-kds.html");
  const adminHtmlPath = path.join(__dirname, "..", "..", "frontend", "admin-dashboard.html");
  const cssPath = path.join(__dirname, "..", "..", "frontend", "css", "design-system.css");
  const scriptPath = path.join(__dirname, "..", "..", "frontend", "js", "staff.js");
  const html = fs.readFileSync(htmlPath, "utf8");
  const adminHtml = fs.readFileSync(adminHtmlPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  const script = fs.readFileSync(scriptPath, "utf8");
  const nav = html.match(/<nav\b[^>]*id="staffNavigation"[^>]*>([\s\S]*?)<\/nav>/i)?.[1] || "";
  const cashierLink = nav.match(/<a\b[^>]*id="cashierRefundNavigation"[^>]*>([\s\S]*?)<\/a>/i)?.[0] || "";
  assert.match(cashierLink, /href="#late-arrival-refunds"/);
  assert.match(cashierLink, /data-lucide="banknote"/);
  assert.match(cashierLink, /Cashier \/ Refund Management/);
  assert.match(cashierLink, /\bhidden\b/);
  assert.match(css, /\.staff-nav-link\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.match(script, /getElementById\("cashierRefundNavigation"\)/);
  assert.match(script, /role === "cashier"/);
  assert.match(script, /const canAccessCashier = isCashier;/);
  assert.match(script, /canAccessCashier \? \["late-arrival-refunds"\]/);
  assert.match(script, /document\.querySelector\("\.staff-nav"\)\.addEventListener\("click"/);
  assert.match(script, /if \(activeSection === "late-arrival-refunds"\)\s*\{\s*void loadCashierRefunds\(\);/);
  const sectionTags = [...html.matchAll(/<\/?section\b[^>]*>/gi)];
  const openSections = [];
  let cashierParentSections;

  for (const [tag] of sectionTags) {
    if (/^<\/section/i.test(tag)) {
      openSections.pop();
      continue;
    }

    const id = tag.match(/\bid="([^"]+)"/i)?.[1] || null;
    if (id === "late-arrival-refunds") {
      cashierParentSections = [...openSections];
    }
    openSections.push(id);
  }

  assert.deepEqual(cashierParentSections, []);
  assert.match(html, /<section id="late-arrival-refunds"[^>]*>[\s\S]*?Late Arrival Refund Requests/);
  assert.match(html, /Pending Refunds/);
  assert.match(html, /Processing Refunds/);
  assert.match(html, /Completed Refunds/);
  assert.match(html, /Refund History/);
  assert.doesNotMatch(adminHtml, /Cashier \/ Refund Management/);
  assert.match(adminHtml, /id="dineInRefundRequests"/);
  assert.match(adminHtml, /<h2>Dine-in Refunds<\/h2>/);
});

test("cashier refund API allows cashier JWTs and denies ordinary staff and admins", async (t) => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindRefunds = orderModel.findLateArrivalRefunds;
  const secret = "cashier-route-test-secret";
  process.env.JWT_SECRET = secret;
  orderModel.findLateArrivalRefunds = async () => [{ id: 21, refund_status: "pending" }];
  const app = express();
  app.use("/api/staff", require("../routes/staffRoutes"));
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => {
    server.close(() => {
      orderModel.findLateArrivalRefunds = originalFindRefunds;
      if (originalSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalSecret;
      resolve();
    });
  }));
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/staff/refunds/late-arrivals`;

  const request = (role) => fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt.sign({ id: 7, role }, secret)}`,
      Connection: "close",
    },
  });
  const cashierResponse = await request("cashier");
  assert.equal(cashierResponse.status, 200);
  assert.deepEqual(await cashierResponse.json(), [{ id: 21, refund_status: "pending" }]);
  assert.equal((await request("staff")).status, 403);
  assert.equal((await request("admin")).status, 403);
});

test("a refund can only be completed once", async (t) => {
  const originalConnect = db.connect;
  const originalAuditInsert = auditService.insert;
  const mock = mockClient([]);
  db.connect = async () => mock.client;
  auditService.insert = async () => {};
  t.after(() => {
    db.connect = originalConnect;
    auditService.insert = originalAuditInsert;
  });

  await assert.rejects(
    orderModel.completeLateArrivalRefund(21, { id: 15, email: "cashier@example.test" }),
    { statusCode: 409, message: "This late-arrival refund is not currently processing." }
  );
  assert.ok(mock.statements.some(({ sql }) => sql === "ROLLBACK"));
});

test("only cashier role can pass the refund-operation authorization gate", () => {
  for (const role of ["staff", "admin", "customer"]) {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json() {},
    };
    let nextCalled = false;
    allowRoles("cashier")({ user: { id: 3, role } }, response, () => {
      nextCalled = true;
    });
    assert.equal(response.statusCode, 403);
    assert.equal(nextCalled, false);
  }

  let cashierAllowed = false;
  allowRoles("cashier")({ user: { id: 4, role: "cashier" } }, {}, () => {
    cashierAllowed = true;
  });
  assert.equal(cashierAllowed, true);
});
