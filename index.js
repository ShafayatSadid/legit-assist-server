// index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDb } = require("./lib/db");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
    res.json({ success: true, data: "LegalEase API running" });
});

// ── Routes ──
const {
    verifyToken,
    verifyTokenOptional,
    requireRole,
} = require("./middleware/auth");

app.use("/api/lawyers", require("./routes/lawyers"));
app.use("/api/lawyer", verifyToken, require("./routes/lawyer"));
app.use("/api/hires", verifyToken, require("./routes/hires"));
app.use("/api/comments", verifyTokenOptional, require("./routes/comments"));
app.use("/api/user", verifyToken, require("./routes/user"));
app.use("/api/admin", verifyToken, requireRole("admin"), require("./routes/admin"));
app.use("/api/payments", verifyToken, require("./routes/payments"));

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, error: "Route not found" });
});

// Error handler — Express 5 auto-catches async errors
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
    });
});

connectDb()
    .then(() => {
        app.listen(port, () => {
            console.log(`LegalEase server running on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("Failed to connect DB:", err);
        process.exit(1);
    });