-- Migration 0004: Add type to expenses table

ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';
