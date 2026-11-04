const pool = require("./db");

const createConnectionError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const describeConnectionError = (error) => {
  const message = String(error.message || "").toLowerCase();

  if (message.includes("timeout") || message.includes("timed out")) {
    return "Connection timed out. Check DB_HOST, DB_PORT, firewall rules, and DB_CONNECTION_TIMEOUT_MS.";
  }

  switch (error.code) {
    case "28P01":
    case "28000":
      return "Authentication failed. Check DB_USER and DB_PASSWORD.";
    case "3D000":
      return "The configured database does not exist. Check DB_NAME.";
    case "3F000":
      return 'The "restaurant" schema does not exist in the configured database.';
    case "42P01":
      return 'The "users" table does not exist in the "restaurant" schema.';
    case "ETIMEDOUT":
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "EHOSTUNREACH":
    case "08001":
    case "08006":
    case "57P03":
      return "Could not connect to PostgreSQL. Check DB_HOST, DB_PORT, firewall rules, and that PostgreSQL is running.";
    default:
      return "Database connection test failed. Check the PostgreSQL server and database configuration.";
  }
};

async function testDatabaseConnection() {
  let client;
  let transactionStarted = false;
  let releaseError;

  try {
    client = await pool.connect();

    const connectedResult = await client.query("SELECT 1 AS connected");
    if (connectedResult.rows[0]?.connected !== 1) {
      throw new Error("The SELECT 1 connectivity check returned an unexpected result.");
    }

    const databaseResult = await client.query(
      "SELECT current_database() AS database, current_schema() AS schema"
    );
    const { database, schema } = databaseResult.rows[0];

    const schemaResult = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS exists",
      ["restaurant"]
    );
    if (!schemaResult.rows[0].exists) {
      throw createConnectionError(
        "3F000",
        'The "restaurant" schema does not exist in the configured database.'
      );
    }

    const tableResult = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2
       ) AS exists`,
      ["restaurant", "users"]
    );
    if (!tableResult.rows[0].exists) {
      throw createConnectionError(
        "42P01",
        'The "users" table does not exist in the "restaurant" schema.'
      );
    }

    await client.query(
      "CREATE TEMPORARY TABLE db_connection_test (id integer PRIMARY KEY, marker text NOT NULL)"
    );
    await client.query("BEGIN");
    transactionStarted = true;

    const inserted = await client.query(
      "INSERT INTO db_connection_test (id, marker) VALUES ($1, $2) RETURNING id",
      [1, "connection-test"]
    );

    if (inserted.rowCount !== 1) {
      throw new Error("The temporary transaction test row was not inserted.");
    }

    await client.query("ROLLBACK");
    transactionStarted = false;

    const rollbackResult = await client.query(
      "SELECT COUNT(*)::integer AS remaining FROM db_connection_test"
    );
    if (rollbackResult.rows[0].remaining !== 0) {
      throw new Error("The temporary test row remained after the rollback.");
    }

    return {
      database,
      schema,
      usersTableExists: true,
      transactionRolledBack: true,
    };
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        releaseError = rollbackError;
      }
    }

    if (error.code === "3F000" || error.code === "42P01") {
      throw error;
    }

    throw createConnectionError(error.code || "DB_TEST_FAILED", describeConnectionError(error));
  } finally {
    client?.release(releaseError);
  }
}

module.exports = {
  testDatabaseConnection,
  describeConnectionError,
};
