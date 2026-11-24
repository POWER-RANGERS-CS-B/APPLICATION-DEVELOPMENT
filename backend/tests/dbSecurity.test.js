const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const backendDirectory = path.resolve(__dirname, "..");
const configurationProbe = `
  const assert = require("node:assert/strict");
  require("dotenv").config = () => ({});
  const pgPath = require.resolve("pg");
  require.cache[pgPath] = {
    id: pgPath,
    filename: pgPath,
    loaded: true,
    exports: {
      Pool: class Pool {
        constructor(options) {
          global.poolOptions = options;
        }
      },
    },
  };
  process.env.DB_HOST = "db.example.test";
  process.env.DB_PORT = "5432";
  process.env.DB_NAME = "security_test";
  process.env.DB_USER = "security_test";
  process.env.DB_PASSWORD = "not-a-real-password";
  process.env.NODE_ENV = "production";
  if (process.env.DB_SSL_PROBE === "enabled") {
    process.env.DB_SSL = "true";
    require("./config/db");
    assert.equal(global.poolOptions.ssl.rejectUnauthorized, true);
  } else {
    delete process.env.DB_SSL;
    assert.throws(() => require("./config/db"), /DB_SSL=true is required in production/);
  }
`;

function runConfigurationProbe(mode) {
  const result = spawnSync(process.execPath, ["-e", configurationProbe], {
    cwd: backendDirectory,
    encoding: "utf8",
    env: { ...process.env, DB_SSL_PROBE: mode },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("production database configuration requires SSL", () => {
  runConfigurationProbe("disabled");
});

test("production database TLS configuration validates server certificates", () => {
  runConfigurationProbe("enabled");
});
