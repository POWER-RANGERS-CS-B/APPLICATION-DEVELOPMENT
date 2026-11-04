const assert = require("node:assert/strict");
const os = require("node:os");
const test = require("node:test");
const { buildReceiptUrl, getPublicBaseUrl } = require("../config/publicUrl");

test("production receipt links require a configured public HTTPS origin", () => {
  assert.throws(
    () => getPublicBaseUrl({ get: () => "localhost:3000" }, { NODE_ENV: "production" }),
    /Set PUBLIC_BASE_URL/
  );
  assert.throws(
    () => getPublicBaseUrl(
      { get: () => "localhost:3000" },
      { NODE_ENV: "production", PUBLIC_BASE_URL: "http://dine-ari.example" }
    ),
    /publicly reachable HTTPS/
  );
  assert.equal(
    getPublicBaseUrl(
      { get: () => "localhost:3000" },
      { NODE_ENV: "production", PUBLIC_BASE_URL: "https://dine-ari.example" }
    ),
    "https://dine-ari.example"
  );
});

test("receipt URLs target the public receipt page with the capability reference", () => {
  const code = "123";
  const token = "a".repeat(64);
  const receiptUrl = new URL(
    buildReceiptUrl("https://dine-ari.example/app", code, token)
  );

  assert.equal(receiptUrl.origin, "https://dine-ari.example");
  assert.equal(receiptUrl.pathname, "/receipt.html");
  assert.equal(receiptUrl.searchParams.get("code"), code);
  assert.equal(receiptUrl.searchParams.get("token"), token);
});

test("development ignores localhost base URLs in favor of a reachable request host", () => {
  const receiptBaseUrl = getPublicBaseUrl(
    {
      get: () => "dine-ari.local:3000",
      hostname: "dine-ari.local",
      protocol: "http",
    },
    {
      NODE_ENV: "development",
      PUBLIC_BASE_URL: "http://localhost:3000",
      BASE_URL: "http://localhost:3000",
    }
  );

  assert.equal(receiptBaseUrl, "http://dine-ari.local:3000");
});

test("development refuses to generate a localhost QR when no reachable host exists", () => {
  const originalNetworkInterfaces = os.networkInterfaces;
  os.networkInterfaces = () => ({});

  try {
    assert.throws(
      () => getPublicBaseUrl(
        {
          get: () => "localhost:3000",
          hostname: "localhost",
          protocol: "http",
        },
        { NODE_ENV: "development", PORT: "3000" }
      ),
      /No reachable receipt URL/
    );
  } finally {
    os.networkInterfaces = originalNetworkInterfaces;
  }
});
