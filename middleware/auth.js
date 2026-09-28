// middleware/auth.js
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const AUTH_BASE_URL = process.env.AUTH_BASE_URL || "http://localhost:3000";
const JWKS = createRemoteJWKSet(new URL(`${AUTH_BASE_URL}/api/auth/jwks`));

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
        req.user = {
            id: payload.id,
            email: payload.email,
            role: payload.role,
        };
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }
}

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

module.exports = { verifyToken, requireRole };