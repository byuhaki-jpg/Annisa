-- Migration 0003: Add integration settings
-- ─────────────────────────────────────────────────────────

ALTER TABLE settings ADD COLUMN gemini_api_key TEXT;
ALTER TABLE settings ADD COLUMN google_service_account_json TEXT;
ALTER TABLE settings ADD COLUMN sheets_spreadsheet_id TEXT;
ALTER TABLE settings ADD COLUMN sheets_income_sheet_name TEXT DEFAULT 'Income';
ALTER TABLE settings ADD COLUMN sheets_expense_sheet_name TEXT DEFAULT 'Expenses';
