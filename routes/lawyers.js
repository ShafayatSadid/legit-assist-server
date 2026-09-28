// routes/lawyers.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");

const router = express.Router();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

function toPublicLawyer(doc) {
    return {
        id: doc._id.toString(),
        userId: doc.userId,
        name: doc.name,
        bio: doc.bio,
        specialization: doc.specialization,
        fee: doc.fee,
        image: doc.image,
        isBusy: !!doc.isBusy,
        hireCount: doc.hireCount || 0,
        createdAt: doc.createdAt,
    };
}

function parseNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────
// GET /api/lawyers — search + filter + sort + pagination
// ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
    try {
        const db = getDb();
        const col = db.collection("lawyerProfiles");

        const {
            search,
            specialization,
            minFee,
            maxFee,
            availability,
            sort = "latest",
            page = "1",
            limit = "9",
        } = req.query;

        // ── base filter: শুধু published lawyer দেখাবে ──
        const filter = { published: true };

        // ── search: name অথবা specialization ──
        if (search && search.trim()) {
            const rx = { $regex: search.trim(), $options: "i" };
            filter.$or = [{ name: rx }, { specialization: rx }];
        }

        // ── specialization filter ──
        if (specialization) {
            filter.specialization = specialization;
        }

        // ── fee range ──
        const min = parseNumber(minFee);
        const max = parseNumber(maxFee);
        if (min !== null || max !== null) {
            filter.fee = {};
            if (min !== null) filter.fee.$gte = min;
            if (max !== null) filter.fee.$lte = max;
        }

        // ── availability ──
        if (availability === "available") filter.isBusy = false;
        if (availability === "busy") filter.isBusy = true;

        // ── sort map ──
        const sortMap = {
            latest: { createdAt: -1 },
            "fee-asc": { fee: 1 },
            "fee-desc": { fee: -1 },
            top: { hireCount: -1, createdAt: -1 },
        };
        const sortOption = sortMap[sort] || sortMap.latest;

        // ── pagination ──
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        let limitNum = parseInt(limit, 10) || 9;
        if (limitNum < 1) limitNum = 9;
        if (limitNum > 12) limitNum = 12; // max 12 per page
        const skip = (pageNum - 1) * limitNum;

        // ── execute ──
        const [docs, total] = await Promise.all([
            col
                .find(filter)
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            col.countDocuments(filter),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / limitNum));

        res.json({
            success: true,
            data: {
                lawyers: docs.map(toPublicLawyer),
                total,
                page: pageNum,
                limit: limitNum,
                totalPages,
                categories: CATEGORIES,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/lawyers/featured — latest 6
// ─────────────────────────────────────────────
router.get("/featured", async (req, res, next) => {
    try {
        const db = getDb();
        const docs = await db
            .collection("lawyerProfiles")
            .find({ published: true })
            .sort({ createdAt: -1 })
            .limit(6)
            .toArray();

        res.json({
            success: true,
            data: docs.map(toPublicLawyer),
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/lawyers/top — 3 most hired
// ─────────────────────────────────────────────
router.get("/top", async (req, res, next) => {
    try {
        const db = getDb();
        const docs = await db
            .collection("lawyerProfiles")
            .find({ published: true, hireCount: { $gt: 0 } })
            .sort({ hireCount: -1 })
            .limit(3)
            .toArray();

        res.json({
            success: true,
            data: docs.map(toPublicLawyer),
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/lawyers/categories — static list
// ─────────────────────────────────────────────
router.get("/categories", (req, res) => {
    res.json({ success: true, data: CATEGORIES });
});

// ─────────────────────────────────────────────
// GET /api/lawyers/:id — single details
// ─────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid lawyer id" });
        }

        const db = getDb();
        const doc = await db
            .collection("lawyerProfiles")
            .findOne({ _id: new ObjectId(id), published: true });

        if (!doc) {
            return res
                .status(404)
                .json({ success: false, error: "Lawyer not found" });
        }

        res.json({ success: true, data: toPublicLawyer(doc) });
    } catch (err) {
        next(err);
    }
});

module.exports = router;