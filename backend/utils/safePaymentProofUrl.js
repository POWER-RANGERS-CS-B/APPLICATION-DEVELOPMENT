function invalidPaymentProofUrl() {
  const error = new Error("Payment proof must be a secure HTTPS URL or a same-site path.");
  error.statusCode = 400;
  return error;
}

function normalizePaymentProofUrl(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw invalidPaymentProofUrl();

  const input = value.trim();
  if (!input) return null;
  if (input.length > 2048 || input.includes("\\") || input.startsWith("//")) {
    throw invalidPaymentProofUrl();
  }

  if (input.startsWith("/")) {
    try {
      const url = new URL(input, "https://dineari.invalid");
      if (url.origin !== "https://dineari.invalid") throw invalidPaymentProofUrl();
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (error) {
      if (error.statusCode) throw error;
      throw invalidPaymentProofUrl();
    }
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    throw invalidPaymentProofUrl();
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw invalidPaymentProofUrl();
  }

  return url.toString();
}

module.exports = { normalizePaymentProofUrl };
