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
    headers: {},
    set(name, value) {
      this.headers[name] = value;
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

function googleAuthRequest(intent) {
  const headers = {
    origin: "http://localhost:3000",
    "x-requested-with": "XmlHttpRequest",
  };
  return {
    body: { accessToken: "verified-google-access-token", intent },
    get(name) {
      return name.toLowerCase() === "host" ? "localhost:3000" : headers[name.toLowerCase()];
    },
  };
}

function mockGoogleAuth(t, {
  payload,
  findByEmail,
  findCustomerByGoogleSub,
  createGoogleCustomer,
  updateGoogleCustomerProfile,
  tokenInfo,
  userinfoError,
}) {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGetTokenInfo = OAuth2Client.prototype.getTokenInfo;
  const originalRequest = OAuth2Client.prototype.request;
  const originalFindByEmail = authModel.findByEmail;
  const originalFindCustomerByGoogleSub = authModel.findCustomerByGoogleSub;
  const originalCreateGoogleCustomer = authModel.createGoogleCustomer;
  const originalUpdateGoogleCustomerProfile = authModel.updateGoogleCustomerProfile;
  const originalRecord = auditService.record;

  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  OAuth2Client.prototype.getTokenInfo = async (accessToken) => {
    assert.equal(accessToken, "verified-google-access-token");
    return tokenInfo || {
      aud: "test-google-client-id",
      scopes: ["openid", "email", "profile"],
      sub: payload.sub,
    };
  };
  OAuth2Client.prototype.request = async function ({ url, headers: requestHeaders }) {
    assert.equal(url, "https://openidconnect.googleapis.com/v1/userinfo");
    assert.equal(this.credentials.access_token, "verified-google-access-token");
    assert.equal(requestHeaders.Authorization, "Bearer verified-google-access-token");
    if (userinfoError) throw userinfoError;
    return { data: payload };
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
    OAuth2Client.prototype.getTokenInfo = originalGetTokenInfo;
    OAuth2Client.prototype.request = originalRequest;
    authModel.findByEmail = originalFindByEmail;
    authModel.findCustomerByGoogleSub = originalFindCustomerByGoogleSub;
    authModel.createGoogleCustomer = originalCreateGoogleCustomer;
    authModel.updateGoogleCustomerProfile = originalUpdateGoogleCustomerProfile;
    auditService.record = originalRecord;
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  });
}

test("Google client configuration is enabled with only the web client ID", (t) => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  delete process.env.GOOGLE_CLIENT_SECRET;
  t.after(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
  });

  const response = responseCapture();
  authController.googleClientConfig({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.clientId, "test-google-client-id");
  assert.equal(response.body.enabled, true);
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("Google customer login verifies a Google access token and returns a customer session", async (t) => {
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
    googleAuthRequest("login"),
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
    googleAuthRequest("signup"),
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
    googleAuthRequest("login"),
    response
  );

  assert.equal(response.statusCode, 401);
  assert.match(response.body.message, /verified email/);
});

test("Google authentication rejects access tokens issued to another client", async (t) => {
  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "customer@gmail.com",
      email_verified: true,
    },
    tokenInfo: {
      aud: "different-google-client-id",
      sub: "google-subject",
    },
  });
  const response = responseCapture();

  await authController.googleAuth(googleAuthRequest("login"), response);

  assert.equal(response.statusCode, 401);
  assert.match(response.body.message, /could not verify/);
});

test("Google token verification failures log a safe diagnostic without the access token", async (t) => {
  const originalConsoleError = console.error;
  const diagnostics = [];
  console.error = (...args) => diagnostics.push(args);
  t.after(() => {
    console.error = originalConsoleError;
  });

  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "customer@gmail.com",
      email_verified: true,
    },
    userinfoError: new Error("Google profile lookup failed for Bearer verified-google-access-token"),
  });
  const response = responseCapture();

  await authController.googleAuth(googleAuthRequest("login"), response);

  assert.equal(response.statusCode, 401);
  const diagnostic = JSON.stringify(diagnostics);
  assert.ok(diagnostic.includes("POST /auth/google"));
  assert.match(diagnostic, /userinfo_request/);
  assert.match(diagnostic, /Google profile lookup failed/);
  assert.doesNotMatch(diagnostic, /verified-google-access-token/);
});

test("Google authentication rejects a profile that does not match the access-token subject", async (t) => {
  mockGoogleAuth(t, {
    payload: {
      sub: "different-google-subject",
      email: "customer@gmail.com",
      email_verified: true,
    },
    tokenInfo: {
      aud: "test-google-client-id",
      sub: "google-subject",
    },
  });
  const response = responseCapture();

  await authController.googleAuth(googleAuthRequest("login"), response);

  assert.equal(response.statusCode, 401);
  assert.match(response.body.message, /could not verify/);
});

test("Google access token requires the request header and same origin", async (t) => {
  mockGoogleAuth(t, {
    payload: {
      sub: "google-subject",
      email: "customer@gmail.com",
      email_verified: true,
    },
  });

  const missingHeader = responseCapture();
  await authController.googleAuth(
    {
      body: { accessToken: "verified-google-access-token", intent: "login" },
      get(name) {
        return name.toLowerCase() === "host" ? "localhost:3000" : "http://localhost:3000";
      },
    },
    missingHeader
  );
  assert.equal(missingHeader.statusCode, 400);
  assert.match(missingHeader.body.message, /request could not be verified/);

  const foreignOrigin = responseCapture();
  await authController.googleAuth(
    {
      ...googleAuthRequest("login"),
      get(name) {
        return name.toLowerCase() === "host"
          ? "localhost:3000"
          : name.toLowerCase() === "origin"
            ? "https://attacker.example"
            : "XmlHttpRequest";
      },
    },
    foreignOrigin
  );
  assert.equal(foreignOrigin.statusCode, 400);
  assert.match(foreignOrigin.body.message, /origin could not be verified/);
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
    googleAuthRequest("signup"),
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
    googleAuthRequest("login"),
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
    googleAuthRequest("signup"),
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
