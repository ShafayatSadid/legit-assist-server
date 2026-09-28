// routes/comments.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function serialize(doc) {
    return {
        ...doc,
        _id: doc._id.toString(),
        lawyerProfileId: doc.lawyerProfileId?.toString(),
        hireId: doc.hireId?.toString(),
    };
}

// ─────────────────────────────────────────────
// GET /api/comments/lawyer/:lawyerProfileId — public list of comments
// ─────────────────────────────────────────────
router.get("/lawyer/:lawyerProfileId", async (req, res, next) => {
    try {
        const { lawyerProfileId } = req.params;
        if (!ObjectId.isValid(lawyerProfileId)) {
            return res.status(400).json({ success: false, error: "Invalid lawyer id" });
        }

        const db = getDb();
        const docs = await db
            .collection("comments")
            .find({ lawyerProfileId: new ObjectId(lawyerProfileId) })
            .sort({ createdAt: -1 })
            .toArray();

        res.json({ success: true, data: docs.map(serialize) });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/comments/my — logged-in user's own comments
// ─────────────────────────────────────────────
router.get("/my", requireAuth, requireRole("user"), async (req, res, next) => {
    try {
        const db = getDb();
        const docs = await db
            .collection("comments")
            .find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .toArray();

        res.json({ success: true, data: docs.map(serialize) });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// POST /api/comments — create (challenge #1: hire check)
// ─────────────────────────────────────────────
router.post("/", requireAuth, requireRole("user"), async (req, res, next) => {
    try {
        const { lawyerProfileId, text } = req.body;

        if (!lawyerProfileId || !ObjectId.isValid(lawyerProfileId)) {
            return res.status(400).json({ success: false, error: "Valid lawyerProfileId required" });
        }
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, error: "Comment text is required" });
        }
        if (text.trim().length > 500) {
            return res.status(400).json({ success: false, error: "Comment must be under 500 characters" });
        }

        const db = getDb();

        const lawyer = await db.collection("lawyerProfiles").findOne({
            _id: new ObjectId(lawyerProfileId),
        });
        if (!lawyer) {
            return res.status(404).json({ success: false, error: "Lawyer not found" });
        }

        // ── challenge #1: hire record আছে কিনা ──
        const hire = await db.collection("hires").findOne({
            userId: req.user.id,
            lawyerProfileId: lawyer._id,
            status: { $in: ["accepted", "paid"] },
        });

        if (!hire) {
            return res.status(403).json({
                success: false,
                error: "You can only comment on lawyers you have hired",
            });
        }

        // ── already commented? (এক hire-এ এক comment) ──
        const existing = await db.collection("comments").findOne({
            userId: req.user.id,
            lawyerProfileId: lawyer._id,
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                error: "You have already commented on this lawyer",
            });
        }

        const userDoc = await db.collection("user").findOne({ id: req.user.id });
        const now = new Date();

        const doc = {
            userId: req.user.id,
            userEmail: req.user.email,
            userName: userDoc?.name || "Client",
            userImage: userDoc?.image || null,
            lawyerProfileId: lawyer._id,
            lawyerName: lawyer.name,
            hireId: hire._id,
            text: text.trim(),
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection("comments").insertOne(doc);

        res.json({
            success: true,
            data: {
                ...doc,
                _id: result.insertedId.toString(),
                lawyerProfileId: lawyer._id.toString(),
                hireId: hire._id.toString(),
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PATCH /api/comments/:id — edit own comment
// ─────────────────────────────────────────────
router.patch("/:id", requireAuth, requireRole("user"), async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid comment id" });
        }

        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, error: "Comment text is required" });
        }
        if (text.trim().length > 500) {
            return res.status(400).json({ success: false, error: "Comment must be under 500 characters" });
        }

        const db = getDb();
        const comment = await db.collection("comments").findOne({ _id: new ObjectId(id) });
        if (!comment) {
            return res.status(404).json({ success: false, error: "Comment not found" });
        }
        if (comment.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: "You can only edit your own comment" });
        }

        const now = new Date();
        await db.collection("comments").updateOne(
            { _id: comment._id },
            { $set: { text: text.trim(), updatedAt: now } }
        );

        res.json({ success: true, data: { _id: id, text: text.trim(), updatedAt: now } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// DELETE /api/comments/:id — delete own comment
// ─────────────────────────────────────────────
router.delete("/:id", requireAuth, requireRole("user"), async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: "Invalid comment id" });
        }

        const db = getDb();
        const comment = await db.collection("comments").findOne({ _id: new ObjectId(id) });
        if (!comment) {
            return res.status(404).json({ success: false, error: "Comment not found" });
        }
        if (comment.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: "You can only delete your own comment" });
        }

        await db.collection("comments").deleteOne({ _id: comment._id });

        res.json({ success: true, data: { _id: id } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;