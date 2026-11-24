const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../server");

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("API responses include security headers and do not expose backend environment files", async () => {
  await withServer(async (baseUrl) => {
    const configResponse = await fetch(`${baseUrl}/api/auth/google/client-id`);
    assert.equal(configResponse.headers.get("x-powered-by"), null);
    assert.equal(configResponse.headers.get("x-content-type-options"), "nosniff");

    const envResponse = await fetch(`${baseUrl}/backend/.env`);
    assert.notEqual(envResponse.status, 200);
  });
});

test("cross-origin requests are denied unless explicitly allowlisted", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/google/client-id`, {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });
});

test("authentication endpoints are rate limited", async () => {
  await withServer(async (baseUrl) => {
    const statuses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      statuses.push(response.status);
    }

    assert.equal(statuses.filter((status) => status === 429).length, 1);
    assert.equal(statuses[statuses.length - 1], 429);
  });
});
