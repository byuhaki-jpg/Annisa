-- Migration 0001: Initialize all tables for Kost Annisa
-- ─────────────────────────────────────────────────────────

-- Users (authenticated via Cloudflare Access)
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  role       TEXT NOT NULL CHECK(role IN ('admin','petugas')),
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Properties (boarding houses)
CREATE TABLE IF NOT EXISTS properties (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id),
  room_no      INTEGER NOT NULL,
  monthly_rate INTEGER NOT NULL,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(property_id, room_no)
);

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id             TEXT PRIMARY KEY,
  property_id    TEXT NOT NULL REFERENCES properties(id),
  room_id        TEXT NOT NULL REFERENCES rooms(id),
  name           TEXT NOT NULL,
  wa_number      TEXT,
  move_in_date   TEXT NOT NULL,
  move_out_date  TEXT,
  deposit_amount INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id          TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  room_id     TEXT NOT NULL REFERENCES rooms(id),
  period      TEXT NOT NULL,
  invoice_no  TEXT UNIQUE NOT NULL,
  amount      INTEGER NOT NULL,
  status      TEXT NOT NULL CHECK(status IN ('unpaid','paid')) DEFAULT 'unpaid',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at     TEXT,
  UNIQUE(tenant_id, period)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount     INTEGER NOT NULL,
  method     TEXT NOT NULL,
  proof_key  TEXT,
  notes      TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id),
  expense_date TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       INTEGER NOT NULL,
  method       TEXT NOT NULL,
  receipt_key  TEXT,
  status       TEXT NOT NULL CHECK(status IN ('draft','confirmed')) DEFAULT 'confirmed',
  ocr_json     TEXT,
  notes        TEXT,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings (one per property)
CREATE TABLE IF NOT EXISTS settings (
  property_id        TEXT PRIMARY KEY REFERENCES properties(id),
  default_monthly_rate INTEGER NOT NULL DEFAULT 0,
  default_deposit      INTEGER NOT NULL DEFAULT 0,
  reminder_rules       TEXT,
  sheets_config        TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_period    ON invoices(property_id, period, status);
CREATE INDEX IF NOT EXISTS idx_expenses_date      ON expenses(property_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_tenants_active     ON tenants(property_id, is_active);
