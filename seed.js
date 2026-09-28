// seed.js
require("dotenv").config();
const { connectDb } = require("./lib/db");

const DUMMY_LAWYERS = [
    {
        userId: "seed-user-1",
        email: "rahim@law.com",
        name: "Adv. Rahim Uddin",
        bio: "Criminal law expert with 15 years of courtroom experience.",
        specialization: "Criminal",
        fee: 5000,
        image: "https://i.pravatar.cc/300?img=12",
        published: true,
        isBusy: false,
        hireCount: 12,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        userId: "seed-user-2",
        email: "karim@law.com",
        name: "Adv. Karim Ahmed",
        bio: "Corporate law specialist. Handled 100+ M&A deals.",
        specialization: "Corporate",
        fee: 8000,
        image: "https://i.pravatar.cc/300?img=15",
        published: true,
        isBusy: false,
        hireCount: 20,
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(),
    },
    {
        userId: "seed-user-3",
        email: "fatima@law.com",
        name: "Adv. Fatima Begum",
        bio: "Family law and mediation expert. Compassionate approach.",
        specialization: "Family",
        fee: 3500,
        image: "https://i.pravatar.cc/300?img=45",
        published: true,
        isBusy: true,
        hireCount: 8,
        createdAt: new Date(Date.now() - 172800000),
        updatedAt: new Date(),
    },
    {
        userId: "seed-user-4",
        email: "hasan@law.com",
        name: "Adv. Hasan Mahmud",
        bio: "Property and real estate law. 10 years experience.",
        specialization: "Property",
        fee: 6000,
        image: "https://i.pravatar.cc/300?img=33",
        published: true,
        isBusy: false,
        hireCount: 5,
        createdAt: new Date(Date.now() - 259200000),
        updatedAt: new Date(),
    },
];

async function seed() {
    try {
        const db = await connectDb();

        // আগের seed ডেটা মুছে ফেলি (শুধু seed-user-* গুলো)
        await db.collection("lawyerProfiles").deleteMany({
            userId: { $regex: "^seed-user-" },
        });

        const result = await db
            .collection("lawyerProfiles")
            .insertMany(DUMMY_LAWYERS);

        console.log(`${result.insertedCount} lawyers inserted`);
        process.exit(0);
    } catch (err) {
        console.error("Seed failed:", err);
        process.exit(1);
    }
}

seed();