-- Migration 0003: Add due_date to invoices
-- ─────────────────────────────────────────────────────────

ALTER TABLE invoices ADD COLUMN due_date TEXT;

-- Backfill existing invoices: calculate due_date from tenant's move_in_date
-- due_date = day of move_in_date applied to the invoice period month
UPDATE invoices
SET due_date = (
    SELECT
        CASE
            -- If move_in day > last day of period month, use last day
            WHEN CAST(strftime('%d', t.move_in_date) AS INTEGER) > CAST(strftime('%d', i_period_last.last_day) AS INTEGER)
            THEN i_period_last.last_day
            ELSE substr(invoices.period, 1, 4) || '-' || substr(invoices.period, 6, 2) || '-' || substr('00' || strftime('%d', t.move_in_date), -2)
        END
    FROM tenants t,
         (SELECT date(invoices.period || '-01', '+1 month', '-1 day') AS last_day) AS i_period_last
    WHERE t.id = invoices.tenant_id
)
WHERE due_date IS NULL;
