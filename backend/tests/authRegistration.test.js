const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const express = require("express");
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

test("customer accounts cannot authenticate after customer login is removed", async (t) => {
  const originals = {
    findByEmail: authModel.findByEmail,
    record: auditService.record,
  };
  authModel.findByEmail = async () => ({
    id: 7,
    full_name: "Guest Account",
    email: "guest@dine-ari.com",
    role: "customer",
    password_hash: await bcrypt.hash("ValidPassphrase123", 4),
  });
  auditService.record = async () => true;
  t.after(() => {
    authModel.findByEmail = originals.findByEmail;
    auditService.record = originals.record;
  });

  const response = responseCapture();
  await authController.login({ body: { email: "guest@dine-ari.com", password: "ValidPassphrase123" } }, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { message: "Invalid email or password." });
  assert.equal(response.cookies.dineari_session, undefined);
});

test("public customer registration endpoint is removed", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require("../routes/authRoutes"));
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "guest@gmail.com", password: "anything" }),
  });
  assert.equal(response.status, 404);
});
