// routes/public.js
const express = require("express");
const { getDb } = require("../lib/db");

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/public/stats — Platform Statistics
// ─────────────────────────────────────────────
router.get("/stats", async (req, res, next) => {
    try {
        const db = getDb();

        const [totalClients, totalLawyers, totalHires] = await Promise.all([
            db.collection("user").countDocuments({ role: "user" }),
            db.collection("user").countDocuments({ role: "lawyer" }),
            db.collection("hires").countDocuments({ status: "paid" }), // Successful hires
        ]);

        res.json({
            success: true,
            data: { totalClients, totalLawyers, totalHires },
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/public/testimonials — Latest 3 reviews
// ─────────────────────────────────────────────
router.get("/testimonials", async (req, res, next) => {
    try {
        const db = getDb();

        const comments = await db
            .collection("comments")
            .find({})
            .sort({ createdAt: -1 })
            .limit(3)
            .toArray();

        const data = comments.map((c) => ({
            id: c._id.toString(),
            userName: c.userName,
            userImage: c.userImage,
            lawyerName: c.lawyerName,
            text: c.text,
            createdAt: c.createdAt,
        }));

        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

module.exports = router;