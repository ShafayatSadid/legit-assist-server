// routes/admin.js
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");

const router = express.Router();

// ─────────────────────────────────────────────
// helper — id string → ObjectId safely
// ─────────────────────────────────────────────
function toObjectId(idStr) {
    return ObjectId.isValid(idStr) ? new ObjectId(idStr) : null;
}

// ─────────────────────────────────────────────
// GET /api/admin/users — সব user list
// ─────────────────────────────────────────────
router.get("/users", async (req, res, next) => {
    try {
        const db = getDb();
        const users = await db
            .collection("user")
            .find({}, {
                projection: {
                    _id: 1,
                    id: 1,
                    name: 1,
                    email: 1,
                    image: 1,
                    role: 1,
                    createdAt: 1,
                },
            })
            .sort({ createdAt: -1 })
            .toArray();

        const data = users.map((u) => ({
            id: u.id || u._id.toString(),
            name: u.name,
            email: u.email,
            image: u.image,
            role: u.role,
            createdAt: u.createdAt,
        }));

        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PATCH /api/admin/users/:id/role — role change
// ─────────────────────────────────────────────
router.patch("/users/:id/role", async (req, res, next) => {
    try {
        const { role } = req.body;
        const ALLOWED = ["user", "lawyer"];

        if (!ALLOWED.includes(role)) {
            return res.status(400).json({
                success: false,
                error: "Invalid role. Only 'user' or 'lawyer' allowed.",
            });
        }

        const { id } = req.params;
        const db = getDb();

        let result = { matchedCount: 0 };
        const oid = toObjectId(id);
        if (oid) {
            result = await db
                .collection("user")
                .updateOne(
                    { _id: oid },
                    { $set: { role, updatedAt: new Date() } }
                );
        }
        if (result.matchedCount === 0) {
            result = await db
                .collection("user")
                .updateOne(
                    { id },
                    { $set: { role, updatedAt: new Date() } }
                );
        }

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.json({ success: true, data: { role } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// DELETE /api/admin/users/:id — user + lawyer profile remove
// ─────────────────────────────────────────────
router.delete("/users/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const db = getDb();

        if (id === req.user.id) {
            return res
                .status(400)
                .json({ success: false, error: "You cannot delete yourself" });
        }

        const oid = toObjectId(id);
        let user = null;
        if (oid) user = await db.collection("user").findOne({ _id: oid });
        if (!user) user = await db.collection("user").findOne({ id });

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const userId = user.id || user._id.toString();

        await db.collection("user").deleteOne({ _id: user._id });
        await db.collection("lawyerProfiles").deleteMany({ userId });

        res.json({ success: true, data: { id: userId } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/admin/lawyers — সব lawyer listing
// ─────────────────────────────────────────────
router.get("/lawyers", async (req, res, next) => {
    try {
        const db = getDb();
        const docs = await db
            .collection("lawyerProfiles")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        const data = docs.map((d) => ({
            id: d._id.toString(),
            userId: d.userId,
            name: d.name,
            email: d.email,
            specialization: d.specialization,
            fee: d.fee,
            image: d.image,
            published: !!d.published,
            publishFeePaid: !!d.publishFeePaid,
            hireCount: d.hireCount || 0,
            createdAt: d.createdAt,
        }));

        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PATCH /api/admin/lawyers/:id/toggle-publish
// ─────────────────────────────────────────────
router.patch("/lawyers/:id/toggle-publish", async (req, res, next) => {
    try {
        const { id } = req.params;
        const oid = toObjectId(id);
        if (!oid) {
            return res.status(400).json({ success: false, error: "Invalid lawyer id" });
        }

        const db = getDb();
        const doc = await db.collection("lawyerProfiles").findOne({ _id: oid });
        if (!doc) {
            return res.status(404).json({ success: false, error: "Lawyer not found" });
        }

        const newPublished = !doc.published;
        await db.collection("lawyerProfiles").updateOne(
            { _id: oid },
            { $set: { published: newPublished, updatedAt: new Date() } }
        );

        res.json({ success: true, data: { published: newPublished } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// DELETE /api/admin/lawyers/:id — listing remove
// ─────────────────────────────────────────────
router.delete("/lawyers/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const oid = toObjectId(id);
        if (!oid) {
            return res.status(400).json({ success: false, error: "Invalid lawyer id" });
        }

        const db = getDb();
        const result = await db
            .collection("lawyerProfiles")
            .deleteOne({ _id: oid });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: "Lawyer not found" });
        }

        res.json({ success: true, data: { id } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/admin/transactions — সব transaction
// ─────────────────────────────────────────────
router.get("/transactions", async (req, res, next) => {
    try {
        const db = getDb();
        const docs = await db
            .collection("transactions")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        const data = docs.map((t) => ({
            id: t._id.toString(),
            type: t.type || "hire",              // ← পুরনো record fallback
            transactionId: t.transactionId,
            userEmail: t.userEmail,
            lawyerName: t.lawyerName,
            amount: t.amount,
            status: t.status,
            createdAt: t.createdAt,
        }));

        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/admin/analytics — total + revenue (hire + publish fee)
// ─────────────────────────────────────────────
router.get("/analytics", async (req, res, next) => {
    try {
        const db = getDb();

        const [totalUsers, totalLawyers, totalHires, revenueAgg] =
            await Promise.all([
                db.collection("user").countDocuments({ role: "user" }),
                db.collection("user").countDocuments({ role: "lawyer" }),
                db.collection("hires").countDocuments({}),
                db
                    .collection("transactions")
                    .aggregate([
                        { $match: { status: "succeeded" } },
                        { $group: { _id: null, total: { $sum: "$amount" } } },
                    ])
                    .toArray(),
            ]);

        const totalRevenue = revenueAgg[0]?.total || 0;

        res.json({
            success: true,
            data: { totalUsers, totalLawyers, totalHires, totalRevenue },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;