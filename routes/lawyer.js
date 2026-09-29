// routes/lawyer.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const CATEGORIES = [
    "Criminal",
    "Corporate",
    "Family",
    "Property",
    "Immigration",
    "Tax",
    "Labor",
    "Intellectual Property",
];

function serialize(doc) {
    return {
        id: doc._id.toString(),
        userId: doc.userId,
        name: doc.name,
        bio: doc.bio,
        specialization: doc.specialization,
        fee: doc.fee,
        image: doc.image,
        published: !!doc.published,
        isBusy: !!doc.isBusy,
        hireCount: doc.hireCount || 0,
        publishFeePaid: !!doc.publishFeePaid,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

function validateProfileInput(body, { partial = false } = {}) {
    const errors = [];
    const out = {};

    if (body.name !== undefined || !partial) {
        if (!body.name || !body.name.trim()) errors.push("Name is required");
        else if (body.name.trim().length < 2) errors.push("Name must be at least 2 characters");
        else out.name = body.name.trim();
    }

    if (body.bio !== undefined || !partial) {
        if (!body.bio || !body.bio.trim()) errors.push("Bio is required");
        else if (body.bio.trim().length > 1000) errors.push("Bio must be under 1000 characters");
        else out.bio = body.bio.trim();
    }

    if (body.specialization !== undefined || !partial) {
        if (!body.specialization) errors.push("Specialization is required");
        else if (!CATEGORIES.includes(body.specialization)) errors.push("Invalid specialization");
        else out.specialization = body.specialization;
    }

    if (body.fee !== undefined || !partial) {
        const fee = Number(body.fee);
        if (!Number.isFinite(fee) || fee < 0) errors.push("Fee must be a valid number");
        else out.fee = fee;
    }

    if (body.image !== undefined) {
        if (body.image && typeof body.image !== "string") errors.push("Image must be a URL string");
        else out.image = body.image || null;
    }

    return { errors, out };
}

// ─────────────────────────────────────────────
// POST /api/lawyer/profile — create own listing
// ─────────────────────────────────────────────
router.post("/profile", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const db = getDb();

        const existing = await db.collection("lawyerProfiles").findOne({ userId: req.user.id });
        if (existing) {
            return res.status(400).json({ success: false, error: "Profile already exists" });
        }

        const { errors, out } = validateProfileInput(req.body);
        if (errors.length) {
            return res.status(400).json({ success: false, error: errors[0] });
        }

        const userDoc = await db.collection("user").findOne({ id: req.user.id });
        const now = new Date();

        const doc = {
            userId: req.user.id,
            email: req.user.email,
            name: out.name,
            bio: out.bio,
            specialization: out.specialization,
            fee: out.fee,
            image: out.image || userDoc?.image || null,
            published: false,
            isBusy: false,
            hireCount: 0,
            publishFeePaid: false,
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection("lawyerProfiles").insertOne(doc);
        res.json({ success: true, data: { ...doc, _id: result.insertedId.toString() } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/lawyer/profile — own profile
// ─────────────────────────────────────────────
router.get("/profile", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const db = getDb();
        const doc = await db.collection("lawyerProfiles").findOne({ userId: req.user.id });
        if (!doc) {
            return res.status(404).json({ success: false, error: "Profile not found" });
        }
        res.json({ success: true, data: serialize(doc) });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PATCH /api/lawyer/profile — update own profile
// ─────────────────────────────────────────────
router.patch("/profile", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const db = getDb();
        const doc = await db.collection("lawyerProfiles").findOne({ userId: req.user.id });
        if (!doc) {
            return res.status(404).json({ success: false, error: "Profile not found" });
        }

        const { errors, out } = validateProfileInput(req.body, { partial: true });
        if (errors.length) {
            return res.status(400).json({ success: false, error: errors[0] });
        }

        if (Object.keys(out).length === 0) {
            return res.status(400).json({ success: false, error: "Nothing to update" });
        }

        // isBusy optional bool
        if (req.body.isBusy !== undefined) {
            out.isBusy = !!req.body.isBusy;
        }

        out.updatedAt = new Date();

        await db.collection("lawyerProfiles").updateOne({ _id: doc._id }, { $set: out });

        res.json({ success: true, data: { ...serialize(doc), ...out } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// DELETE /api/lawyer/profile — delete own profile
// ─────────────────────────────────────────────
router.delete("/profile", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const db = getDb();
        const doc = await db.collection("lawyerProfiles").findOne({ userId: req.user.id });
        if (!doc) {
            return res.status(404).json({ success: false, error: "Profile not found" });
        }

        // active hire থাকলে delete block
        const activeHire = await db.collection("hires").findOne({
            lawyerId: req.user.id,
            status: { $in: ["pending", "accepted"] },
        });
        if (activeHire) {
            return res.status(400).json({
                success: false,
                error: "Cannot delete profile with active hires. Resolve them first.",
            });
        }

        await db.collection("lawyerProfiles").deleteOne({ _id: doc._id });
        res.json({ success: true, data: { _id: doc._id.toString() } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// POST /api/lawyer/profile/pay-fee — dummy publish fee
// (Stripe pore — আপাতত সরাসরি paid mark করবে)
// ─────────────────────────────────────────────
router.post("/profile/pay-fee", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const db = getDb();
        const doc = await db.collection("lawyerProfiles").findOne({ userId: req.user.id });
        if (!doc) {
            return res.status(404).json({ success: false, error: "Create your profile first" });
        }
        if (doc.publishFeePaid) {
            return res.status(400).json({ success: false, error: "Publish fee already paid" });
        }

        await db.collection("lawyerProfiles").updateOne(
            { _id: doc._id },
            { $set: { publishFeePaid: true, updatedAt: new Date() } }
        );

        res.json({ success: true, data: { publishFeePaid: true } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PATCH /api/lawyer/profile/toggle-publish
// ─────────────────────────────────────────────
router.patch("/profile/toggle-publish", requireAuth, requireRole("lawyer"), async (req, res, next) => {
    try {
        const db = getDb();
        const doc = await db.collection("lawyerProfiles").findOne({ userId: req.user.id });
        if (!doc) {
            return res.status(404).json({ success: false, error: "Profile not found" });
        }
        if (!doc.publishFeePaid) {
            return res.status(403).json({ success: false, error: "Pay the publish fee first" });
        }

        const newPublished = !doc.published;
        await db.collection("lawyerProfiles").updateOne(
            { _id: doc._id },
            { $set: { published: newPublished, updatedAt: new Date() } }
        );

        res.json({ success: true, data: { published: newPublished } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;