const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");

function resolvePythonExecutable() {
  const configuredExecutable = process.env.PYTHON_EXECUTABLE?.trim();

  if (configuredExecutable) {
    if (
      path.isAbsolute(configuredExecutable) ||
      configuredExecutable.includes("/") ||
      configuredExecutable.includes("\\")
    ) {
      return path.resolve(projectRoot, configuredExecutable);
    }

    return configuredExecutable;
  }

  const virtualEnvironmentExecutable =
    process.platform === "win32"
      ? path.join(projectRoot, ".venv-win", "Scripts", "python.exe")
      : path.join(projectRoot, ".venv", "bin", "python");

  if (fs.existsSync(virtualEnvironmentExecutable)) {
    return virtualEnvironmentExecutable;
  }

  return "python";
}

module.exports = { resolvePythonExecutable };
