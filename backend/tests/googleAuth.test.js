const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "google-auth-test-secret";
}

const authModel = require("../models/authModel");
const auditService = require("../services/auditService");
const authController = require("../controllers/authController");

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

function mockGoogleAuth(t, {
  payload,
  findByEmail,
  findCustomerByGoogleSub,
  createGoogleCustomer,
  updateGoogleCustomerProfile,
}) {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  const originalFindByEmail = authModel.findByEmail;
  const originalFindCustomerByGoogleSub = authModel.findCustomerByGoogleSub;
  const originalCreateGoogleCustomer = authModel.createGoogleCustomer;
  const originalUpdateGoogleCustomerProfile = authModel.updateGoogleCustomerProfile;
  const originalRecord = auditService.record;

  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  OAuth2Client.prototype.verifyIdToken = async ({ idToken, audience }) => {
    assert.equal(idToken, "verified-google-credential");
    assert.equal(audience, "test-google-client-id");
    return { getPayload: () => payload };
  };
  authModel.findByEmail = findByEmail || (async () => null);
  authModel.findCustomerByGoogleSub = findCustomerByGoogleSub || (async () => null);
  authModel.createGoogleCustomer = createGoogleCustomer || (async () => {
    throw new Error("Unexpected Google customer creation.");
  });
  authModel.updateGoogleCustomerProfile = updateGoogleCustomerProfile || (async () => {
    throw new Error("Unexpected Google customer profile update.");
  });
  auditService.record = async () => true;

  t.after(() => {
    OAuth2Client.prototype.verifyIdToken = originalVerify;
    authModel.findByEmail = originalFindByEmail;
    authModel.findCustomerByGoogleSub = originalFindCustomerByGoogleSub;
    authModel.createGoogleCustomer = originalCreateGoogleCustomer;
    authModel.updateGoogleCustomerProfile = originalUpdateGoogleCustomerProfile;
    auditService.record = originalRecord;
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  });
}

test("Google customer login verifies a verified email and returns a customer session", async (t) => {
  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "customer@gmail.com",
      email_verified: true,
      picture: "https://images.example.com/customer.jpg",
      name: "Verified Customer Name",
    },
    findCustomerByGoogleSub: async (googleSub) => {
      assert.equal(googleSub, "google-subject");
      return {
        id: 21,
        full_name: "Customer",
        email: "customer@gmail.com",
        contact_number: null,
        role: "customer",
        google_sub: googleSub,
      };
    },
    updateGoogleCustomerProfile: async ({ userId, googleSub, googleFullName, googlePictureUrl }) => {
      assert.equal(userId, 21);
      assert.equal(googleSub, "google-subject");
      assert.equal(googleFullName, "Verified Customer Name");
      assert.equal(googlePictureUrl, "https://images.example.com/customer.jpg");
      return {
        id: 21,
        full_name: "Customer",
        email: "customer@gmail.com",
        contact_number: null,
        role: "customer",
        google_sub: googleSub,
        google_full_name: googleFullName,
        google_picture_url: googlePictureUrl,
      };
    },
  });
  const response = responseCapture();

  await authController.googleAuth(
    { body: { credential: "verified-google-credential", intent: "login" } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.role, "customer");
  assert.equal(response.body.user.picture, "https://images.example.com/customer.jpg");
  assert.equal(jwt.verify(response.body.token, process.env.JWT_SECRET).id, 21);
});

test("Google customer signup creates an account without requiring a password or phone", async (t) => {
  let createdCustomer;
  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "new-customer@gmail.com",
      email_verified: true,
      name: "New Customer",
      picture: "https://images.example.com/new-customer.jpg",
    },
    createGoogleCustomer: async (customer) => {
      createdCustomer = customer;
      return {
        id: 22,
        full_name: customer.fullName,
        email: customer.email,
        contact_number: null,
        role: "customer",
        google_picture_url: customer.googlePictureUrl,
      };
    },
  });
  const response = responseCapture();

  await authController.googleAuth(
    { body: { credential: "verified-google-credential", intent: "signup" } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(createdCustomer.fullName, "New Customer");
  assert.equal(createdCustomer.googleSub, "google-subject");
  assert.equal(createdCustomer.googleFullName, "New Customer");
  assert.equal(createdCustomer.googlePictureUrl, "https://images.example.com/new-customer.jpg");
  assert.equal(createdCustomer.email, "new-customer@gmail.com");
  assert.equal(typeof createdCustomer.passwordHash, "string");
  assert.equal(createdCustomer.passwordHash.length > 0, true);
  assert.equal(response.body.user.contactNumber, null);
  assert.equal(response.body.user.picture, "https://images.example.com/new-customer.jpg");
});

test("Google authentication rejects unverified email addresses", async (t) => {
  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "unverified@gmail.com",
      email_verified: false,
    },
  });
  const response = responseCapture();

  await authController.googleAuth(
    { body: { credential: "verified-google-credential", intent: "login" } },
    response
  );

  assert.equal(response.statusCode, 401);
  assert.match(response.body.message, /verified email/);
});

test("Google signup does not silently log in an existing account", async (t) => {
  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "existing@gmail.com",
      email_verified: true,
    },
    findByEmail: async () => ({ id: 23, role: "customer" }),
  });
  const response = responseCapture();

  await authController.googleAuth(
    { body: { credential: "verified-google-credential", intent: "signup" } },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /already exists/);
});

test("Google login does not link an existing email account without an existing Google subject link", async (t) => {
  let emailLookupCalled = false;
  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "existing@gmail.com",
      email_verified: true,
    },
    findByEmail: async () => {
      emailLookupCalled = true;
      return { id: 24, role: "customer" };
    },
  });
  const response = responseCapture();

  await authController.googleAuth(
    { body: { credential: "verified-google-credential", intent: "login" } },
    response
  );

  assert.equal(response.statusCode, 401);
  assert.equal(emailLookupCalled, false);
  assert.match(response.body.message, /linked to this Google account/);
});

test("Google customer database failures are logged without exposing details to the customer", async (t) => {
  const originalConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  t.after(() => {
    console.error = originalConsoleError;
  });

  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "new-customer@gmail.com",
      email_verified: true,
      name: "New Customer",
    },
    createGoogleCustomer: async () => {
      const error = new Error('column "google_sub" of relation "users" does not exist');
      error.code = "42703";
      error.position = "104";
      error.routine = "checkInsertTargets";
      throw error;
    },
  });
  const response = responseCapture();

  await authController.googleAuth(
    { body: { credential: "verified-google-credential", intent: "signup" } },
    response
  );

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.message, "Google sign-in failed. Please try again.");
  assert.equal(logged.length, 1);
  assert.equal(logged[0][1].endpoint, "POST /auth/google");
  assert.equal(logged[0][1].operation, "insert_google_customer");
  assert.equal(logged[0][1].code, "42703");
  assert.equal(logged[0][1].position, "104");
  assert.equal(logged[0][1].routine, "checkInsertTargets");
});
