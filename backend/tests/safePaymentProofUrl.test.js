const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePaymentProofUrl } = require("../utils/safePaymentProofUrl");

test("payment proof links accept secure absolute URLs and same-site paths", () => {
  assert.equal(
    normalizePaymentProofUrl("https://payments.example.test/proof?id=123"),
    "https://payments.example.test/proof?id=123"
  );
  assert.equal(normalizePaymentProofUrl("/images/payment-proof.png"), "/images/payment-proof.png");
  assert.equal(normalizePaymentProofUrl("  "), null);
});

test("payment proof links reject executable, insecure, credentialed, and oversized URLs", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://payments.example.test/proof",
    "//payments.example.test/proof",
    "https://user:password@payments.example.test/proof",
    "x".repeat(2049),
  ]) {
    assert.throws(
      () => normalizePaymentProofUrl(value),
      (error) => error.statusCode === 400
    );
  }
});
