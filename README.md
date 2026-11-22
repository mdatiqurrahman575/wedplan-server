# WedPlan — Role-Based Wedding Planning Platform (Backend API)

Modular RESTful backend server for **WedPlan**, built with **Node.js**, **Express.js**, **MongoDB**, **JWT Role Protection**, and **Stripe Webhooks**. It powers secure role-based dashboards, booking management, service moderation, and automated vendor subscription upgrades.

## Live Links & Repositories

- **Live Website (Client):** https://wedplan-client-bay.vercel.app
- **Production API (Server):** https://wedplan-server-nu-virid.vercel.app
- **Client GitHub Repository:** https://github.com/mdatiqurrahman575/wedplan-client
- **Server GitHub Repository:** https://github.com/mdatiqurrahman575/wedplan-server

---

## Important Features

- **JWT Authentication & Role-Based Access Control (RBAC):** Verifies Better Auth JWT tokens on every protected endpoint with dedicated middleware for `Admin`, `Vendor`, and `Customer` roles.
- **User Block Enforcement:** Real-time verification ensuring blocked users cannot access protected APIs or perform platform actions.
- **Vendor Plan Enforcement:** Automatically limits Free-tier vendors to a maximum of 3 active services while unlocking unlimited listings for Premium vendors.
- **Smart Booking Conflict Prevention:** Prevents duplicate active bookings for the same service on the same event date and blocks vendors/admins from submitting customer bookings.
- **Secure Stripe Checkout & Webhook Integration:** Creates authenticated Stripe Checkout sessions and verifies `checkout.session.completed` webhook events via raw-body signatures before upgrading vendor plans and recording transactions.
- **Admin Moderation & Analytics:** Provides platform-wide statistics, user block/unblock controls, service approval workflows, and read-only transaction logs.

---

## Tech Stack & Architecture

- **Runtime & Framework:** Node.js, Express.js
- **Database:** MongoDB Native Driver (`wedplanDB`)
- **Security & Auth:** Better Auth JWT Verification (`jose`), Role-Based Access Control (`Admin`, `Vendor`, `Customer`), User Block Enforcement
- **Payments:** Stripe Checkout Sessions & Raw-Body Webhook Verification

---

## Folder Structure

```text
wedplan-server/
├── config/
│   └── db.js                 # MongoDB connection & collections helper
├── middlewares/
│   └── authMiddleware.js     # JWT verification, role check, and block status check
├── routes/
│   ├── serviceRoutes.js      # Public & Vendor service CRUD + Free plan limit check
│   ├── bookingRoutes.js      # Customer booking & Vendor status updates
│   ├── adminRoutes.js        # User block/unblock, service moderation, stats
│   └── paymentRoutes.js      # Stripe Checkout session & Webhook handler
├── .env
├── index.js                  # Express app entry point & CORS config
├── package.json
└── vercel.json
```

---

## Core API Endpoints

### Services

- `GET /api/services` — Fetch approved & active services (supports search, category, location, price sort)
- `GET /api/services/:id` — Get single service details
- `POST /api/services` — Create service (Vendor only; enforces max 3 active services on Free plan)
- `PATCH /api/services/:id` — Update service or toggle availability (Vendor only)
- `DELETE /api/services/:id` — Delete service (Vendor / Admin)

### Bookings

- `POST /api/bookings` — Create booking (Customer only; prevents duplicate active bookings on the same date)
- `GET /api/bookings/my-bookings` — Fetch logged-in customer's bookings
- `PATCH /api/bookings/:id/cancel` — Cancel a `Pending` booking (Customer only)
- `GET /api/bookings/vendor-requests` — Fetch booking requests for vendor's services
- `PATCH /api/bookings/:id/status` — Accept or Reject a `Pending` booking (Vendor only)

### Payments & Webhooks

- `POST /api/payments/create-checkout-session` — Create Stripe Checkout session for Vendor Premium upgrade
- `POST /api/webhooks/stripe` — Stripe Webhook listener (`checkout.session.completed`) to upgrade vendor plan & record transaction
- `GET /api/admin/transactions` — Read-only list of all Stripe transactions (Admin only)

### Admin & Profile

- `GET /api/dashboard/stats` — Role-specific overview statistics
- `PATCH /api/users/profile` — Update user name, photo, or business name
- `GET /api/admin/users` — List all users with search & role filters
- `PATCH /api/admin/users/:id/block` — Block or Unblock a user
- `PATCH /api/admin/services/:id/status` — Approve or Reject a pending service

---

## Local Setup & Installation

1. **Clone the repository:**

   ```bash
   git clone https://wedplan-server-nu-virid.vercel.app
   cd wedplan-server
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add:

   ```env
   PORT=5000
   CLIENT_URL=http://localhost:3000
   BETTER_AUTH_URL=http://localhost:3000
   DB_NAME=wedplanDB
   MONGODB_URI=your_mongodb_connection_string
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
   ```

4. **Start the server:**
   ```bash
   npm start
   ```
   The server will run on `http://localhost:5000`.
