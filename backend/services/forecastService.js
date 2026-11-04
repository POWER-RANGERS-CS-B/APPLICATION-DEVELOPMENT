const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const reservationModel = require("../models/reservationModel");
const { resolvePythonExecutable } = require("../utils/pythonExecutable");

const modelPath = path.join(__dirname, "../forecasting/forecast_model.py");
const forecastingDirectory = path.dirname(modelPath);
const developmentDataPath = path.join(
  __dirname,
  "../forecasting/development_reservations.csv"
);
const forecastTimeoutMs = 120000;
const staleAfterHours = 24;
let latestForecast = null;
let latestSourceFingerprint = null;
let inFlightForecast = null;
let inFlightSource = null;

function fingerprintReservations(reservations) {
  const stableData = reservations.map((reservation) => [
    reservation.id,
    reservation.reservation_date,
    reservation.reservation_time,
    reservation.num_guests,
    reservation.updated_at,
  ]);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableData))
    .digest("hex");
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function developmentDataEnabled() {
  return process.env.ENABLE_FORECAST_DEVELOPMENT_DATA === "true";
}

async function loadDevelopmentReservations() {
  const content = await fs.readFile(developmentDataPath, "utf8");
  const [, ...rows] = content.trim().split(/\r?\n/);

  return rows.map((row) => {
    const [reservation_date, reservation_time, num_guests] = row.split(",");
    return { reservation_date, reservation_time, num_guests: Number(num_guests) };
  });
}

function runModel(payload) {
  return new Promise((resolve, reject) => {
    const executable = resolvePythonExecutable();
    const child = spawn(executable, [modelPath], {
      cwd: forecastingDirectory,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        reject(new Error("Forecast model timed out before it could finish."));
      }
    }, forecastTimeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(
          new Error(
            `Unable to start the Python forecasting model. Configure PYTHON_EXECUTABLE and install backend/forecasting/requirements.txt. ${error.message}`
          )
        );
      }
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;

      if (code !== 0) {
        reject(
          new Error(
            `Forecast model exited with code ${code}: ${
              stderr.trim() || "No details returned."
            }`
          )
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Forecast model returned invalid JSON: ${error.message}`));
      }
    });

    child.stdin.on("error", (error) => {
      if (!settled) {
        child.kill();
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Unable to send reservation history to model: ${error.message}`));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

exports.developmentDataEnabled = developmentDataEnabled;

exports.getLatest = async () => {
  if (!latestForecast) return null;

  const generatedAt = Date.parse(latestForecast.generatedAt);
  const ageExpired =
    !Number.isFinite(generatedAt) ||
    Date.now() - generatedAt >= staleAfterHours * 60 * 60 * 1000;
  let historyChanged = false;

  if (latestForecast.dataSource === "actual") {
    const currentHistory = await reservationModel.findForecastHistory(
      localDateString()
    );
    historyChanged =
      fingerprintReservations(currentHistory) !== latestSourceFingerprint;
  }

  const stale = ageExpired || historyChanged;
  return {
    ...latestForecast,
    freshness: {
      stale,
      staleAfterHours,
      reason: historyChanged
        ? "reservation_history_changed"
        : ageExpired
          ? "age_limit"
          : "current",
    },
  };
};

async function generateForecast(source) {
  const asOf = localDateString();
  const reservations =
    source === "development"
      ? await loadDevelopmentReservations()
      : await reservationModel.findForecastHistory(asOf);
  const forecast = await runModel({
    as_of: asOf,
    data_source: source,
    reservations,
  });

  forecast.freshness = {
    stale: false,
    staleAfterHours,
    reason: "current",
  };
  latestForecast = forecast;
  latestSourceFingerprint =
    source === "actual" ? fingerprintReservations(reservations) : null;
  return forecast;
}

exports.generate = async (source = "actual") => {
  if (!["actual", "development"].includes(source)) {
    const error = new Error("Source must be either 'actual' or 'development'.");
    error.status = 400;
    throw error;
  }

  if (source === "development" && !developmentDataEnabled()) {
    const error = new Error("Development forecasting data is disabled.");
    error.status = 403;
    throw error;
  }

  if (inFlightForecast) {
    if (inFlightSource !== source) {
      const error = new Error(
        "A forecast using a different data source is already being generated."
      );
      error.status = 409;
      throw error;
    }
    return inFlightForecast;
  }

  inFlightSource = source;
  inFlightForecast = generateForecast(source);
  try {
    return await inFlightForecast;
  } finally {
    inFlightForecast = null;
    inFlightSource = null;
  }
};
