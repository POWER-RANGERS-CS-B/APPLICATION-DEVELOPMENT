const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArrivalQr, classifyArrival } = require("../utils/arrivalQr");

const orderToken = "a".repeat(64);
const reservationToken = `rsv-${"A".repeat(43)}`;

test("parses secure dine-in receipt URLs and reservation QR tokens", () => {
  assert.deepEqual(
    parseArrivalQr(`https://dine-ari.example/receipt.html?code=123&token=${orderToken}`),
    {
      transactionType: "dine_in",
      credentialType: "receipt",
      orderCode: "123",
      credential: orderToken,
    }
  );
  assert.deepEqual(
    parseArrivalQr(`DINEARI:RES:${reservationToken}`),
    {
      transactionType: "reservation",
      credentialType: "token",
      credential: reservationToken,
    }
  );
});

test("accepts existing cryptographically generated reservation-code QR receipts", () => {
  assert.deepEqual(parseArrivalQr(`RES-${"a".repeat(32)}`), {
    transactionType: "reservation",
    credentialType: "code",
    credential: `RES-${"A".repeat(32)}`,
  });
});

test("rejects malformed, oversized, and unrelated QR payloads", () => {
  assert.equal(parseArrivalQr(""), null);
  assert.equal(parseArrivalQr("https://example.test/receipt.html?code=123&token=guess"), null);
  assert.equal(parseArrivalQr("javascript:alert(1)"), null);
  assert.equal(parseArrivalQr("x".repeat(2049)), null);
  assert.equal(parseArrivalQr(`RES-${"g".repeat(32)}`), null);
});

test("classifies payment, expiry, cancellation, and duplicate arrival from server data", () => {
  const now = new Date("2026-11-09T10:00:00Z");
  assert.equal(classifyArrival("dine_in", null, now).status, "not_found");
  const paidDineIn = {
    type: "dine_in",
    status: "preparing",
    payment_status: "paid",
    payment_verified_at: "2026-11-09T09:45:00Z",
    dine_in_status: "awaiting_arrival",
    arrival_deadline_at: "2026-11-09T10:15:00Z",
  };
  assert.equal(classifyArrival("dine_in", paidDineIn, now).status, "valid");
  assert.equal(
    classifyArrival("dine_in", { ...paidDineIn, payment_status: "pending_verification" }, now).status,
    "pending_payment"
  );
  assert.equal(
    classifyArrival("dine_in", { ...paidDineIn, arrival_deadline_at: "2026-11-09T09:59:00Z" }, now).status,
    "valid"
  );
  assert.equal(
    classifyArrival("dine_in", { ...paidDineIn, arrival_deadline_at: "2026-11-09T09:59:00Z" }, now).is_late,
    true
  );
  assert.equal(
    classifyArrival("dine_in", {
      ...paidDineIn,
      arrival_deadline_at: "2026-11-09T10:01:00Z",
      arrival_is_late: true,
    }, now).is_late,
    true
  );
  assert.equal(
    classifyArrival("dine_in", {
      ...paidDineIn,
      arrival_deadline_at: "2026-11-09T09:59:00Z",
      arrival_is_late: false,
    }, now).is_late,
    false
  );
  assert.equal(
    classifyArrival("dine_in", { ...paidDineIn, arrived_at: "2026-11-09T09:59:00Z" }, now).status,
    "already_checked_in"
  );
  assert.equal(
    classifyArrival("dine_in", { ...paidDineIn, status: "cancelled" }, now).status,
    "cancelled"
  );
});

test("classifies eligible and expired reservations using server-authoritative state", () => {
  const reservation = { status: "confirmed", payment_status: "paid", verified_at: "2026-11-09T09:00:00Z" };
  assert.equal(classifyArrival("reservation", reservation).status, "valid");
  assert.equal(
    classifyArrival("reservation", { ...reservation, reservation_expired: true }).status,
    "valid"
  );
  assert.equal(
    classifyArrival("reservation", { ...reservation, reservation_expired: true }).is_late,
    true
  );
  assert.equal(
    classifyArrival("reservation", { ...reservation, status: "active", arrived_at: null }).status,
    "already_checked_in"
  );
  assert.equal(
    classifyArrival("reservation", { ...reservation, payment_status: "pending_verification" }).status,
    "pending_payment"
  );
});

test("classifies a previously confirmed QR as used", () => {
  const result = classifyArrival("dine_in", {
    status: "preparing",
    payment_status: "paid",
    arrival_qr_revoked_at: "2026-11-09T10:01:00Z",
  });
  assert.equal(result.status, "already_used");
  assert.equal(result.message, "QR Code Already Used");
});
