const test = require("node:test");
const assert = require("node:assert/strict");
const authModel = require("../models/authModel");
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

test("customer signup normalizes Philippine local numbers to E.164", async () => {
  const originalCreateCustomer = authModel.createCustomer;
  const savedContacts = [];
  authModel.createCustomer = async ({ fullName, email, contactNumber }) => {
    savedContacts.push(contactNumber);
    return {
      id: 123,
      full_name: fullName,
      email,
      contact_number: contactNumber,
      role: "customer",
    };
  };

  try {
    const response = responseCapture();
    await authController.registerCustomer(
      {
        body: {
          full_name: "Test Customer",
          email: "customer-signup-test@gmail.com",
          contact_number: "0917 123 4567",
          password: "correct-horse-battery",
          confirm_password: "correct-horse-battery",
        },
      },
      response
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(savedContacts, ["+639171234567"]);
    assert.equal(response.body.user.contactNumber, "+639171234567");
  } finally {
    authModel.createCustomer = originalCreateCustomer;
  }
});

test("customer signup preserves valid international numbers", async () => {
  const originalCreateCustomer = authModel.createCustomer;
  const savedContacts = [];
  authModel.createCustomer = async ({ fullName, email, contactNumber }) => {
    savedContacts.push(contactNumber);
    return {
      id: 124,
      full_name: fullName,
      email,
      contact_number: contactNumber,
      role: "customer",
    };
  };

  try {
    const response = responseCapture();
    await authController.registerCustomer(
      {
        body: {
          full_name: "Test Customer",
          email: "customer-international-test@gmail.com",
          contact_number: "+1 415 555 2671",
          password: "correct-horse-battery",
          confirm_password: "correct-horse-battery",
        },
      },
      response
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(savedContacts, ["+14155552671"]);
  } finally {
    authModel.createCustomer = originalCreateCustomer;
  }
});

test("customer signup rejects invalid phone numbers before persistence", async () => {
  const originalCreateCustomer = authModel.createCustomer;
  let createCustomerCalled = false;
  authModel.createCustomer = async () => {
    createCustomerCalled = true;
    throw new Error("Invalid phone number reached persistence.");
  };

  try {
    const response = responseCapture();
    await authController.registerCustomer(
      {
        body: {
          full_name: "Test Customer",
          email: "customer-invalid-phone-test@gmail.com",
          contact_number: "12345",
          password: "correct-horse-battery",
          confirm_password: "correct-horse-battery",
        },
      },
      response
    );

    assert.equal(response.statusCode, 400);
    assert.equal(createCustomerCalled, false);
    assert.match(response.body.message, /Enter a valid phone number/);
  } finally {
    authModel.createCustomer = originalCreateCustomer;
  }
});
