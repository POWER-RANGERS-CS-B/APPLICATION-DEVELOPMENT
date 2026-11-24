const test = require("node:test");
const assert = require("node:assert/strict");
const { sendControllerError } = require("../utils/controllerError");

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

test("controller errors preserve client validation messages but hide internal details", (t) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });

  const validationResponse = responseCapture();
  sendControllerError(
    validationResponse,
    Object.assign(new Error("Choose a valid reservation time."), { statusCode: 400 }),
    400
  );
  assert.equal(validationResponse.body.message, "Choose a valid reservation time.");

  const databaseResponse = responseCapture();
  sendControllerError(
    databaseResponse,
    Object.assign(new Error("password authentication failed for user"), {
      code: "28P01",
    }),
    400
  );
  assert.equal(databaseResponse.statusCode, 400);
  assert.deepEqual(databaseResponse.body, {
    message: "The request could not be completed.",
  });

  const internalResponse = responseCapture();
  sendControllerError(
    internalResponse,
    new Error("database details"),
    500
  );
  assert.deepEqual(internalResponse.body, {
    message: "The request could not be completed.",
  });
});
