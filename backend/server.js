const express = require("express");
const cors = require("cors");
const path = require("path");
const orderModel = require("./models/orderModel");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
<<<<<<< HEAD
    { index: false }
=======
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
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  )
);


app.use(
  "/images",
  express.static(
    path.join(__dirname, "../frontend/images"),
    staticImageOptions
  )
);



app.get("/", (req, res) => {
  res.sendFile(
<<<<<<< HEAD
    path.join(__dirname, "../frontend/choice.html")
=======
    path.join(__dirname, "../frontend/welcome.html")
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
  );
});

/* ======================================
   API ROUTES
====================================== */

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
<<<<<<< HEAD

// --- ADD THESE ALIAS ROUTES TO PREVENT 404 ERRORS IN ADMIN DASHBOARD ---
app.get("/api/users", (req, res) => {
  // Routes staff data to /api/users if admin dashboard expects it
  req.url = "/";
  require("./routes/staffRoutes")(req, res);
});

app.get("/api/audit-logs", (req, res) => {
  res.json([]); // Returns empty audit log array safely until custom table is created
});
=======
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/audit-logs", require("./routes/auditRoutes"));
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50

/* ======================================
   START SERVER
====================================== */

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

<<<<<<< HEAD
app.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
  console.log(`Open Dine-Ari at http://localhost:${PORT}`);
});
=======
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
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
