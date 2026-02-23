/**
 * Zod validation schemas for all API inputs
 */
import { z } from 'zod';

// ── Shared ──────────────────────────────────────
const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');
const methodSchema = z.enum(['transfer', 'cash', 'other']);
const categorySchema = z.enum(['listrik', 'air', 'wifi', 'kebersihan', 'perbaikan', 'gaji', 'modal', 'lainnya']);

// ── Users ───────────────────────────────────────
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const createUserSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    password: z.string().min(6),
    role: z.enum(['admin', 'petugas']),
});

// ── Rooms ───────────────────────────────────────
export const createRoomSchema = z.object({
    room_no: z.number().int().min(1).max(99),
    monthly_rate: z.number().int().min(0),
});

export const updateRoomSchema = z.object({
    monthly_rate: z.number().int().min(0).optional(),
    is_active: z.union([z.literal(0), z.literal(1)]).optional(),
});

// ── Tenants ─────────────────────────────────────
export const createTenantSchema = z.object({
    room_id: z.string().min(1),
    name: z.string().min(1).max(100),
    wa_number: z.string().max(20).optional(),
    move_in_date: dateSchema,
    deposit_amount: z.number().int().min(0).default(0),
});

export const updateTenantSchema = z.object({
    room_id: z.string().min(1).optional(),
    name: z.string().min(1).max(100).optional(),
    wa_number: z.string().max(20).optional(),
    move_in_date: dateSchema.optional(),
    deposit_amount: z.number().int().min(0).optional(),
    is_active: z.union([z.literal(0), z.literal(1)]).optional(),
});

// ── Invoices ────────────────────────────────────
export const generateInvoicesSchema = z.object({
    period: periodSchema,
});

// ── Payments ────────────────────────────────────
export const createPaymentSchema = z.object({
    invoice_id: z.string().min(1),
    amount: z.number().int().min(1),
    method: methodSchema,
    proof_key: z.string().optional(),
    notes: z.string().max(500).optional(),
    paid_at: z.string().optional(),
});

// ── Expenses ────────────────────────────────────
export const createExpenseSchema = z.object({
    expense_date: dateSchema,
    category: categorySchema,
    amount: z.number().int().min(1),
    method: methodSchema,
    receipt_key: z.string().optional(),
    notes: z.string().max(500).optional(),
    status: z.enum(['draft', 'confirmed']).default('confirmed'),
    type: z.enum(['income', 'expense']).default('expense'),
});

export const confirmExpenseSchema = z.object({
    category: categorySchema.optional(),
    amount: z.number().int().min(1).optional(),
    method: methodSchema.optional(),
    expense_date: dateSchema.optional(),
    notes: z.string().max(500).optional(),
    type: z.enum(['income', 'expense']).optional(),
});

// ── Settings ────────────────────────────────────
export const updateSettingsSchema = z.object({
    default_monthly_rate: z.number().optional(),
    default_deposit: z.number().optional(),
    reminder_rules: z.string().optional(),
    sheets_config: z.string().optional(),
    gemini_api_key: z.string().nullable().optional(),
    groq_api_key: z.string().nullable().optional(),
    google_service_account_json: z.string().nullable().optional(),
    sheets_spreadsheet_id: z.string().nullable().optional(),
    sheets_income_sheet_name: z.string().nullable().optional(),
    sheets_expense_sheet_name: z.string().nullable().optional(),
});

// ── Uploads ─────────────────────────────────────
export const presignSchema = z.object({
    type: z.enum(['payment_proof', 'receipt']),
    period: periodSchema,
    content_type: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
});

// ── OCR ─────────────────────────────────────────
export const ocrReceiptSchema = z.object({
    receipt_key: z.string().min(1),
    expense_date: dateSchema.optional(),
});

export { periodSchema };
