// routes/hires.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");

const router = express.Router();

function serialize(doc) {
    return {
        ...doc,
        _id: doc._id.toString(),
        lawyerProfileId: doc.lawyerProfileId?.toString(),
    };
}

// ─────────────────────────────────────────────
// POST /api/hires — user creates hire request
// ─────────────────────────────────────────────
router.post("/", async (req, res, next) => {
    try {
        if (req.user.role !== "user") {
            return res.status(403).json({ success: false, error: "Only clients can send hire requests" });
        }

        const { lawyerProfileId } = req.body;
        if (!lawyerProfileId || !ObjectId.isValid(lawyerProfileId)) {
            return res.status(400).json({ success: false, error: "Valid lawyerProfileId required" });
        }

        const db = getDb();

        const lawyer = await db.collection("lawyerProfiles").findOne({
            _id: new ObjectId(lawyerProfileId),
            published: true,
        });
        if (!lawyer) {
            return res.status(404).json({ success: false, error: "Lawyer not found" });
        }

        if (lawyer.userId === req.user.id) {
            return res.status(400).json({ success: false, error: "You cannot hire yourself" });
        }

        // ── duplicate check: pending/accepted/paid already আছে কিনা ──
        const existing = await db.collection("hires").findOne({
            userId: req.user.id,
            lawyerProfileId: lawyer._id,
            status: { $in: ["pending", "accepted", "paid"] },
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                error:
                    existing.status === "pending"
                        ? "You already have a pending request to this lawyer"
                        : "You already hired this lawyer",
            });
        }

        // ── user এর name আনি (better-auth user collection) ──
        const userDoc = await db.collection("user").findOne({ id: req.user.id });

        const now = new Date();
        const doc = {
            userId: req.user.id,
            userEmail: req.user.email,
            userName: userDoc?.name || "Client",
            lawyerId: lawyer.userId,
            lawyerProfileId: lawyer._id,
            lawyerName: lawyer.name,
            lawyerSpecialization: lawyer.specialization,
            lawyerImage: lawyer.image,
            fee: lawyer.fee,
            status: "pending",
            createdAt: now,
            updatedAt: now,
            acceptedAt: null,
            paidAt: null,
            stripeSessionId: null,
        };

        const result = await db.collection("hires").insertOne(doc);

        res.json({
            success: true,
            data: { ...doc, _id: result.insertedId.toString(), lawyerProfileId: lawyer._id.toString() },
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/hires/my — user's own hiring history
// ─────────────────────────────────────────────
router.get("/my", async (req, res, next) => {
    try {
        if (req.user.role !== "user") {
            return res.status(403).json({ success: false, error: "Only clients can view their hiring history" });
        }

        const db = getDb();
        const docs = await db
            .collection("hires")
            .find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .toArray();

        res.json({ success: true, data: docs.map(serialize) });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/hires/lawyer — lawyer's incoming requests
// ─────────────────────────────────────────────
router.get("/lawyer", async (req, res, next) => {
    try {
        if (req.user.role !== "lawyer") {
            return res.status(403).json({ success: false, error: "Only lawyers can view incoming hires" });
        }

        const db = getDb();
        const docs = await db
            .collection("hires")
            .find({ lawyerId: req.user.id })
            .sort({ createdAt: -1 })
            .toArray();

        res.json({ success: true, data: docs.map(serialize) });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PATCH /api/hires/:id/accept
// ─────────────────────────────────────────────
router.patch("/:id/accept", async (req, res, next) => {
    try {
        if (req.user.role !== "lawyer") {
            return res.status(403).json({ success: false, error: "Only lawyers can accept hires" });
        }

        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid hire id" });
        }

        const db = getDb();
        const hire = await db.collection("hires").findOne({ _id: new ObjectId(id) });
        if (!hire) {
            return res.status(404).json({ success: false, error: "Hire not found" });
        }
        if (hire.lawyerId !== req.user.id) {
            return res.status(403).json({ success: false, error: "This hire does not belong to you" });
        }
        if (hire.status !== "pending") {
            return res.status(400).json({ success: false, error: `Cannot accept a ${hire.status} hire` });
        }

        const now = new Date();

        await db.collection("hires").updateOne(
            { _id: hire._id },
            { $set: { status: "accepted", acceptedAt: now, updatedAt: now } }
        );

        // hire count বাড়াই (Top Experts section-এর জন্য)
        await db.collection("lawyerProfiles").updateOne(
            { _id: hire.lawyerProfileId },
            { $inc: { hireCount: 1 }, $set: { updatedAt: now } }
        );

        res.json({ success: true, data: { status: "accepted" } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PATCH /api/hires/:id/reject
// ─────────────────────────────────────────────
router.patch("/:id/reject", async (req, res, next) => {
    try {
        if (req.user.role !== "lawyer") {
            return res.status(403).json({ success: false, error: "Only lawyers can reject hires" });
        }

        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid hire id" });
        }

        const db = getDb();
        const hire = await db.collection("hires").findOne({ _id: new ObjectId(id) });
        if (!hire) {
            return res.status(404).json({ success: false, error: "Hire not found" });
        }
        if (hire.lawyerId !== req.user.id) {
            return res.status(403).json({ success: false, error: "This hire does not belong to you" });
        }
        if (hire.status !== "pending") {
            return res.status(400).json({ success: false, error: `Cannot reject a ${hire.status} hire` });
        }

        const now = new Date();
        await db.collection("hires").updateOne(
            { _id: hire._id },
            { $set: { status: "rejected", updatedAt: now } }
        );

        res.json({ success: true, data: { status: "rejected" } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;