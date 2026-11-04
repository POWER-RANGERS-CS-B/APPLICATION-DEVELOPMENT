require("dotenv").config();

const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const configuredDatabaseName = process.env.DB_NAME;
const testDatabaseName = process.env.FORECAST_TEST_DB_NAME;

if (
  typeof testDatabaseName !== "string" ||
  !/^dinequeue_db_[a-z0-9_]*_test$/.test(testDatabaseName) ||
  testDatabaseName === configuredDatabaseName
) {
  throw new Error(
    "Set FORECAST_TEST_DB_NAME to a dedicated _test database different from DB_NAME."
  );
}

process.env.DB_NAME = testDatabaseName;
const db = require("../config/db");
const reservationModel = require("../models/reservationModel");
const forecastService = require("../services/forecastService");

after(async () => {
  await db.end();
});

test("forecast integration reads only eligible rows from the isolated database", async () => {
  const identity = await db.query(
    "SELECT current_database() AS database_name, CURRENT_DATE::text AS today"
  );
  assert.equal(identity.rows[0].database_name, testDatabaseName);

  const eligible = await reservationModel.findForecastHistory(
    identity.rows[0].today
  );
  assert.ok(eligible.length >= 30, "run npm run prepare:forecast-test-db first");
  assert.equal(new Set(eligible.map((row) => row.id)).size, eligible.length);
  assert.ok(eligible.every((row) => row.updated_at));
  assert.ok(
    eligible.every((row) => row.reservation_date < identity.rows[0].today)
  );

  const excluded = await db.query(
    `SELECT id
     FROM restaurant.reservations
     WHERE reservation_code LIKE 'FORECAST_TEST_%'
       AND (
         deleted_at IS NOT NULL
         OR reservation_date >= $1::date
         OR LOWER(COALESCE(status::text, '')) NOT IN
            ('active', 'completed', 'confirmed')
       )`,
    [identity.rows[0].today]
  );
  const eligibleIds = new Set(eligible.map((row) => row.id));
  assert.ok(excluded.rowCount > 0, "test fixture must include excluded rows");
  assert.ok(excluded.rows.every((row) => !eligibleIds.has(row.id)));
});

test("the model trains and returns seven-day forecasts from test PostgreSQL history", async () => {
  const forecast = await forecastService.generate("actual");

  assert.equal(forecast.status, "ready");
  assert.equal(forecast.dataSource, "actual");
  assert.equal(forecast.weeklyDemand.length, 7);
  assert.equal(forecast.dataReadiness.reservationCount > 0, true);
  assert.equal(forecast.evaluation.method, "rolling_origin");
  assert.ok(forecast.evaluation.originCount >= 3);
  assert.deepEqual(
    Object.keys(forecast.evaluation.metrics).sort(),
    ["guests", "hourly", "reservations"]
  );
});
