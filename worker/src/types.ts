/**
 * Shared type definitions for the Worker
 */
import type { AuthUser } from './auth';

// ── Cloudflare bindings ──────────────────────────
export type Env = {
    DB: D1Database;
    R2_BUCKET: R2Bucket;
    APP_ORIGINS: string;
    PROPERTY_ID: string;
    GEMINI_API_KEY: string;
    GOOGLE_SERVICE_ACCOUNT_JSON: string;
    SHEETS_SPREADSHEET_ID: string;
    SHEETS_INCOME_SHEET_NAME: string;
    SHEETS_EXPENSE_SHEET_NAME: string;
};

// ── Hono app env type ────────────────────────────
export type AppEnv = {
    Bindings: Env;
    Variables: { user: AuthUser };
};
