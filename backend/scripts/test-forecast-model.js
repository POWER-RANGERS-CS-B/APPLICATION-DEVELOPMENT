const path = require("path");
const { spawnSync } = require("child_process");
const { resolvePythonExecutable } = require("../utils/pythonExecutable");

require("dotenv").config();

const executable = resolvePythonExecutable();
const result = spawnSync(
  executable,
  ["-m", "unittest", "-v", "test_forecast_model.py"],
  {
    cwd: path.join(__dirname, "../forecasting"),
    encoding: "utf8",
    windowsHide: true,
  }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(`Unable to run forecasting tests: ${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
