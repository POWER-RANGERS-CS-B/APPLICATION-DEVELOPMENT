const test = require("node:test");
const assert = require("node:assert/strict");
const userModel = require("../models/userModel");
const userController = require("../controllers/userController");
const { allowRoles } = require("../middleware/auth");

function responseCapture() {
  return {
    statusCode: 200,
    body: null,
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

function request(body, extras = {}) {
  return { body, params: {}, query: {}, user: { id: 7, email: "admin@dinequeue.com" }, ...extras };
}

test("staff creation validates and normalizes required account data", async () => {
  const originalCreate = userModel.createStaff;
  let created;
  userModel.createStaff = async (details, actor) => {
    created = { details, actor };
    return { id: 17, full_name: details.fullName, username: details.username, email: details.email, role: "staff" };
  };

  try {
    const response = responseCapture();
    await userController.createStaff(
      request({
        fullName: "  Alex Santos  ",
        username: "Alex.Santos",
        email: "Alex.Santos@dinequeue.com",
        password: "A secure test passphrase 77",
        confirmPassword: "A secure test passphrase 77",
        role: "staff",
      }),
      response
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(created.details, {
      fullName: "Alex Santos",
      username: "alex.santos",
      email: "alex.santos@dinequeue.com",
      password: "A secure test passphrase 77",
    });
    assert.equal(created.actor.id, 7);
    assert.equal(response.body.role, "staff");
    assert.equal("password_hash" in response.body, false);
  } finally {
    userModel.createStaff = originalCreate;
  }
});

test("staff creation rejects missing fields, weak passwords, mismatches, and admin role requests", async () => {
  const originalCreate = userModel.createStaff;
  userModel.createStaff = async () => {
    throw new Error("Invalid request reached persistence.");
  };

  try {
    const invalidBodies = [
      {},
      {
        fullName: "Alex Santos",
        username: "alex.santos",
        email: "alex.santos@dinequeue.com",
        password: "short",
        confirmPassword: "short",
        role: "staff",
      },
      {
        fullName: "Alex Santos",
        username: "alex.santos",
        email: "alex.santos@dinequeue.com",
        password: "A secure test passphrase 77",
        confirmPassword: "A different passphrase 77",
        role: "staff",
      },
      {
        fullName: "Alex Santos",
        username: "alex.santos",
        email: "alex.santos@dinequeue.com",
        password: "A secure test passphrase 77",
        confirmPassword: "A secure test passphrase 77",
        role: "admin",
      },
    ];

    for (const body of invalidBodies) {
      const response = responseCapture();
      await userController.createStaff(request(body), response);
      assert.equal(response.statusCode, 400);
    }
  } finally {
    userModel.createStaff = originalCreate;
  }
});

test("duplicate account identifiers are returned as conflicts", async () => {
  const originalCreate = userModel.createStaff;
  userModel.createStaff = async () => {
    const error = new Error("A user with this username already exists.");
    error.statusCode = 409;
    throw error;
  };

  try {
    const response = responseCapture();
    await userController.createStaff(
      request({
        fullName: "Alex Santos",
        username: "alex.santos",
        email: "alex.santos@dinequeue.com",
        password: "A secure test passphrase 77",
        confirmPassword: "A secure test passphrase 77",
        role: "staff",
      }),
      response
    );
    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /username already exists/i);
  } finally {
    userModel.createStaff = originalCreate;
  }
});

test("staff status changes reject self-targets and invalid states", async () => {
  const originalSetStatus = userModel.setStaffStatus;
  let calls = 0;
  userModel.setStaffStatus = async () => {
    calls += 1;
    return null;
  };

  try {
    const selfResponse = responseCapture();
    await userController.setStaffStatus(
      request({ status: "inactive" }, { params: { id: "7" } }),
      selfResponse
    );
    assert.equal(selfResponse.statusCode, 400);

    const invalidResponse = responseCapture();
    await userController.setStaffStatus(
      request({ status: "deleted" }, { params: { id: "8" } }),
      invalidResponse
    );
    assert.equal(invalidResponse.statusCode, 400);
    assert.equal(calls, 0);
  } finally {
    userModel.setStaffStatus = originalSetStatus;
  }
});

test("role middleware denies staff access to admin-only account management", () => {
  const response = responseCapture();
  let nextCalled = false;
  allowRoles("admin")(
    { user: { id: 15, role: "staff" } },
    response,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});
