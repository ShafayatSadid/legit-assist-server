# LegalEase — Server

> REST API backend for **LegalEase** — Express 5 + MongoDB (native driver) + Better Auth JWT + Stripe.

**Live API:** https://legit-assist-server.vercel.app

---

## 📌 Purpose

Backend for the LegalEase lawyer hiring platform. Handles authentication (JWT verification), lawyer listings, hire requests, comments, payments (Stripe Checkout), transactions, and admin operations.

---

## ✨ Features

- JWT verification (Better Auth JWKS)
- Role-based access (`user`, `lawyer`, `admin`)
- Lawyer profile CRUD + publish/unpublish
- Hire request workflow (pending → accepted → paid / rejected)
- Comment system (only hired clients can review)
- Stripe Checkout for hire payments and lawyer publishing fee
- Transaction records with revenue analytics
- Admin endpoints: users, lawyers, transactions, analytics
- Search / filter / sort / pagination for lawyers
- Cloudinary image upload (unsigned preset from client)

---

## 🛠 Tech Stack

- Node.js (CommonJS)
- Express 5
- MongoDB Atlas (native driver)
- Better Auth (JWT plugin)
- jose-cjs (JWT verification)
- Stripe (test mode)
- Deployment: Vercel / Render / Railway

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

## ⚙️ Setup

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

```
GET http://localhost:5000/
→ { success: true, data: "LegalEase API running" }
```

---

## 🔌 API Endpoints

### Public

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/lawyers` | Browse lawyers (search, filter, sort, pagination) |
| GET | `/api/lawyers/featured` | Latest 6 published |
| GET | `/api/lawyers/top` | Top 3 most-hired |
| GET | `/api/lawyers/categories` | Static categories |
| GET | `/api/lawyers/:id` | Single lawyer |
| GET | `/api/comments/lawyer/:id` | Comments for a lawyer |

### Client (role: user)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/hires` | Create hire request |
| GET | `/api/hires/my` | Own hiring history |
| GET | `/api/hires/status/:lawyerProfileId` | Hire + comment status |
| POST | `/api/comments` | Post comment (hire required) |
| GET | `/api/comments/my` | Own comments |
| PATCH | `/api/comments/:id` | Edit comment |
| DELETE | `/api/comments/:id` | Delete comment |
| PATCH | `/api/user/profile` | Update name + image |

### Lawyer (role: lawyer)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/lawyer/profile` | Create profile |
| GET | `/api/lawyer/profile` | Own profile |
| PATCH | `/api/lawyer/profile` | Update |
| DELETE | `/api/lawyer/profile` | Delete |
| PATCH | `/api/lawyer/profile/toggle-publish` | Publish / unpublish |
| GET | `/api/hires/lawyer` | Incoming requests |
| PATCH | `/api/hires/:id/accept` | Accept |
| PATCH | `/api/hires/:id/reject` | Reject |

### Payments

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/payments/checkout` | Stripe session — hire payment |
| GET | `/api/payments/verify` | Verify hire payment |
| POST | `/api/payments/lawyer-fee-checkout` | Stripe session — publishing fee |
| GET | `/api/payments/lawyer-fee-verify` | Verify publishing fee |

### Admin (role: admin)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/users` | List users |
| PATCH | `/api/admin/users/:id/role` | Change role |
| DELETE | `/api/admin/users/:id` | Delete user + profile |
| GET | `/api/admin/lawyers` | List all listings |
| PATCH | `/api/admin/lawyers/:id/toggle-publish` | Toggle publish |
| DELETE | `/api/admin/lawyers/:id` | Delete listing |
| GET | `/api/admin/transactions` | All transactions |
| GET | `/api/admin/analytics` | Total counts + revenue |

**Auth header:**

```
Authorization: Bearer <jwt-token>
```

---

## 🗄 Database Collections

| Collection | Purpose |
|------------|---------|
| `user` | Better Auth–managed users (with `role`) |
| `lawyerProfiles` | Lawyer listings |
| `hires` | Hire requests + status |
| `comments` | Reviews on lawyers |
| `transactions` | Hire payments + publishing fees |

Indexes are created automatically in `lib/db.js` on first connect.

---

## 🚀 Deploy

**Vercel / Render / Railway:**

1. Push to GitHub
2. Create new Web Service → connect repo
3. Build command: `npm install`
4. Start command: `node index.js`
5. Add all env vars (see `.env` section above)
6. Deploy → copy live URL
7. Update client's `NEXT_PUBLIC_API_URL` with the deployed URL

**⚠️ CORS:** Currently allows all origins (`cors()`). For production, restrict:

```js
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
```

---

## 📁 Project Structure

```
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
└── payments.js
seed.js                  Dummy lawyer data
```

---

## 🧪 Seeding (dev only)

```bash
node seed.js
```

Inserts 4 dummy lawyers for testing.

---

## 📄 License

MIT