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
// GET /api/hires/status/:lawyerProfileId
// → logged-in user এর সাথে এই lawyer-এর বর্তমান অবস্থা
// ─────────────────────────────────────────────
router.get("/status/:lawyerProfileId", async (req, res, next) => {
    try {
        if (req.user.role !== "user") {
            return res.json({
                success: true,
                data: { hire: null, hasCommented: false, commentId: null },
            });
        }

        const { lawyerProfileId } = req.params;
        if (!ObjectId.isValid(lawyerProfileId)) {
            return res.status(400).json({ success: false, error: "Invalid lawyer id" });
        }

        const db = getDb();
        const lid = new ObjectId(lawyerProfileId);

        // সব hire এর মধ্যে latest একটাই দেখাব
        const hires = await db
            .collection("hires")
            .find({ userId: req.user.id, lawyerProfileId: lid })
            .sort({ createdAt: -1 })
            .toArray();

        // priority: paid > accepted > pending > rejected
        const priority = { paid: 4, accepted: 3, pending: 2, rejected: 1 };
        const hire = hires.sort(
            (a, b) => (priority[b.status] || 0) - (priority[a.status] || 0)
        )[0];

        const comment = await db.collection("comments").findOne({
            userId: req.user.id,
            lawyerProfileId: lid,
        });

        res.json({
            success: true,
            data: {
                hire: hire
                    ? {
                        id: hire._id.toString(),
                        status: hire.status,
                        fee: hire.fee,
                        createdAt: hire.createdAt,
                    }
                    : null,
                hasCommented: !!comment,
                commentId: comment ? comment._id.toString() : null,
            },
        });
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
// PATCH /api/hires/:id/pay — user pays accepted hire (dummy)
// (Stripe এলে এই route-এর ভিতরে session verify করে paid mark করব)
// ─────────────────────────────────────────────
router.patch("/:id/pay", async (req, res, next) => {
    try {
        if (req.user.role !== "user") {
            return res.status(403).json({ success: false, error: "Only clients can pay" });
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
        if (hire.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: "This hire does not belong to you" });
        }
        if (hire.status !== "accepted") {
            return res.status(400).json({
                success: false,
                error: `Cannot pay a ${hire.status} hire. Only accepted hires can be paid.`,
            });
        }

        const now = new Date();
        const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        // hire update
        await db.collection("hires").updateOne(
            { _id: hire._id },
            {
                $set: {
                    status: "paid",
                    paidAt: now,
                    updatedAt: now,
                    transactionId,
                },
            }
        );

        // transaction record
        await db.collection("transactions").insertOne({
            transactionId,
            hireId: hire._id,
            userId: hire.userId,
            userEmail: hire.userEmail,
            lawyerId: hire.lawyerId,
            lawyerProfileId: hire.lawyerProfileId,
            lawyerName: hire.lawyerName,
            amount: hire.fee,
            status: "succeeded",
            createdAt: now,
        });

        res.json({
            success: true,
            data: { status: "paid", transactionId, paidAt: now },
        });
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