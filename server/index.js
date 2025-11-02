// Load .env and override any existing environment variables so local dev .env values
// (like DATABASE_URL) are used instead of a global shell value that may point to a
// different DB (e.g. Postgres). In production you may want to remove `override: true`.
require("dotenv").config({ override: true });
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const driveRoutes = require("./routes/driveRoutes");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("DriveMerge server is running 🚀");
});

app.use("/auth", authRoutes);
app.use("/drive", driveRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
