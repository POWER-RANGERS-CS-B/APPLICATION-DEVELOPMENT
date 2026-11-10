const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidEmailDomain } = require("../utils/emailValidation");

test("the Dine-ari account domain is accepted by default", () => {
  const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS;
  const blockedDomains = process.env.BLOCKED_EMAIL_DOMAINS;
  delete process.env.ALLOWED_EMAIL_DOMAINS;
  delete process.env.BLOCKED_EMAIL_DOMAINS;

  try {
    assert.equal(isValidEmailDomain("admin@dine-ari.com"), true);
    assert.equal(isValidEmailDomain("staff@dine-ari.com"), true);
  } finally {
    if (allowedDomains === undefined) delete process.env.ALLOWED_EMAIL_DOMAINS;
    else process.env.ALLOWED_EMAIL_DOMAINS = allowedDomains;

    if (blockedDomains === undefined) delete process.env.BLOCKED_EMAIL_DOMAINS;
    else process.env.BLOCKED_EMAIL_DOMAINS = blockedDomains;
  }
});
