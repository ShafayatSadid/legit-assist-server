// routes/contact.js
const express = require("express");
const { getDb } = require("../lib/db");

const router = express.Router();

// POST /api/contact
router.post("/", async (req, res, next) => {
    try {
        const { name, email, message } = req.body;

        // Server-side validation
        if (!name || !name.trim() || name.trim().length < 2) {
            return res.status(400).json({ success: false, error: "Valid name is required" });
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, error: "Valid email is required" });
        }
        if (!message || message.trim().length < 10) {
            return res.status(400).json({ success: false, error: "Message must be at least 10 characters" });
        }

        const db = getDb();
        await db.collection("contactMessages").insertOne({
            name: name.trim(),
            email: email.trim(),
            message: message.trim(),
            createdAt: new Date(),
        });

        res.json({ success: true, message: "Message sent successfully" });
    } catch (err) {
        next(err);
    }
});

module.exports = router;