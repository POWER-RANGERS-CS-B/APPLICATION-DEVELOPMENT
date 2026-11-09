const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../config/db");
const customerModel = require("../models/customerModel");

test("customer reservation details are scoped to the authenticated owner", async (t) => {
  const originalQuery = db.query;
  let capturedQuery;
  db.query = async (sql, values) => {
    capturedQuery = { sql, values };
    return {
      rows: [{
        reservation_code: "RES-OWNER-ONLY",
        status: "pending_verification",
        payment_status: "pending_verification",
        qr_code: null,
      }],
    };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const reservation = await customerModel.getReservation(19, 51);

  assert.deepEqual(capturedQuery.values, [51, 19]);
  assert.match(capturedQuery.sql, /r\.id = \$1 AND r\.user_id = \$2/);
  assert.match(capturedQuery.sql, /THEN r\.qr_code\s+ELSE NULL/);
  assert.equal(reservation.qr_code, null);
});

test("customer reservation details do not reveal another customer's reservation", async (t) => {
  const originalQuery = db.query;
  let capturedValues;
  db.query = async (_sql, values) => {
    capturedValues = values;
    return { rows: [] };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  await assert.rejects(
    customerModel.getReservation(20, 51),
    (error) => error.statusCode === 404
  );
  assert.deepEqual(capturedValues, [51, 20]);
});
