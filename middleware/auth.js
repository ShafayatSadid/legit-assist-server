// middleware/auth.js
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const { getDb } = require("../lib/db");

const AUTH_BASE_URL = process.env.AUTH_BASE_URL || "http://localhost:3000";
const JWKS = createRemoteJWKSet(new URL(`${AUTH_BASE_URL}/api/auth/jwks`));

// ─────────────────────────────────────────────
// DB থেকে fresh role আনি (JWT-র stale role ignore)
// ─────────────────────────────────────────────
async function resolveUser(payload) {
    try {
        const db = getDb();
        const userDoc = await db.collection("user").findOne({ id: payload.id });

        if (userDoc?.role) {
            return {
                id: userDoc.id,
                email: userDoc.email,
                role: userDoc.role,
            };
        }
    } catch (err) {
        console.error("resolveUser DB error:", err.message);
    }

    return {
        id: payload.id,
        email: payload.email,
        role: payload.role || null,
    };
}

// ─────────────────────────────────────────────
// verifyToken
// ─────────────────────────────────────────────
async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const token = authHeader.split(" ")[1];
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: AUTH_BASE_URL,
            audience: AUTH_BASE_URL,
        });

        req.user = await resolveUser(payload);
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }
}

// ─────────────────────────────────────────────
// verifyTokenOptional
// ─────────────────────────────────────────────
async function verifyTokenOptional(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        req.user = null;
        return next();
    }

    try {
        const token = authHeader.split(" ")[1];
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: AUTH_BASE_URL,
            audience: AUTH_BASE_URL,
        });

        req.user = await resolveUser(payload);
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }
}

// ─────────────────────────────────────────────
// requireAuth
// ─────────────────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: "Authentication required" });
    }
    next();
}

// ─────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: "Forbidden" });
        }
        next();
    };
}

module.exports = { verifyToken, verifyTokenOptional, requireAuth, requireRole };