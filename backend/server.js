const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const path = require("path");
const orderModel = require("./models/orderModel");

const app = express();

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let parsedOrigin;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        throw new Error("CORS_ORIGINS must contain valid absolute origins.");
      }
      if (
        parsedOrigin.origin !== origin ||
        (process.env.NODE_ENV === "production" && parsedOrigin.protocol !== "https:")
      ) {
        throw new Error("CORS_ORIGINS entries must be exact origins and use HTTPS in production.");
      }
      return parsedOrigin.origin;
    })
);

if (process.env.TRUST_PROXY_HOPS !== undefined) {
  const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > 10) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 10.");
  }
  app.set("trust proxy", trustedProxyHops);
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  maxAge: 600,
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const staticImageOptions = {
  setHeaders(res, filePath) {
    if (/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
    }
  },
};

/* ======================================
   SERVE FRONTEND FILES
====================================== */

app.use(
  express.static(
    path.join(__dirname, "../frontend"),
    { index: false, ...staticImageOptions }
  )
);

app.use(
  "/vendor/intl-tel-input",
  express.static(
    path.join(__dirname, "node_modules/intl-tel-input/dist")
  )
);

app.use(
  "/vendor/lucide",
  express.static(
    path.join(__dirname, "node_modules/lucide/dist/umd"),
    { maxAge: "1d" }
  )
);

app.use(
  "/vendor/zxing",
  express.static(
    path.join(__dirname, "node_modules/@zxing/browser/umd"),
    { maxAge: "1d" }
  )
);

app.use(
  "/vendor/chart.js",
  express.static(
    path.join(__dirname, "node_modules/chart.js/dist"),
    { maxAge: "1d" }
  )
);

/* ======================================
   STATIC IMAGES
====================================== */

app.use(
  "/images",
  express.static(
    path.join(__dirname, "../frontend/images"),
    staticImageOptions
  )
);



app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/welcome.html")
  );
});

/* ======================================
   API ROUTES
====================================== */

app.use("/api", apiRateLimit);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/menu", require("./routes/menuRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/reservations", require("./routes/reservationRoutes"));
app.use("/api/forecasts", require("./routes/forecastRoutes"));
app.use("/api/history", require("./routes/historyRoutes"));
app.use("/api/chairs", require("./routes/chairRoutes"));
app.use("/api/tables", require("./routes/tableRoutes"));
app.use("/api/staff", require("./routes/staffRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/audit-logs", require("./routes/auditRoutes"));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = error.status ||
    error.statusCode ||
    (error.code === "LIMIT_FILE_SIZE" ? 413 : undefined);
  const clientError = Number.isInteger(status) && status >= 400 && status < 500;
  console.error("Request processing failed.", {
    method: req.method,
    errorType: error.name || "Error",
    errorCode: error.code,
  });
  res.status(clientError ? status : 500).json({
    message: clientError ? error.message : "The request could not be completed.",
  });
});

/* ======================================
   START SERVER
====================================== */

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on ${HOST}:${PORT}`);
    console.log(`Open Dine-Ari at http://localhost:${PORT}`);
  });

  const expireUnarrivedDineIns = () => {
    void orderModel.expireUnarrivedDineIns().catch((error) => {
      console.error("Could not expire unarrived dine-in orders:", error);
    });
  };
  expireUnarrivedDineIns();
  setInterval(expireUnarrivedDineIns, 15000).unref();
}

module.exports = app;