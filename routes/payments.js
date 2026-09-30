// routes/payments.js
const express = require("express");
const { ObjectId } = require("mongodb");
const Stripe = require("stripe");
require("dotenv").config();               // ← fix: env load এখানেই
const { getDb } = require("../lib/db");

const router = express.Router();

// lazy init — env miss হলে crash নয়, meaningful error
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("⚠️  STRIPE_SECRET_KEY missing in .env — payments will fail");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// ─────────────────────────────────────────────
// POST /api/payments/checkout — Stripe Checkout Session create
// ─────────────────────────────────────────────
router.post("/checkout", async (req, res, next) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env",
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

        const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

        // BDT → USD cents (fake 100:1 for demo). Min $1.
        const usdCents = Math.max(100, Math.round(hire.fee));

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
                        unit_amount: usdCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                hireId: hire._id.toString(),
                userId: req.user.id,
            },
            success_url: `${FRONTEND_URL}/dashboard/user/hiring-history?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/dashboard/user/hiring-history?cancelled=1`,
        });

        res.json({
            success: true,
            data: { url: session.url, sessionId: session.id },
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// GET /api/payments/verify?session_id=...
// ─────────────────────────────────────────────
router.get("/verify", async (req, res, next) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                error: "Stripe is not configured.",
            });
        }

        const { session_id } = req.query;
        if (!session_id) {
            return res.status(400).json({ success: false, error: "session_id required" });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== "paid") {
            return res.status(400).json({ success: false, error: "Payment not completed" });
        }

        const { hireId, userId } = session.metadata || {};
        if (!hireId || userId !== req.user.id) {
            return res.status(403).json({ success: false, error: "Session does not belong to you" });
        }

        const db = getDb();
        const hire = await db.collection("hires").findOne({ _id: new ObjectId(hireId) });
        if (!hire) {
            return res.status(404).json({ success: false, error: "Hire not found" });
        }

        // already paid
        if (hire.status === "paid") {
            return res.json({
                success: true,
                data: { alreadyPaid: true, transactionId: hire.transactionId },
            });
        }

        const now = new Date();
        const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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

        res.json({
            success: true,
            data: { status: "paid", transactionId },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;