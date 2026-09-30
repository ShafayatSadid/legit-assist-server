
---

## ২. `server/README.md`

```markdown
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
- Deployment: Render / Railway / Vercel

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