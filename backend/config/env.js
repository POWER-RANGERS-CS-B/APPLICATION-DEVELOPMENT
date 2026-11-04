const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function assertRequiredEnvironmentVariables(names, environment = process.env) {
  const missing = names.filter(
    (name) =>
      typeof environment[name] !== "string" || environment[name].trim().length === 0
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

module.exports = { assertRequiredEnvironmentVariables };
