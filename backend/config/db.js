const { Pool } = require("pg");
const { assertRequiredEnvironmentVariables } = require("./env");

assertRequiredEnvironmentVariables([
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
]);

const databasePort = Number(process.env.DB_PORT);

if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) {
  throw new Error("DB_PORT must be an integer between 1 and 65535.");
}

const connectionTimeoutMillis = Number(
  process.env.DB_CONNECTION_TIMEOUT_MS || 5000
);

if (!Number.isInteger(connectionTimeoutMillis) || connectionTimeoutMillis < 1) {
  throw new Error("DB_CONNECTION_TIMEOUT_MS must be a positive integer.");
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: databasePort,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: "-c search_path=restaurant,public",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis,
  idleTimeoutMillis: 30000,
  max: 10,
});

module.exports = pool;