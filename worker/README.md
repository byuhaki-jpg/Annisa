# Kost Annisa – Cloudflare Worker API

Backend API for the Kost Annisa boarding house finance tracker. Built 100% on the Cloudflare stack.

## Tech Stack

| Component | Service |
|---|---|
| **API Server** | Cloudflare Workers (Hono framework) |
| **Database** | Cloudflare D1 (SQLite) |
| **File Storage** | Cloudflare R2 (payment proofs & receipts) |
| **Authentication** | Cloudflare Access (header-based, zero-trust) |
| **OCR** | Gemini Vision API (receipt scanning) |
| **Sheets Sync** | Google Sheets API (auto-log income & expenses) |
| **Cron** | Cloudflare Workers Scheduled Events |

## Folder Structure

```
worker/
├── wrangler.toml              # Wrangler config (D1, R2 bindings)
├── package.json
├── tsconfig.json
├── .dev.vars.example          # Local dev secrets template
├── migrations/
│   ├── 0001_init.sql          # DDL: all tables + indexes
│   └── ...                    # Additional migrations (settings, auth, etc)
└── src/
    ├── index.ts               # Main Hono router + all endpoints
    ├── auth.ts                # CF Access auth middleware & role guards
    ├── db.ts                  # D1 query helpers
    ├── r2.ts                  # R2 upload/presign helpers
    ├── gemini.ts              # Gemini Vision OCR integration
    ├── sheets.ts              # Google Sheets API (JWT auth)
    ├── validators.ts          # Zod schemas for all inputs
    ├── utils.ts               # ID gen, period helpers
    └── types.ts               # Shared type definitions
```

## API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check (no auth) |

### Authenticated (requires CF Access or `X-Mock-Email` header)
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/me` | any | Current user info |
| GET | `/api/dashboard?period=YYYY-MM` | any | Monthly overview |
| GET | `/api/rooms` | any | List all rooms |
| POST | `/api/rooms` | admin | Create room |
| PATCH | `/api/rooms/:id` | admin | Update room |
| GET | `/api/tenants` | any | List all tenants |
| POST | `/api/tenants` | admin | Create tenant |
| PATCH | `/api/tenants/:id` | admin | Update tenant |
| POST | `/api/tenants/:id/deactivate` | admin | Deactivate tenant |
| GET | `/api/invoices?period=YYYY-MM` | any | List invoices |
| POST | `/api/invoices/generate?period=YYYY-MM` | any | Auto-generate invoices |
| POST | `/api/payments` | any | Record payment → mark invoice paid |
| GET | `/api/expenses?period=YYYY-MM` | any | List expenses |
| POST | `/api/expenses` | any | Create expense |
| POST | `/api/expenses/confirm/:id` | any | Confirm draft expense |
| POST | `/api/uploads/presign` | any | Get upload URL for R2 |
| PUT | `/api/uploads/:key` | any | Upload file to R2 |
| POST | `/api/ocr/receipt` | any | OCR receipt → draft expense |
| GET | `/api/settings` | any | Read settings |
| PATCH | `/api/settings` | admin | Update settings |
| GET | `/api/cron/reminders` | admin | Simulate cron reminder check |

## Setup Guide

### 1. Prerequisites
- Node.js 18+
- Cloudflare account with Workers, D1, R2 enabled
- Wrangler CLI (`npm i -g wrangler` or use `npx`)

### 2. Install Dependencies
```bash
cd worker
npm install
```

### 3. Create D1 Database
```bash
npx wrangler d1 create kost-annisa-db
```
Copy the `database_id` from the output and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml`.

### 4. Run Migrations
```bash
# Local
npm run migrate:local
npm run seed:local

# Remote (production)
npm run migrate:remote
npm run seed:remote
```

### 5. Create R2 Bucket
```bash
npx wrangler r2 bucket create kost-annisa-files
```

### 6. Configure Secrets
```bash
# Copy example file
cp .dev.vars.example .dev.vars
# Edit .dev.vars with real values

# For production, use wrangler secrets:
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put SHEETS_SPREADSHEET_ID
npx wrangler secret put SHEETS_INCOME_SHEET_NAME
npx wrangler secret put SHEETS_EXPENSE_SHEET_NAME
```

### 7. Configure Cloudflare Access
1. Go to Cloudflare Zero Trust → Access → Applications
2. Create an application for `api.kosannisa.my.id` (or your worker route)
3. Add an Access Policy (email-based, Google/GitHub IdP)
4. CF Access will inject `Cf-Access-Authenticated-User-Email` header automatically

### 8. Run Locally
```bash
npm run dev
# Worker starts at http://localhost:8787
```

### 9. Test with curl
```bash
# Health check
curl http://localhost:8787/api/health

# Authenticated requests (use X-Mock-Email for local dev)
curl http://localhost:8787/api/me -H "X-Mock-Email: admin@kosannisa.my.id"
curl http://localhost:8787/api/rooms -H "X-Mock-Email: admin@kosannisa.my.id"

# Generate invoices
curl -X POST "http://localhost:8787/api/invoices/generate?period=2026-02" \
  -H "X-Mock-Email: admin@kosannisa.my.id"

# Record payment
curl -X POST http://localhost:8787/api/payments \
  -H "X-Mock-Email: admin@kosannisa.my.id" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id":"<ID>","amount":1500000,"method":"transfer"}'

# Add expense
curl -X POST http://localhost:8787/api/expenses \
  -H "X-Mock-Email: petugas@kosannisa.my.id" \
  -H "Content-Type: application/json" \
  -d '{"expense_date":"2026-02-20","category":"listrik","amount":350000,"method":"transfer"}'
```

### 10. Deploy to Production
```bash
npm run deploy
```

## Connecting Frontend (Phase 2)

Replace the mock store in the Next.js frontend (`src/lib/store.tsx`) with real API calls:

```typescript
// Example: fetch rooms from Worker API
const res = await fetch('https://api.kosannisa.my.id/api/rooms', {
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // CF Access cookies
});
const { rooms } = await res.json();
```

The frontend's CORS is already configured in the Worker to accept requests from `kosannisa.my.id` and `*.pages.dev` preview domains.

## Error Format

All errors follow a consistent structure:
```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Invalid input",
    "details": {}
  }
}
```

Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `CONFIG`
