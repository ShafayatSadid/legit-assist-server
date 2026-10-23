// seed.js
require("dotenv").config();
const { connectDb } = require("./lib/db");

// ─────────────────────────────────────────────
// ১. ম্যানুয়াল বেস ডেটা (আপনার আগের ৪টি)
// ─────────────────────────────────────────────
const BASE_LAWYERS = [
    {
        userId: "seed-user-1",
        email: "rahim@law.com",
        name: "Adv. Rahim Uddin",
        bio: "Criminal law expert with 15 years of courtroom experience.",
        specialization: "Criminal",
        fee: 5000,
        image: "https://i.pravatar.cc/300?img=12",
        gallery: [
            "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1589391886645-d51941baf7fb?auto=format&fit=crop&w=800&q=80",
        ],
        published: true,
        isBusy: false,
        hireCount: 12,
        publishFeePaid: true,
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
        gallery: [],
        published: true,
        isBusy: false,
        hireCount: 20,
        publishFeePaid: true,
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
        gallery: [],
        published: true,
        isBusy: true,
        hireCount: 8,
        publishFeePaid: true,
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
        gallery: [],
        published: true,
        isBusy: false,
        hireCount: 5,
        publishFeePaid: true,
        createdAt: new Date(Date.now() - 259200000),
        updatedAt: new Date(),
    },
];

// ─────────────────────────────────────────────
// ২. অটোমেটিক ২০টি ডামি লয়ার জেনারেট করার লজিক
// ─────────────────────────────────────────────
const firstNames = ["Rafi", "Nusrat", "Tahmid", "Sadia", "Arif", "Mehjabin", "Fahim", "Anika", "Sajid", "Farhana", "Imran", "Sharmin", "Tanvir", "Rubina", "Asif", "Nadia", "Riad", "Sabrina", "Zubair", "Tasnim"];
const lastNames = ["Hossain", "Jahan", "Islam", "Akter", "Chowdhury", "Rahman", "Ahmed", "Khan", "Siddique", "Alam"];
const categories = ["Criminal", "Corporate", "Family", "Property", "Immigration", "Tax", "Labor", "Intellectual Property"];
const bios = [
    "Dedicated legal professional with a proven track record of success.",
    "Specialized in providing strategic legal counsel to diverse clients.",
    "Passionate about justice and committed to protecting your rights.",
    "Extensive experience in complex litigation and dispute resolution.",
    "Focused on delivering practical and cost-effective legal solutions."
];

const GENERATED_LAWYERS = Array.from({ length: 20 }).map((_, i) => {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `Adv. ${firstName} ${lastName}`;
    const spec = categories[i % categories.length];
    const fee = Math.floor(Math.random() * 10 + 3) * 1000; // 3000 to 12000
    const hireCount = Math.floor(Math.random() * 40); // 0 to 39
    const isBusy = Math.random() > 0.8; // 20% chance of being busy
    const imgId = (i + 5) * 2; // Pravatar image IDs

    return {
        userId: `seed-user-${i + 5}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@law.com`,
        name: name,
        bio: `${bios[i % bios.length]} Expert in ${spec} law.`,
        specialization: spec,
        fee: fee,
        image: `https://i.pravatar.cc/300?img=${imgId}`,
        gallery: i % 3 === 0 ? [ // প্রতি ৩জনের ১জনের গ্যালারি থাকবে
            "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=800&q=80"
        ] : [],
        published: true,
        isBusy: isBusy,
        hireCount: hireCount,
        publishFeePaid: true,
        createdAt: new Date(Date.now() - Math.random() * 10000000000), // র‍্যান্ডম ডেট
        updatedAt: new Date(),
    };
});

// সবগুলো ডেটা একসাথে মিলিয়ে নেওয়া
const ALL_LAWYERS = [...BASE_LAWYERS, ...GENERATED_LAWYERS];

// ─────────────────────────────────────────────
// ৩. ডেটাবেসে ইনসার্ট করা
// ─────────────────────────────────────────────
async function seed() {
    try {
        const db = await connectDb();

        // আগের সব seed ডেটা মুছে ফেলি (শুধু seed-user-* গুলো)
        await db.collection("lawyerProfiles").deleteMany({
            userId: { $regex: "^seed-user-" },
        });

        const result = await db
            .collection("lawyerProfiles")
            .insertMany(ALL_LAWYERS);

        console.log(`✅ Successfully inserted ${result.insertedCount} lawyers!`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    }
}

seed();