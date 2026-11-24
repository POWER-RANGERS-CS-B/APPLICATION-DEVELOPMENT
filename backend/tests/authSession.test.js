const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const authModel = require("../models/authModel");
const { authenticate } = require("../middleware/auth");

function createToken(claims = {}) {
  return jwt.sign(
    {
      id: 42,
      role: "customer",
      authVersion: 0,
      jti: "auth-session-test-token",
      ...claims,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );
}

async function requestWithToken(token) {
  const app = express();
  app.get("/protected", authenticate, (req, res) => res.json({ user: req.user }));
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/protected`,
      { headers }
    );
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("authentication checks account role, status, token version, and revocation", async (t) => {
  const originalQuery = db.query;
  let captured;
  db.query = async (sql, values) => {
    captured = { sql, values };
    return { rows: [{ is_valid: true }] };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  assert.equal(await authModel.isSessionValid(42, "customer", 3, "token-123"), true);
  assert.deepEqual(captured.values, [42, "customer", 3, "token-123"]);
  assert.match(captured.sql, /role = \$2/);
  assert.match(captured.sql, /auth_version = \$3/);
  assert.match(captured.sql, /deleted_at IS NULL/);
  assert.match(captured.sql, /NOT EXISTS/);
  assert.match(captured.sql, /revoked_auth_tokens/);
});

test("authentication rejects revoked or deactivated sessions and malformed modern tokens", async (t) => {
  const originalQuery = db.query;
  let queryCount = 0;
  db.query = async () => {
    queryCount += 1;
    return { rows: [{ is_valid: false }] };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  assert.equal((await requestWithToken(createToken())).status, 401);
  const legacyToken = jwt.sign(
    { id: 42, role: "customer", authVersion: 0 },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );
  assert.equal((await requestWithToken(legacyToken)).status, 401);
  assert.equal(queryCount, 1);
});

test("protected routes reject anonymous, revoked, and expired JWTs", async (t) => {
  const originalQuery = db.query;
  const queryValues = [];
  db.query = async (_sql, values) => {
    queryValues.push(values);
    return { rows: [{ is_valid: false }] };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  assert.equal((await requestWithToken(null)).status, 401);
  const expiredToken = jwt.sign(
    { id: 42, role: "customer", authVersion: 0 },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: -1,
      jwtid: "expired-auth-session-test-token",
    }
  );
  assert.equal((await requestWithToken(expiredToken)).status, 401);

  const revokedToken = createToken({ jti: "revoked-auth-session-test-token" });
  assert.equal((await requestWithToken(revokedToken)).status, 401);
  assert.equal(queryValues.length, 1);
  assert.equal(queryValues[0][3], "revoked-auth-session-test-token");
});

test("authentication fails closed if session state cannot be checked", async (t) => {
  const originalQuery = db.query;
  db.query = async () => {
    throw new Error("database details must not reach the client");
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const result = await requestWithToken(createToken());
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { message: "Authentication is temporarily unavailable." });
});
