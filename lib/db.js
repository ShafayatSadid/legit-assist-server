// lib/db.js
const { MongoClient } = require("mongodb");

let client;
let db;

async function connectDb() {
    if (db) return db;

    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db("legit-assist");

    // ── Indexes (idempotent — বার বার call করলেও সমস্যা নেই) ──
    await db.collection("lawyerProfiles").createIndex({ published: 1, createdAt: -1 });
    await db.collection("lawyerProfiles").createIndex({ specialization: 1 });
    await db.collection("lawyerProfiles").createIndex({ fee: 1 });
    await db.collection("lawyerProfiles").createIndex({ hireCount: -1 });

    await db.collection("hires").createIndex({ userId: 1, createdAt: -1 });
    await db.collection("hires").createIndex({ lawyerId: 1, createdAt: -1 });

    // lib/db.js — connectDb() এর ভিতরে
    await db.collection("comments").createIndex({ lawyerProfileId: 1, createdAt: -1 });
    await db.collection("comments").createIndex({ userId: 1, createdAt: -1 });
    await db.collection("comments").createIndex(
        { userId: 1, lawyerProfileId: 1 },
        { unique: true }   // এক user এক lawyer-এ একবারই comment
    );

    console.log("MongoDB connected");
    return db;
}

function getDb() {
    if (!db) throw new Error("DB not connected. Call connectDb() first.");
    return db;
}

module.exports = { connectDb, getDb };