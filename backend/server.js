const express = require("express");
const cors = require("cors");
const path = require("path");
const { authenticate, allowRoles } = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ======================================
   SERVE FRONTEND FILES
====================================== */

app.use(
  express.static(
    path.join(__dirname, "../frontend"),
    { index: false }
  )
);

/* ======================================
   STATIC IMAGES
====================================== */

app.use(
  "/images",
  express.static(
    path.join(__dirname, "../frontend/images")
  )
);



app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/choice.html")
  );
});

/* ======================================
   API ROUTES
====================================== */

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/menu", require("./routes/menuRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/reservations", require("./routes/reservationRoutes"));
app.use("/api/history", require("./routes/historyRoutes"));
app.use("/api/chairs", require("./routes/chairRoutes"));
app.use("/api/tables", require("./routes/tableRoutes"));
app.use("/api/staff", require("./routes/staffRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

app.get(
  "/api/audit-logs",
  authenticate,
  allowRoles("admin"),
  (req, res) => res.json([])
);

/* ======================================
   START SERVER
====================================== */

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
  console.log(`Open Dine-Ari at http://localhost:${PORT}`);
});