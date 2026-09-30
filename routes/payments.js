// routes/payments.js
const express = require("express");
const { ObjectId } = require("mongodb");
const Stripe = require("stripe");
require("dotenv").config();
const { getDb } = require("../lib/db");

const router = express.Router();

if (!process.env.STRIPE_SECRET_KEY) {
    console.error("⚠️  STRIPE_SECRET_KEY missing in .env — payments will fail");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const PUBLISH_FEE_BDT = 500;

function toUsdCents(bdtAmount) {
    // fake rate: ৳100 = $1 → ৳500 = $5
    return Math.max(100, Math.round(bdtAmount));
}

function genTxnId() {
    return `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// ─────────────────────────────────────────────
// POST /api/payments/checkout — hire payment
// ─────────────────────────────────────────────
router.post("/checkout", async (req, res, next) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                error: "Stripe is not configured.",
            });
        }
        if (req.user.role !== "user") {
            return res.status(403).json({ success: false, error: "Only clients can pay" });
        }

        const { hireId } = req.body;
        if (!hireId || !ObjectId.isValid(hireId)) {
            return res.status(400).json({ success: false, error: "Valid hireId required" });
        }

        const db = getDb();
        const hire = await db.collection("hires").findOne({ _id: new ObjectId(hireId) });
        if (!hire) return res.status(404).json({ success: false, error: "Hire not found" });
        if (hire.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: "This hire does not belong to you" });
        }
        if (hire.status !== "accepted") {
            return res.status(400).json({
                success: false,
                error: `Cannot pay a ${hire.status} hire. Only accepted hires can be paid.`,
            });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: `Legal Consultation — ${hire.lawyerName}`,
                            description: `${hire.lawyerSpecialization} consultation fee`,
                        },
                        unit_amount: toUsdCents(hire.fee),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                type: "hire",
                hireId: hire._id.toString(),
                userId: req.user.id,
            },
            success_url: `${FRONTEND_URL}/dashboard/user/hiring-history?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/dashboard/user/hiring-history?cancelled=1`,
        });

        res.json({ success: true, data: { url: session.url, sessionId: session.id } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/payments/verify?session_id=... — hire verify
// ─────────────────────────────────────────────
router.get("/verify", async (req, res, next) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ success: false, error: "Stripe is not configured." });
        }

        const { session_id } = req.query;
        if (!session_id) {
            return res.status(400).json({ success: false, error: "session_id required" });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status !== "paid") {
            return res.status(400).json({ success: false, error: "Payment not completed" });
        }

        const meta = session.metadata || {};
        if (meta.type && meta.type !== "hire") {
            return res.status(400).json({ success: false, error: "Wrong session type" });
        }
        if (!meta.hireId || meta.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: "Session does not belong to you" });
        }

        const db = getDb();
        const hire = await db.collection("hires").findOne({ _id: new ObjectId(meta.hireId) });
        if (!hire) return res.status(404).json({ success: false, error: "Hire not found" });

        if (hire.status === "paid") {
            return res.json({
                success: true,
                data: { alreadyPaid: true, transactionId: hire.transactionId },
            });
        }

        const now = new Date();
        const transactionId = genTxnId();

        await db.collection("hires").updateOne(
            { _id: hire._id },
            {
                $set: {
                    status: "paid",
                    paidAt: now,
                    updatedAt: now,
                    transactionId,
                    stripeSessionId: session_id,
                },
            }
        );

        await db.collection("transactions").insertOne({
            type: "hire",
            transactionId,
            hireId: hire._id,
            userId: hire.userId,
            userEmail: hire.userEmail,
            lawyerId: hire.lawyerId,
            lawyerProfileId: hire.lawyerProfileId,
            lawyerName: hire.lawyerName,
            amount: hire.fee,
            currency: "BDT",
            stripeSessionId: session_id,
            stripeAmount: session.amount_total,
            stripeCurrency: session.currency,
            status: "succeeded",
            createdAt: now,
        });

        res.json({ success: true, data: { status: "paid", transactionId } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// POST /api/payments/lawyer-fee-checkout — one-time publish fee
// ─────────────────────────────────────────────
router.post("/lawyer-fee-checkout", async (req, res, next) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ success: false, error: "Stripe is not configured." });
        }
        if (req.user.role !== "lawyer") {
            return res.status(403).json({ success: false, error: "Only lawyers can pay publishing fee" });
        }

        const db = getDb();
        const profile = await db.collection("lawyerProfiles").findOne({ userId: req.user.id });
        if (!profile) {
            return res.status(404).json({ success: false, error: "Create your profile first" });
        }
        if (profile.publishFeePaid) {
            return res.status(400).json({ success: false, error: "Publish fee already paid" });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "LegalEase — One-time Publishing Fee",
                            description: "Publish your lawyer profile and start receiving hire requests.",
                        },
                        unit_amount: toUsdCents(PUBLISH_FEE_BDT),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                type: "publish-fee",
                lawyerUserId: req.user.id,
                lawyerProfileId: profile._id.toString(),
            },
            success_url: `${FRONTEND_URL}/dashboard/lawyer/manage-legal-profile?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/dashboard/lawyer/manage-legal-profile?cancelled=1`,
        });

        res.json({ success: true, data: { url: session.url, sessionId: session.id } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/payments/lawyer-fee-verify?session_id=...
// ─────────────────────────────────────────────
router.get("/lawyer-fee-verify", async (req, res, next) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ success: false, error: "Stripe is not configured." });
        }
        if (req.user.role !== "lawyer") {
            return res.status(403).json({ success: false, error: "Only lawyers" });
        }

        const { session_id } = req.query;
        if (!session_id) {
            return res.status(400).json({ success: false, error: "session_id required" });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status !== "paid") {
            return res.status(400).json({ success: false, error: "Payment not completed" });
        }

        const meta = session.metadata || {};
        if (meta.type !== "publish-fee" || meta.lawyerUserId !== req.user.id) {
            return res.status(403).json({ success: false, error: "Session does not belong to you" });
        }

        const db = getDb();
        const profile = await db
            .collection("lawyerProfiles")
            .findOne({ _id: new ObjectId(meta.lawyerProfileId) });
        if (!profile) {
            return res.status(404).json({ success: false, error: "Profile not found" });
        }

        if (profile.publishFeePaid) {
            return res.json({
                success: true,
                data: { alreadyPaid: true, transactionId: profile.publishTxnId || null },
            });
        }

        const now = new Date();
        const transactionId = genTxnId();

        await db.collection("lawyerProfiles").updateOne(
            { _id: profile._id },
            {
                $set: {
                    publishFeePaid: true,
                    publishTxnId: transactionId,
                    publishPaidAt: now,
                    updatedAt: now,
                },
            }
        );

        await db.collection("transactions").insertOne({
            type: "publish-fee",
            transactionId,
            userId: req.user.id,
            userEmail: req.user.email,
            lawyerId: req.user.id,
            lawyerProfileId: profile._id,
            lawyerName: profile.name,
            amount: PUBLISH_FEE_BDT,
            currency: "BDT",
            stripeSessionId: session_id,
            stripeAmount: session.amount_total,
            stripeCurrency: session.currency,
            status: "succeeded",
            createdAt: now,
        });

        res.json({
            success: true,
            data: { status: "paid", transactionId },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;