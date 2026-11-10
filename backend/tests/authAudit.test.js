const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const authModel = require("../models/authModel");
const auditService = require("../services/auditService");
const authController = require("../controllers/authController");

function responseCapture() {
  return {
    statusCode: 200,
    body: null,
    cookies: {},
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
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
}

test("successful login records an audit event without credentials", async () => {
  const originalFindByEmail = authModel.findByEmail;
  const originalCompare = bcrypt.compare;
  const originalRecord = auditService.record;
  const events = [];
  authModel.findByEmail = async () => ({
    id: 123456,
    email: "audit-test@gmail.com",
    full_name: "Audit Test",
    role: "admin",
    password_hash: "stored-hash-not-logged",
  });
  bcrypt.compare = async () => true;
  auditService.record = async (event) => {
    events.push(event);
    return true;
  };

  try {
    const response = responseCapture();
    await authController.login(
      { body: { email: "audit-test@gmail.com", password: "must-not-be-logged" } },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal("token" in response.body, false);
    assert.equal(typeof response.cookies.dineari_session.value, "string");
    assert.equal(response.cookies.dineari_session.options.httpOnly, true);
    assert.equal(response.cookies.dineari_session.options.sameSite, "strict");
    assert.equal("password_hash" in response.body.user, false);
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "LOGIN_SUCCESS");
    assert.equal(events[0].userId, 123456);
    assert.doesNotMatch(JSON.stringify(events), /must-not-be-logged|stored-hash-not-logged/);
  } finally {
    authModel.findByEmail = originalFindByEmail;
    bcrypt.compare = originalCompare;
    auditService.record = originalRecord;
  }
});

test("failed login records only a failure reason and actor identifier", async () => {
  const originalFindByEmail = authModel.findByEmail;
  const originalRecord = auditService.record;
  const events = [];
  authModel.findByEmail = async () => null;
  auditService.record = async (event) => {
    events.push(event);
    return true;
  };

  try {
    const response = responseCapture();
    await authController.login(
      { body: { email: "missing-account@gmail.com", password: "must-not-be-logged" } },
      response
    );

    assert.equal(response.statusCode, 401);
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "LOGIN_FAILED");
    assert.deepEqual(events[0].details, { reason: "invalid_credentials" });
    assert.doesNotMatch(JSON.stringify(events), /must-not-be-logged/);
  } finally {
    authModel.findByEmail = originalFindByEmail;
    auditService.record = originalRecord;
  }
});
