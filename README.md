# VTMS — Vendor Transport Management System

A full-stack web application for managing vendors, purchase orders, transport dispatches, and financial summaries (Hissab). Built with React + Vite on the frontend and Vercel serverless functions on the backend, using Baserow as a no-code database.

---

## Features

- **Dashboard** — Live stats: total vendors, orders, transport entries, pending payments, and total Hissab amount
- **Vendors** — Add, edit, delete vendors; drill into a vendor profile to see all their orders and transport entries
- **Orders** — Track purchase orders per vendor with item, quantity, rate, amount (auto-calculated), and status (Pending / Received)
- **Transport** — Manage dispatch entries with LR number, transport name, city, quantity, dispatched quantity, remaining quantity, rate, and payment status (Pending / Paid / Partial)
- **Hissab** — Auto-computed financial summary: Dispatched Quantity × Rate, filterable by vendor and city
- **Reports** — Visual charts (pie + bar) for order status, payment status, and Hissab by vendor, plus exportable data tables
- **Settings** — Profile view and password change
- **Auth** — Secure JWT-based login with HTTP-only cookies; single admin user

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| State / Data | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Routing | React Router v6 |
| Backend | Vercel Serverless Functions (Node.js) |
| Database | [Baserow](https://baserow.io) (no-code database API) |
| Auth | JWT (HS256) via Web Crypto API, HTTP-only cookies |
| Deployment | Vercel (Hobby plan — single serverless function) |

---

## Project Structure

```
├── api/
│   └── index.ts          # Single unified serverless function (all /api/* routes)
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   ├── AppLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   └── ProtectedRoute.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── api-client.ts  # Axios instance with auth interceptor
│   │   └── utils.ts       # Formatters, helpers, status color maps
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── VendorsPage.tsx
│   │   ├── VendorProfilePage.tsx
│   │   ├── OrdersPage.tsx
│   │   ├── TransportPage.tsx
│   │   ├── HissabPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── LoginPage.tsx
│   ├── services/          # API service layer (one file per domain)
│   ├── types/
│   │   └── index.ts       # All TypeScript types
│   └── App.tsx
├── dev-server.mjs         # Local development API server (zero dependencies)
├── vercel.json            # Vercel rewrite rules
├── vite.config.ts         # Vite config with dev proxy to local API
└── .env.example
```

---

## Getting Started (Local)

### Prerequisites

- Node.js 18+
- A [Baserow](https://baserow.io) account with 3 tables created (Vendors, Orders, Transport)

### 1. Clone the repo

```bash
git clone https://github.com/MeghPatel327/Vendor-Transport-Management-System.git
cd Vendor-Transport-Management-System
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# Admin credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Baserow
BASEROW_API_URL=https://api.baserow.io
BASEROW_TOKEN=your_baserow_api_token

# Baserow Table IDs
BASEROW_VENDORS_TABLE_ID=your_vendors_table_id
BASEROW_ORDERS_TABLE_ID=your_orders_table_id
BASEROW_TRANSPORT_TABLE_ID=your_transport_table_id
```

### 4. Run locally

Open two terminals:

**Terminal 1 — API server** (port 3000):
```bash
npm run api
```

**Terminal 2 — Frontend** (port 5173):
```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Baserow Setup

Create a free account at [baserow.io](https://baserow.io) and set up 3 tables:

### Vendors Table
| Field | Type |
|---|---|
| name | Text |

### Orders Table
| Field | Type |
|---|---|
| vendor_id | Number |
| item | Text |
| quantity | Number |
| rate | Number |
| amount | Number |
| status | Single Select (`Pending`, `Received`) |
| order_date | Date |

### Transport Table
| Field | Type |
|---|---|
| vendor_id | Number |
| lr_number | Text |
| transport_name | Text |
| city | Text |
| item | Text |
| quantity | Number |
| dispatched_quantity | Number |
| remaining_quantity | Number |
| rate | Number |
| amount | Number |
| payment_status | Single Select (`Pending`, `Paid`, `Partial`) |
| transport_date | Date |

After creating the tables, copy the Table IDs from the Baserow URL and add them to your `.env`.

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Import the project on Vercel

Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.

### 3. Set Environment Variables

In your Vercel project → **Settings → Environment Variables**, add all the variables from `.env.example`:

| Variable | Description |
|---|---|
| `ADMIN_USERNAME` | Login username |
| `ADMIN_PASSWORD` | Login password |
| `JWT_SECRET` | Secret key for signing JWTs |
| `BASEROW_API_URL` | `https://api.baserow.io` |
| `BASEROW_TOKEN` | Your Baserow API token |
| `BASEROW_VENDORS_TABLE_ID` | Baserow vendors table ID |
| `BASEROW_ORDERS_TABLE_ID` | Baserow orders table ID |
| `BASEROW_TRANSPORT_TABLE_ID` | Baserow transport table ID |

### 4. Deploy

Vercel will auto-deploy on every push to `main`. The project uses a single serverless function (`api/index.ts`), compatible with Vercel's **Hobby plan**.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite frontend dev server (port 5173) |
| `npm run api` | Start local API server (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

---

## API Routes

All routes are handled by a single serverless function at `/api/index.ts`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login and set auth cookie |
| GET | `/api/auth/me` | Get current user from cookie |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/dashboard/stats` | Aggregate dashboard statistics |
| GET / POST | `/api/vendors` | List or create vendors |
| GET / PUT / DELETE | `/api/vendors/:id` | Get, update, or delete a vendor |
| GET / POST | `/api/orders` | List or create orders |
| GET / PUT / DELETE | `/api/orders/:id` | Get, update, or delete an order |
| GET / POST | `/api/transport` | List or create transport entries |
| GET / PUT / DELETE | `/api/transport/:id` | Get, update, or delete a transport entry |
| GET | `/api/hissab` | Get Hissab summary (dispatched qty × rate) |

---

## Security

- Passwords are never stored — only compared in memory against environment variables
- JWT tokens are stored in **HTTP-only cookies** (not accessible via JavaScript)
- Timing-safe login delay (500ms on failure) to prevent brute-force timing attacks
- All `/api` routes except `/auth/login` require a valid JWT cookie
- Baserow token is server-side only, never exposed to the browser

---

## License

MIT
