const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { rateLimit } = require("express-rate-limit");
const path = require("path");
const orderModel = require("./models/orderModel");
const { authenticate } = require("./middleware/auth");

const app = express();
app.disable("x-powered-by");

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters in production.");
}
if (isProduction && process.env.COOKIE_SECURE !== "true") {
  throw new Error("Set COOKIE_SECURE=true when running in production over HTTPS.");
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  next();
});

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean)
);
for (const configuredUrl of [process.env.BASE_URL, process.env.PUBLIC_BASE_URL]) {
  if (!configuredUrl) continue;
  try {
    allowedOrigins.add(new URL(configuredUrl).origin);
  } catch {
    // Public URL validation is handled by the receipt URL configuration.
  }
}
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb", parameterLimit: 100 }));
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("sec-fetch-site") === "cross-site") {
    return res.status(403).json({ message: "Cross-site requests are not allowed." });
  }
  const origin = req.get("origin");
  if (!origin) return next();
  let requestOrigin = "";
  try {
    requestOrigin = `${req.protocol}://${req.get("host")}`;
  } catch {
    return res.status(403).json({ message: "Request origin is not allowed." });
  }
  if (origin !== requestOrigin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ message: "Request origin is not allowed." });
  }
  return next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

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

function requirePageRoles(...roles) {
  return (req, res, next) => {
    if (!req.cookies?.dineari_session) return res.redirect("/login.html");
    return authenticate(req, res, () => {
      if (!roles.includes(req.user.role)) return res.redirect("/choice.html");
      return next();
    });
  };
}

app.get("/admin-dashboard.html", requirePageRoles("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/admin-dashboard.html"));
});
app.get("/staff-kds.html", requirePageRoles("admin", "staff", "cashier"), (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/staff-kds.html"));
});
app.get("/customer-auth.html", (_req, res) => res.redirect(302, "/choice.html"));

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

app.use("/api/auth", require("./routes/authRoutes"));
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
  console.error("Unhandled request error:", error);
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  return res.status(status).json({
    message: status < 500 ? error.message : "The request could not be completed.",
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

  let expirationJobHadError = false;
  const expireUnarrivedDineIns = () => {
    void orderModel.expireUnarrivedDineIns().then(() => {
      expirationJobHadError = false;
    }).catch((error) => {
      if (!expirationJobHadError) {
        console.error("Could not expire unarrived dine-in orders:", error.code || error.name || "unknown_error");
        expirationJobHadError = true;
      }
    });
  };
  expireUnarrivedDineIns();
  setInterval(expireUnarrivedDineIns, 15000).unref();
}

module.exports = app;
