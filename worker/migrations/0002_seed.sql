-- Seed: demo property, rooms 1-9, 2 users, settings
-- ──────────────────────────────────────────────────

INSERT OR IGNORE INTO properties (id, name, address)
VALUES ('prop_kostannisa', 'Kost Annisa', 'Jl. Contoh No. 123, Kota, Indonesia');

-- Rooms 1..9 at Rp 1.500.000 / month
INSERT OR IGNORE INTO rooms (id, property_id, room_no, monthly_rate) VALUES
  ('room_01', 'prop_kostannisa', 1, 1500000),
  ('room_02', 'prop_kostannisa', 2, 1500000),
  ('room_03', 'prop_kostannisa', 3, 1500000),
  ('room_04', 'prop_kostannisa', 4, 1500000),
  ('room_05', 'prop_kostannisa', 5, 1500000),
  ('room_06', 'prop_kostannisa', 6, 1500000),
  ('room_07', 'prop_kostannisa', 7, 1500000),
  ('room_08', 'prop_kostannisa', 8, 1500000),
  ('room_09', 'prop_kostannisa', 9, 1500000);

-- Demo users
INSERT OR IGNORE INTO users (id, email, name, role) VALUES
  ('user_admin', 'admin@kostannisa.my.id', 'Admin Annisa', 'admin'),
  ('user_petugas', 'petugas@kostannisa.my.id', 'Petugas Annisa', 'petugas');

-- Default settings
INSERT OR IGNORE INTO settings (property_id, default_monthly_rate, default_deposit, reminder_rules, sheets_config)
VALUES (
  'prop_kostannisa',
  1500000,
  500000,
  '{"days_before_due":[3,1],"days_after_due":[1,3,7]}',
  '{"spreadsheet_id":"","income_sheet":"Income","expense_sheet":"Expenses"}'
);

-- Demo tenants (rooms 1-4 occupied)
INSERT OR IGNORE INTO tenants (id, property_id, room_id, name, wa_number, move_in_date, deposit_amount, is_active) VALUES
  ('tenant_01', 'prop_kostannisa', 'room_01', 'Andi Saputra',  '081234567890', '2023-01-15', 500000, 1),
  ('tenant_02', 'prop_kostannisa', 'room_02', 'Budi Santoso',  '081298765432', '2023-03-10', 500000, 1),
  ('tenant_03', 'prop_kostannisa', 'room_03', 'Citra Dewi',    '081311223344', '2023-06-05', 500000, 1),
  ('tenant_04', 'prop_kostannisa', 'room_04', 'Dian Anugrah',  '085612345678', '2023-09-20', 500000, 1);
