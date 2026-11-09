const ORDER_TOKEN_PATTERN = /^[a-f\d]{64}$/i;
const RESERVATION_TOKEN_PATTERN = /^rsv-[a-z\d_-]{43}$/i;
const RESERVATION_CODE_PATTERN = /^RES-[a-f\d]{32}$/i;

function parseArrivalQr(value) {
  if (typeof value !== "string") return null;
  const payload = value.trim();
  if (!payload || payload.length > 2048) return null;

  const reservationToken = payload.match(/^DINEARI:RES:(rsv-[a-z\d_-]{43})$/i);
  if (reservationToken && RESERVATION_TOKEN_PATTERN.test(reservationToken[1])) {
    return {
      transactionType: "reservation",
      credentialType: "token",
      credential: reservationToken[1],
    };
  }

  if (RESERVATION_CODE_PATTERN.test(payload)) {
    return {
      transactionType: "reservation",
      credentialType: "code",
      credential: payload.toUpperCase(),
    };
  }

  let url;
  try {
    url = new URL(payload);
  } catch {
    return null;
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.pathname.endsWith("/receipt.html")
  ) {
    return null;
  }

  const orderCode = url.searchParams.get("code");
  const token = url.searchParams.get("token");
  if (
    !/^\d{3}$/.test(orderCode || "") ||
    !ORDER_TOKEN_PATTERN.test(token || "")
  ) {
    return null;
  }

  return {
    transactionType: "dine_in",
    credentialType: "receipt",
    orderCode,
    credential: token.toLowerCase(),
  };
}

function classifyArrival(transactionType, row, now = new Date()) {
  if (!row) {
    return { status: "not_found", message: "No transaction matches this QR code." };
  }
  if (row.arrival_qr_revoked_at) {
    return { status: "already_used", message: "QR Code Already Used" };
  }

  const status = String(row.status || "").toLowerCase();
  const paymentStatus = String(row.payment_status || "").toLowerCase();

  if (row.arrived_at || (transactionType === "dine_in" && row.dine_in_status === "arrived") ||
      (transactionType === "reservation" && status === "active")) {
    return { status: "already_checked_in", message: "This customer has already been checked in." };
  }

  if (["cancelled", "canceled", "rejected"].includes(status) || paymentStatus === "rejected") {
    return { status: "cancelled", message: "This transaction has been cancelled." };
  }

  if (transactionType === "dine_in") {
    if (paymentStatus !== "paid" || !row.payment_verified_at) {
      return { status: "pending_payment", message: "This dine-in payment is awaiting verification." };
    }
    const deadline = row.arrival_deadline_at ? new Date(row.arrival_deadline_at) : null;
    if (!deadline || Number.isNaN(deadline.getTime())) {
      return { status: "cancelled", message: "This dine-in order has no active arrival window." };
    }
    if (row.type !== "dine_in" || !["awaiting_arrival", "expired"].includes(row.dine_in_status)) {
      return { status: "cancelled", message: "This dine-in order is not awaiting arrival." };
    }
    return {
      status: "valid",
      is_late: typeof row.arrival_is_late === "boolean"
        ? row.arrival_is_late
        : deadline < now,
      message: "Payment verified. Confirm the customer's arrival to check them in.",
    };
  }

  if (paymentStatus !== "paid" || !row.verified_at) {
    return { status: "pending_payment", message: "This reservation is awaiting payment verification." };
  }
  if (!["confirmed", "verified"].includes(status)) {
    return { status: "cancelled", message: "This reservation is not active for check-in." };
  }
  return {
    status: "valid",
    is_late: Boolean(row.reservation_expired),
    message: "Reservation verified. Confirm the customer's arrival to check them in.",
  };
}

module.exports = {
  parseArrivalQr,
  classifyArrival,
  ORDER_TOKEN_PATTERN,
  RESERVATION_TOKEN_PATTERN,
  RESERVATION_CODE_PATTERN,
};
