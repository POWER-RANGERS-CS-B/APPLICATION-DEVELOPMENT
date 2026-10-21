const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ======================================
   SERVE FRONTEND FILES
====================================== */

app.use(
  express.static(
    path.join(__dirname, "../frontend")
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
    path.join(__dirname, "../frontend/index.html")
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
app.use("/api/reservations", require("./routes/reservationRoutes"));

/* ======================================
   START SERVER
====================================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});