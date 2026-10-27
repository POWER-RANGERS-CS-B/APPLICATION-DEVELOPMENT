const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const testJwtSecret = "security-test-secret";
const previousJwtSecret = process.env.JWT_SECRET;
const dbModulePath = require.resolve("../config/db");
const mockDb = {
  query: async () => {
    throw new Error("Unexpected database query");
  },
};
const mockDbModule = new Module(dbModulePath, module);
mockDbModule.filename = dbModulePath;
mockDbModule.loaded = true;
mockDbModule.exports = mockDb;

const previousDbModule = require.cache[dbModulePath];
require.cache[dbModulePath] = mockDbModule;
const authModel = require("../models/authModel");
if (previousDbModule) {
  require.cache[dbModulePath] = previousDbModule;
} else {
  delete require.cache[dbModulePath];
}

const { allowRoles, authenticate } = require("../middleware/auth");

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function runMiddleware(middleware, req) {
  const res = createResponse();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

function createToken(payload, options) {
  return jwt.sign(payload, testJwtSecret, options);
}

test.beforeEach(() => {
  process.env.JWT_SECRET = testJwtSecret;
});

test.after(() => {
  if (previousJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousJwtSecret;
  }
});

test("authentication rejects requests without an authorization header", () => {
  const { res, nextCalled } = runMiddleware(authenticate, { headers: {} });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: "No token provided." });
  assert.equal(nextCalled, false);
});

test("authentication accepts only a single Bearer token", () => {
  const token = createToken({ id: 1, role: "customer" });

  for (const authorization of [
    `Basic ${token}`,
    "Bearer",
    "Bearer ",
    `Bearer ${token} extra`,
  ]) {
    const { res, nextCalled } = runMiddleware(authenticate, {
      headers: { authorization },
    });

    assert.equal(res.statusCode, 401, authorization);
    assert.equal(nextCalled, false, authorization);
  }
});

test("authentication rejects invalid and expired tokens", () => {
  for (const token of [
    "not-a-jwt",
    createToken({ id: 1, role: "customer" }, { expiresIn: -1 }),
  ]) {
    const { res, nextCalled } = runMiddleware(authenticate, {
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { message: "Invalid or expired token." });
    assert.equal(nextCalled, false);
  }
});

test("authentication verifies valid tokens and attaches the user claims", () => {
  const claims = { id: 42, email: "customer@example.com", role: "customer" };
  const req = {
    headers: { authorization: `Bearer ${createToken(claims)}` },
  };
  const { res, nextCalled } = runMiddleware(authenticate, req);

  assert.equal(res.statusCode, 200);
  assert.equal(req.user.id, claims.id);
  assert.equal(req.user.email, claims.email);
  assert.equal(req.user.role, claims.role);
  assert.equal(typeof req.user.iat, "number");
  assert.equal(nextCalled, true);
});

test("role authorization allows listed roles and rejects others", () => {
  const allowed = runMiddleware(allowRoles("admin", "staff"), {
    user: { role: "staff" },
  });
  const denied = runMiddleware(allowRoles("admin"), {
    user: { role: "customer" },
  });

  assert.equal(allowed.nextCalled, true);
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.statusCode, 403);
  assert.deepEqual(denied.res.body, { message: "Access denied." });
});

test("public registration always creates a customer, even when a role is submitted", async (t) => {
  const originalQuery = mockDb.query;
  let capturedQuery;
  let capturedValues;
  mockDb.query = async (query, values) => {
    capturedQuery = query;
    capturedValues = values;
    return {
      rows: [{ id: 7, full_name: "New User", email: "new@example.com", role: "customer" }],
    };
  };
  t.after(() => {
    mockDb.query = originalQuery;
  });

  const user = await authModel.createUser({
    fullName: "New User",
    email: "new@example.com",
    password: "a-strong-test-password",
    role: "admin",
  });

  assert.match(capturedQuery, /VALUES \(\$1, \$2, \$3, 'customer'\)/);
  assert.equal(capturedValues.length, 3);
  assert.equal(capturedValues[0], "New User");
  assert.equal(capturedValues[1], "new@example.com");
  assert.equal(await bcrypt.compare("a-strong-test-password", capturedValues[2]), true);
  assert.deepEqual(user, {
    id: 7,
    full_name: "New User",
    email: "new@example.com",
    role: "customer",
  });
  assert.equal(Object.hasOwn(user, "password_hash"), false);
});
