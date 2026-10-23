# LegitAssist — Server

> REST API backend for **LegitAssist** — Express 5 + MongoDB (native driver) + Better Auth JWT + Stripe.

**Live API:** https://legit-assist-server.vercel.app

---

## 📌 Purpose

Backend for the LegitAssist lawyer hiring platform. Handles authentication (JWT verification), lawyer listings (with image galleries), hire requests, comments, Stripe payments, transactions, contact form storage, public analytics, and admin operations.

---

## ✨ Features

- **Authentication:** JWT verification (Better Auth JWKS).
- **Role-Based Access:** Middleware for `user`, `lawyer`, and `admin`.
- **Lawyer Profiles:** CRUD operations, Multiple Image Gallery support, Publish/Unpublish toggle.
- **Hire System:** Complete workflow (pending → accepted → paid / rejected).
- **Comment System:** Verified reviews (only clients who have successfully hired can review).
- **Payments:** Stripe Checkout for Hire Payments and Lawyer Publishing Fees.
- **Analytics:** Dynamic aggregation for Users, Lawyers, Hires, Revenue, and Chart data (Monthly hires, Hires by specialization).
- **Public Data:** Endpoints for Home page statistics and latest testimonials.
- **Contact Form:** API endpoint to securely save user messages to the database.
- **Cloudinary Integration:** Handles image URLs uploaded from the client.

---

## 🛠 Tech Stack

- **Runtime:** Node.js (CommonJS)
- **Framework:** Express 5
- **Database:** MongoDB Atlas (Native Driver)
- **Auth:** Better Auth (JWT Plugin)
- **JWT Verify:** jose-cjs
- **Payments:** Stripe (Test mode)
- **Deployment:** Vercel / Render / Railway

---

## 📦 npm Packages

- `express`
- `cors`
- `dotenv`
- `mongodb`
- `better-auth`
- `@better-auth/mongo-adapter`
- `jose-cjs`
- `stripe`

---

## ⚙️ Setup (Local Development)

### 1. Clone & install
```bash
git clone <server-repo-url>
cd legit-assist-server
npm install
```

### 2. Environment variables
Create a `.env` file in the project root:

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_uri
AUTH_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
```

### 3. Run
```bash
node index.js
```
Server runs on **http://localhost:5000**

**Health check:**
```text
GET http://localhost:5000/
→ { success: true, data: "LegitAssist API running" }
```

---

## 🔌 API Endpoints

### Public
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/lawyers` | Browse lawyers (search, filter, sort, pagination, excludeId) |
| GET | `/api/lawyers/featured` | Latest 6 published |
| GET | `/api/lawyers/top` | Top 3 most-hired |
| GET | `/api/lawyers/categories` | Static categories |
| GET | `/api/lawyers/:id` | Single lawyer profile |
| GET | `/api/comments/lawyer/:id` | Public comments for a lawyer |
| GET | `/api/public/stats` | Platform stats for Home page |
| GET | `/api/public/testimonials` | Latest 3 reviews for Home page |
| POST | `/api/contact` | Submit contact form message |

### Client / User (role: user)
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/hires` | Create hire request |
| GET | `/api/hires/my` | Own hiring history |
| GET | `/api/hires/status/:lawyerProfileId` | Get specific hire + comment status |
| POST | `/api/comments` | Post comment (requires successful hire) |
| GET | `/api/comments/my` | Own comments |
| PATCH | `/api/comments/:id` | Edit comment |
| DELETE | `/api/comments/:id` | Delete comment |
| PATCH | `/api/user/profile` | Update name + image |

### Lawyer (role: lawyer)
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/lawyer/profile` | Create profile |
| GET | `/api/lawyer/profile` | Own profile |
| PATCH | `/api/lawyer/profile` | Update profile (including gallery) |
| DELETE | `/api/lawyer/profile` | Delete profile |
| PATCH | `/api/lawyer/profile/toggle-publish` | Publish / Unpublish |
| GET | `/api/hires/lawyer` | Incoming hire requests |
| PATCH | `/api/hires/:id/accept` | Accept request |
| PATCH | `/api/hires/:id/reject` | Reject request |

### Payments (Protected)
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/payments/checkout` | Stripe session — hire payment |
| GET | `/api/payments/verify` | Verify hire payment |
| POST | `/api/payments/lawyer-fee-checkout` | Stripe session — publishing fee |
| GET | `/api/payments/lawyer-fee-verify` | Verify publishing fee |

### Admin (role: admin)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id/role` | Change role |
| DELETE | `/api/admin/users/:id` | Delete user + profile |
| GET | `/api/admin/lawyers` | List all lawyer listings |
| PATCH | `/api/admin/lawyers/:id/toggle-publish` | Toggle publish |
| DELETE | `/api/admin/lawyers/:id` | Delete listing |
| GET | `/api/admin/transactions` | All transactions |
| GET | `/api/admin/analytics` | Total counts, revenue + Chart data |

**Auth header:**
```text
Authorization: Bearer <jwt-token>
```

---

## 🗄 Database Collections

| Collection | Purpose |
|------------|---------|
| `user` | Better Auth–managed users (with role) |
| `lawyerProfiles` | Lawyer listings (including gallery array) |
| `hires` | Hire requests + statuses |
| `comments` | Verified reviews on lawyers |
| `transactions` | Hire payments + publishing fees |
| `contactMessages` | User messages from the contact form |

*Indexes are created automatically in `lib/db.js` on first connect.*

---

## 🚀 Deploy

**Vercel / Render / Railway:**

1. Push to GitHub.
2. Create new Web Service → connect repo.
3. Build command: `npm install`
4. Start command: `node index.js`
5. Add all env vars (see `.env` section above).
6. Deploy → copy live URL.
7. Update client's `NEXT_PUBLIC_API_URL` with the deployed URL.

**⚠️ CORS:** For production, restrict origins:
```js
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
```

---

## 📁 Project Structure

```text
index.js                 Express app + route mounting
lib/
└── db.js                MongoClient singleton + indexes
middleware/
└── auth.js              verifyToken, verifyTokenOptional, requireRole
routes/
├── lawyers.js
├── lawyer.js
├── hires.js
├── comments.js
├── user.js
├── admin.js
├── payments.js
├── public.js            Home stats & testimonials
└── contact.js           Contact form storage
seed.js                  Dummy lawyer data generator
```

---

## 🧪 Seeding (dev only)

```bash
node seed.js
```
*Inserts 24 dummy lawyers (including gallery images) for testing purposes.*

---

## 📄 License
MIT