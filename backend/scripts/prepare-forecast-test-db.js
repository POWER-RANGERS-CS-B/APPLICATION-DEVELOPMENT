require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");

const testDatabaseName = process.env.FORECAST_TEST_DB_NAME;
const configuredDatabaseName = process.env.DB_NAME;

if (
  typeof testDatabaseName !== "string" ||
  !/^dinequeue_db_[a-z0-9_]*_test$/.test(testDatabaseName)
) {
  throw new Error(
    "Set FORECAST_TEST_DB_NAME to a dedicated database name ending in _test."
  );
}
if (!configuredDatabaseName || testDatabaseName === configuredDatabaseName) {
  throw new Error(
    "The forecast test database must differ from the configured application database."
  );
}

const port = Number(process.env.DB_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("DB_PORT must be an integer between 1 and 65535.");
}

const connectionOptions = {
  host: process.env.DB_HOST,
  port,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
};

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function generatedReservations() {
  const records = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let daysAgo = 120; daysAgo >= 1; daysAgo -= 1) {
    const reservationDate = new Date(today);
    reservationDate.setUTCDate(reservationDate.getUTCDate() - daysAgo);
    const day = isoDate(reservationDate);
    const weekday = reservationDate.getUTCDay();
    const count = weekday === 5 ? 4 : weekday === 6 ? 5 : weekday === 0 ? 3 : 2;

    for (let slot = 0; slot < count; slot += 1) {
      let status = ["active", "completed", "confirmed"][
        (daysAgo + slot) % 3
      ];
      if (slot === 0 && daysAgo % 13 === 0) status = "cancelled";
      if (slot === 1 && daysAgo % 17 === 0) status = "rejected";
      const deleted = slot === 0 && daysAgo % 31 === 0;
      const hour = [12, 17, 18, 19, 20, 21][
        (daysAgo + slot + weekday) % 6
      ];
      const guests = 2 + ((daysAgo * 3 + slot) % 7);
      const createdDaysAgo = daysAgo + 1 + ((daysAgo + slot) % 7);

      records.push({
        code: `FORECAST_TEST_${day.replaceAll("-", "")}_${slot}`,
        date: day,
        time: `${String(hour).padStart(2, "0")}:30:00`,
        guests,
        status,
        deleted,
        createdDaysAgo,
      });
    }
  }

  const future = new Date(today);
  future.setUTCDate(future.getUTCDate() + 14);
  records.push({
    code: `FORECAST_TEST_FUTURE_${isoDate(future).replaceAll("-", "")}`,
    date: isoDate(future),
    time: "19:00:00",
    guests: 4,
    status: "active",
    deleted: false,
    createdDaysAgo: 1,
  });
  return records;
}

async function prepareDatabase() {
  const maintenanceClient = new Client({
    ...connectionOptions,
    database: "postgres",
  });
  let created = false;

  try {
    await maintenanceClient.connect();
    const existing = await maintenanceClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [testDatabaseName]
    );
    if (existing.rowCount === 0) {
      await maintenanceClient.query(
        `CREATE DATABASE "${testDatabaseName}"`
      );
      created = true;
    }
  } finally {
    await maintenanceClient.end();
  }

  const testClient = new Client({
    ...connectionOptions,
    database: testDatabaseName,
  });
  try {
    await testClient.connect();
    const tableCount = await testClient.query(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.tables
       WHERE table_schema = 'restaurant'`
    );
    if (tableCount.rows[0].count === 0) {
      const schemaPath = path.join(
        __dirname,
        "../../database/dinequeue_db.sql"
      );
      await testClient.query(await fs.readFile(schemaPath, "utf8"));
    } else {
      const reservationTable = await testClient.query(
        "SELECT to_regclass('restaurant.reservations') AS table_name"
      );
      if (!reservationTable.rows[0].table_name) {
        throw new Error(
          "The existing test database has a partial schema; no changes were made."
        );
      }
    }

    await testClient.query("BEGIN");
    try {
      for (const record of generatedReservations()) {
        await testClient.query(
          `INSERT INTO restaurant.reservations
             (num_guests, status, reservation_date, reservation_time,
              customer_name, contact_number, reservation_code, deleted_at,
              created_at)
           VALUES
             ($1, $2, $3::date, $4::time, $5, $6, $7,
              CASE WHEN $8 THEN CURRENT_TIMESTAMP ELSE NULL END,
              CURRENT_DATE::timestamp - $9::int * INTERVAL '1 day')
           ON CONFLICT (reservation_code) DO NOTHING`,
          [
            record.guests,
            record.status,
            record.date,
            record.time,
            "FORECAST TEST CUSTOMER",
            "+639990000001",
            record.code,
            record.deleted,
            record.createdDaysAgo,
          ]
        );
      }
      await testClient.query("COMMIT");
    } catch (error) {
      await testClient.query("ROLLBACK");
      throw error;
    }

    const summary = await testClient.query(
      `SELECT status, COUNT(*)::int AS count
       FROM restaurant.reservations
       WHERE reservation_code LIKE 'FORECAST_TEST_%'
       GROUP BY status
       ORDER BY status`
    );
    console.log(
      JSON.stringify({
        database: testDatabaseName,
        created,
        testReservations: summary.rows,
        productionDatabaseTouched: false,
      })
    );
  } finally {
    await testClient.end();
  }
}

prepareDatabase().catch((error) => {
  console.error(`Forecast test database preparation failed: ${error.message}`);
  process.exitCode = 1;
});
