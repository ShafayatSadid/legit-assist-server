// routes/user.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// helper — id দিয়ে user খোঁজা (native driver + better-auth compat)
async function findUserById(db, idStr) {
    if (ObjectId.isValid(idStr)) {
        const byId = await db
            .collection("user")
            .findOne({ _id: new ObjectId(idStr) });
        if (byId) return byId;
    }
    return db.collection("user").findOne({ id: idStr });
}

// ─────────────────────────────────────────────
// GET /api/user/me
// ─────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res, next) => {
    try {
        const db = getDb();
        const user = await findUserById(db, req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.json({
            success: true,
            data: {
                id: user.id || user._id.toString(),
                name: user.name,
                email: user.email,
                image: user.image,
                role: user.role,
                createdAt: user.createdAt,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PATCH /api/user/profile
// ─────────────────────────────────────────────
router.patch("/profile", requireAuth, async (req, res, next) => {
    try {
        const { name, image } = req.body;

        const updates = {};

        if (name !== undefined) {
            if (!name || !name.trim()) {
                return res.status(400).json({ success: false, error: "Name cannot be empty" });
            }
            if (name.trim().length < 2) {
                return res.status(400).json({ success: false, error: "Name must be at least 2 characters" });
            }
            updates.name = name.trim();
        }

        if (image !== undefined) {
            if (image && typeof image !== "string") {
                return res.status(400).json({ success: false, error: "Image must be a URL string" });
            }
            updates.image = image || null;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: "Nothing to update" });
        }

        updates.updatedAt = new Date();

        const db = getDb();

        // _id দিয়ে try করি, না হলে id
        let result = { matchedCount: 0 };
        if (ObjectId.isValid(req.user.id)) {
            result = await db
                .collection("user")
                .updateOne({ _id: new ObjectId(req.user.id) }, { $set: updates });
        }
        if (result.matchedCount === 0) {
            result = await db
                .collection("user")
                .updateOne({ id: req.user.id }, { $set: updates });
        }

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.json({ success: true, data: updates });
    } catch (err) {
        next(err);
    }
});

module.exports = router;