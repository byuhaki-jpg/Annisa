/**
 * Kost Annisa – Cloudflare Worker API
 *
 * Hono router with D1, R2, Gemini OCR, Google Sheets integrations.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware, requireRole, hashPassword, type AuthUser, type AuthRole } from './auth';
import { sign } from 'hono/jwt';
import { sendResetPasswordEmail } from './email';
import { handleTelegramUpdate } from './telegram';
import {
    getAllRooms,
    getAllTenants,
    getInvoicesForPeriod,
    getExpensesForPeriod,
    getDashboard,
    getNextInvoiceSeq,
    getSettings,
    queryOne,
    queryAll,
    execute,
} from './db';
import { generateObjectKey, presignResponse, getObject } from './r2';
import { ocrReceipt } from './gemini';
import { appendTenantPaymentRow, appendCashflowRow, setupSheetHeaders, type SheetsConfig } from './sheets';
import { generateId, invoiceNo, currentPeriod, isValidPeriod } from './utils';
import {
    createRoomSchema,
    updateRoomSchema,
    createTenantSchema,
    updateTenantSchema,
    createPaymentSchema,
    createExpenseSchema,
    confirmExpenseSchema,
    presignSchema,
    ocrReceiptSchema,
    updateSettingsSchema,
    periodSchema,
    loginSchema,
    createUserSchema,
} from './validators';

// ── Env bindings type ────────────────────────────
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
    JWT_SECRET: string;
    RESEND_API_KEY: string;
    TELEGRAM_BOT_TOKEN: string;
    GROQ_API_KEY: string;
};

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// ── CORS ─────────────────────────────────────────
app.use(
    '/api/*',
    cors({
        origin: (origin, c) => {
            const allowed = (c.env.APP_ORIGINS || 'http://localhost:3000')
                .split(',')
                .map((s: string) => s.trim());
            if (allowed.includes(origin) || allowed.includes('*')) return origin;
            // Allow Cloudflare preview domains
            if (origin.endsWith('.pages.dev')) return origin;
            return '';
        },
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Mock-Email', 'Cf-Access-Authenticated-User-Email', 'X-Filename'],
        maxAge: 86400,
    })
);

// ── Health (no auth) ─────────────────────────────
app.get('/api/health', (c) => {
    return c.json({ ok: true, time: new Date().toISOString() });
});

// ── Login (no auth) ──────────────────────────────
app.post('/api/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input' } }, 400);
    }

    const { email, password } = parsed.data;
    const row = await queryOne<{ id: string; password_hash: string | null; role: string; is_active: number }>(
        c.env.DB,
        'SELECT id, password_hash, role, is_active FROM users WHERE email = ?',
        email
    );

    if (!row) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Email atau password salah' } }, 401);
    if (!row.is_active) return c.json({ error: { code: 'FORBIDDEN', message: 'Akun dinonaktifkan' } }, 403);

    // If password_hash is null, we can gracefully reject or allow initial setup
    if (!row.password_hash) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Password belum diatur. Hubungi Admin.' } }, 401);
    }

    const hash = await hashPassword(password);
    if (hash !== row.password_hash) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Email atau password salah' } }, 401);
    }

    // Sign JWT Token
    const payload = {
        sub: row.id,
        role: row.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days expiration
    };
    const secret = c.env.JWT_SECRET || 'fallback-secret-for-dev';
    const token = await sign(payload, secret, "HS256");

    return c.json({ token, role: row.role });
});

// ── Forgot Password (no auth) ────────────────────
app.post('/api/forgot-password', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = body.email?.trim()?.toLowerCase();
    if (!email) return c.json({ error: { code: 'VALIDATION', message: 'Email wajib diisi' } }, 400);

    const user = await queryOne<{ id: string; name: string | null; is_active: number }>(
        c.env.DB,
        'SELECT id, name, is_active FROM users WHERE email = ?',
        email
    );

    // Always return success to prevent email enumeration
    if (!user || !user.is_active) {
        return c.json({ ok: true, message: 'Jika email terdaftar, link reset sudah dikirim.' });
    }

    // Generate reset token
    const token = generateId('rst');
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    await execute(
        c.env.DB,
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        token, expires, user.id
    );

    // Build reset link — use the frontend origin
    const origins = (c.env.APP_ORIGINS || 'http://localhost:3000').split(',');
    const frontendOrigin = origins[0].trim();
    const resetLink = `${frontendOrigin}/reset-password?token=${token}`;

    const resendKey = c.env.RESEND_API_KEY || '';
    if (!resendKey) {
        console.error('RESEND_API_KEY not configured');
        return c.json({ ok: true, message: 'Jika email terdaftar, link reset sudah dikirim.' });
    }

    try {
        await sendResetPasswordEmail(resendKey, email, resetLink, user.name);
    } catch (err: any) {
        console.error('[Resend Error]', err.message);
    }

    return c.json({ ok: true, message: 'Jika email terdaftar, link reset sudah dikirim.' });
});

// ── Reset Password (no auth) ─────────────────────
app.post('/api/reset-password', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { token, password } = body;

    if (!token || !password) {
        return c.json({ error: { code: 'VALIDATION', message: 'Token dan password baru wajib diisi' } }, 400);
    }
    if (password.length < 6) {
        return c.json({ error: { code: 'VALIDATION', message: 'Password minimal 6 karakter' } }, 400);
    }

    const user = await queryOne<{ id: string; reset_token_expires: string }>(
        c.env.DB,
        'SELECT id, reset_token_expires FROM users WHERE reset_token = ? AND is_active = 1',
        token
    );

    if (!user) {
        return c.json({ error: { code: 'INVALID', message: 'Link reset tidak valid atau sudah kedaluwarsa' } }, 400);
    }

    // Check expiry
    if (new Date(user.reset_token_expires) < new Date()) {
        return c.json({ error: { code: 'EXPIRED', message: 'Link reset sudah kedaluwarsa. Silakan minta ulang.' } }, 400);
    }

    const hash = await hashPassword(password);
    await execute(
        c.env.DB,
        'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        hash, user.id
    );

    return c.json({ ok: true, message: 'Password berhasil direset. Silakan login.' });
});

// ── Telegram Bot Webhook (no auth) ───────────────
app.post('/api/telegram/webhook', async (c) => {
    const update = await c.req.json();
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    const propertyId = c.env.PROPERTY_ID || 'prop_kostannisa';

    if (!botToken) return c.json({ ok: false, error: 'Bot token not configured' });

    const settings = await getSettings(c.env.DB, propertyId);
    const sheetsConfig = getSheetsConfig(settings, c.env);

    const sheetsSync = sheetsConfig ? async (type: string, category: string, amount: number, method: string, notes: string, createdBy: string) => {
        const typeLabel = type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        await appendCashflowRow(sheetsConfig, {
            date: new Date().toISOString().slice(0, 10),
            type: typeLabel as any,
            description: `Cash: ${category} - ${notes}`,
            amount,
            method,
            status: 'confirmed',
            created_by: createdBy,
            notes,
        });
    } : undefined;

    await handleTelegramUpdate(update, {
        botToken,
        groqKey: (settings as any)?.groq_api_key || c.env.GROQ_API_KEY,
        db: c.env.DB,
        propertyId,
        sheetsSync,
    });

    return c.json({ ok: true });
});

// Setup webhook URL (call once) — moved behind auth below

// ── Auth middleware for all other /api routes ─────
app.use('/api/*', authMiddleware);

// helper
function pid(c: any): string {
    return c.env.PROPERTY_ID || 'prop_kostannisa';
}

// ── A) Identity ──────────────────────────────────
app.get('/api/me', (c) => {
    const user = c.get('user');
    return c.json({ email: user.email, role: user.role, name: user.name });
});

// ── A.1) User Management (admin_utama only) ────────
app.get('/api/users', requireRole('admin_utama'), async (c) => {
    const users = await queryAll(c.env.DB, 'SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at DESC');
    return c.json({ users });
});

app.post('/api/users', requireRole('admin_utama'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }
    const d = parsed.data;

    // Check if email exists
    const existing = await queryOne(c.env.DB, 'SELECT id FROM users WHERE email = ?', d.email);
    if (existing) return c.json({ error: { code: 'CONFLICT', message: 'Email sudah terdaftar' } }, 409);

    const id = generateId('usr');
    const hash = await hashPassword(d.password);

    await execute(
        c.env.DB,
        'INSERT INTO users (id, email, name, role, is_active, password_hash) VALUES (?, ?, ?, ?, 1, ?)',
        id, d.email, d.name || null, d.role, hash
    );

    return c.json({ id, email: d.email, name: d.name, role: d.role, is_active: 1 }, 201);
});

app.patch('/api/users/:id/deactivate', requireRole('admin_utama'), async (c) => {
    const userId = c.req.param('id');
    const target = await queryOne<{ role: string }>(c.env.DB, 'SELECT role FROM users WHERE id = ?', userId);
    if (!target) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    if (target.role === 'admin_utama') return c.json({ error: { code: 'FORBIDDEN', message: 'Cannot deactivate admin utama' } }, 403);

    await execute(c.env.DB, 'UPDATE users SET is_active = 0 WHERE id = ?', userId);
    return c.json({ ok: true });
});

app.delete('/api/users/:id', requireRole('admin_utama'), async (c) => {
    const userId = c.req.param('id');
    const target = await queryOne<{ role: string }>(c.env.DB, 'SELECT role FROM users WHERE id = ?', userId);
    if (!target) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    if (target.role === 'admin_utama') return c.json({ error: { code: 'FORBIDDEN', message: 'Cannot delete admin utama' } }, 403);

    await execute(c.env.DB, 'DELETE FROM users WHERE id = ?', userId);
    return c.json({ ok: true });
});

// ── B) Dashboard ─────────────────────────────────
app.get('/api/dashboard', async (c) => {
    const period = c.req.query('period') || currentPeriod();
    if (!isValidPeriod(period)) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid period format' } }, 400);
    }
    const data = await getDashboard(c.env.DB, pid(c), period);
    return c.json(data);
});

// ── B2) Report – Expense-only operational report ──
app.get('/api/report', async (c) => {
    const propertyId = pid(c);
    const fromParam = c.req.query('from');
    const toParam = c.req.query('to');

    // Generate period list (from..to OR last N months)
    const periods: string[] = [];
    const now = new Date();

    if (fromParam && toParam && isValidPeriod(fromParam) && isValidPeriod(toParam)) {
        const [fromY, fromM] = fromParam.split('-').map(Number);
        const [toY, toM] = toParam.split('-').map(Number);
        let y = fromY, m = fromM;
        while (y < toY || (y === toY && m <= toM)) {
            periods.push(`${y}-${String(m).padStart(2, '0')}`);
            m++;
            if (m > 12) { m = 1; y++; }
        }
    } else {
        const months = Math.min(parseInt(c.req.query('months') || '12'), 24);
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
    }

    if (periods.length === 0) return c.json({ data: [], categories: [] });
    const placeholders = periods.map(() => '?').join(',');

    // Total expense per period
    const expenseRows = await queryAll<{ period: string; total: number }>(
        c.env.DB,
        `SELECT substr(expense_date, 1, 7) AS period, COALESCE(SUM(amount), 0) AS total
         FROM expenses
         WHERE property_id = ? AND status = 'confirmed' AND type = 'expense'
           AND substr(expense_date, 1, 7) IN (${placeholders})
         GROUP BY substr(expense_date, 1, 7)`,
        propertyId, ...periods
    );

    // Expense breakdown by category (for stacked chart)
    const categoryRows = await queryAll<{ period: string; category: string; total: number }>(
        c.env.DB,
        `SELECT substr(expense_date, 1, 7) AS period, category, COALESCE(SUM(amount), 0) AS total
         FROM expenses
         WHERE property_id = ? AND status = 'confirmed' AND type = 'expense'
           AND substr(expense_date, 1, 7) IN (${placeholders})
         GROUP BY substr(expense_date, 1, 7), category
         ORDER BY substr(expense_date, 1, 7), category`,
        propertyId, ...periods
    );

    // Aggregate categories found
    const allCategories = [...new Set(categoryRows.map(r => r.category))];

    // Build period map
    const expenseMap = new Map(expenseRows.map(r => [r.period, r.total]));

    // Build nested category map: period → { category → total }
    const catMap = new Map<string, Record<string, number>>();
    for (const row of categoryRows) {
        if (!catMap.has(row.period)) catMap.set(row.period, {});
        catMap.get(row.period)![row.category] = row.total;
    }

    const data = periods.map(p => {
        const total = expenseMap.get(p) ?? 0;
        const cats = catMap.get(p) ?? {};
        return { period: p, total, ...cats };
    });

    return c.json({ data, categories: allCategories });
});


// ── C) Rooms ─────────────────────────────────────
app.get('/api/rooms', async (c) => {
    const rooms = await getAllRooms(c.env.DB, pid(c));
    return c.json({ rooms });
});

app.post('/api/rooms', requireRole('admin_utama', 'admin'), async (c) => {
    const body = await c.req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }
    const { room_no, monthly_rate } = parsed.data;
    const id = generateId('room');
    await execute(
        c.env.DB,
        `INSERT INTO rooms (id, property_id, room_no, monthly_rate) VALUES (?, ?, ?, ?)`,
        id, pid(c), room_no, monthly_rate
    );
    return c.json({ id, room_no, monthly_rate }, 201);
});

app.patch('/api/rooms/:id', requireRole('admin_utama', 'admin'), async (c) => {
    const roomId = c.req.param('id');
    const body = await c.req.json();
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (parsed.data.monthly_rate !== undefined) { sets.push('monthly_rate = ?'); vals.push(parsed.data.monthly_rate); }
    if (parsed.data.is_active !== undefined) { sets.push('is_active = ?'); vals.push(parsed.data.is_active); }
    if (sets.length === 0) return c.json({ error: { code: 'VALIDATION', message: 'Nothing to update' } }, 400);
    vals.push(roomId);
    await execute(c.env.DB, `UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`, ...vals);
    return c.json({ ok: true });
});

// ── Bulk update all rooms rate (admin only) ───────
app.post('/api/rooms/bulk-rate', requireRole('admin_utama', 'admin'), async (c) => {
    const body = await c.req.json();
    const rate = Number(body?.monthly_rate);
    if (!rate || rate <= 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'monthly_rate harus bilangan positif' } }, 400);
    }
    const result = await execute(
        c.env.DB,
        `UPDATE rooms SET monthly_rate = ? WHERE property_id = ?`,
        rate, pid(c)
    );
    return c.json({ ok: true, updated: rate });
});

// ── D) Tenants ───────────────────────────────────
app.get('/api/tenants', async (c) => {
    const tenants = await getAllTenants(c.env.DB, pid(c));
    return c.json({ tenants });
});

app.post('/api/tenants', requireRole('admin_utama', 'admin'), async (c) => {
    const body = await c.req.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }
    const id = generateId('ten');
    const d = parsed.data;
    await execute(
        c.env.DB,
        `INSERT INTO tenants (id, property_id, room_id, name, wa_number, move_in_date, deposit_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id, pid(c), d.room_id, d.name, d.wa_number || null, d.move_in_date, d.deposit_amount
    );
    return c.json({ id, ...d }, 201);
});

app.patch('/api/tenants/:id', requireRole('admin_utama', 'admin'), async (c) => {
    const tenantId = c.req.param('id');
    const body = await c.req.json();
    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    const d = parsed.data;
    if (d.room_id !== undefined) { sets.push('room_id = ?'); vals.push(d.room_id); }
    if (d.name !== undefined) { sets.push('name = ?'); vals.push(d.name); }
    if (d.wa_number !== undefined) { sets.push('wa_number = ?'); vals.push(d.wa_number); }
    if (d.move_in_date !== undefined) { sets.push('move_in_date = ?'); vals.push(d.move_in_date); }
    if (d.deposit_amount !== undefined) { sets.push('deposit_amount = ?'); vals.push(d.deposit_amount); }
    if (d.is_active !== undefined) { sets.push('is_active = ?'); vals.push(d.is_active); }
    if (sets.length === 0) return c.json({ error: { code: 'VALIDATION', message: 'Nothing to update' } }, 400);
    vals.push(tenantId);
    await execute(c.env.DB, `UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`, ...vals);
    return c.json({ ok: true });
});

app.post('/api/tenants/:id/deactivate', requireRole('admin_utama', 'admin'), async (c) => {
    const tenantId = c.req.param('id');
    const today = new Date().toISOString().slice(0, 10);
    await execute(
        c.env.DB,
        `UPDATE tenants SET is_active = 0, move_out_date = ? WHERE id = ?`,
        today, tenantId
    );
    return c.json({ ok: true, move_out_date: today });
});

app.delete('/api/tenants/:id', requireRole('admin_utama', 'admin'), async (c) => {
    const tenantId = c.req.param('id');
    const tenant = await queryOne<any>(c.env.DB, 'SELECT id FROM tenants WHERE id = ?', tenantId);
    if (!tenant) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } }, 404);
    }
    await execute(c.env.DB, 'DELETE FROM tenants WHERE id = ?', tenantId);
    return c.json({ ok: true });
});

// ── E) Invoices ──────────────────────────────────
app.get('/api/invoices', async (c) => {
    const period = c.req.query('period') || currentPeriod();
    if (!isValidPeriod(period)) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid period format' } }, 400);
    }
    const invoices = await getInvoicesForPeriod(c.env.DB, pid(c), period);
    return c.json({ period, invoices });
});

app.post('/api/invoices/generate', async (c) => {
    const period = c.req.query('period') || currentPeriod();
    if (!isValidPeriod(period)) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid period format' } }, 400);
    }

    // Get all active tenants with their rooms
    const activeTenants = await queryAll<{
        id: string;
        room_id: string;
        name: string;
        room_no: number;
        monthly_rate: number;
    }>(
        c.env.DB,
        `SELECT t.id, t.room_id, t.name, r.room_no, r.monthly_rate
     FROM tenants t JOIN rooms r ON r.id = t.room_id
     WHERE t.property_id = ? AND t.is_active = 1`,
        pid(c)
    );

    // Check existing invoices for this period
    const existing = await queryAll<{ tenant_id: string }>(
        c.env.DB,
        `SELECT tenant_id FROM invoices WHERE property_id = ? AND period = ?`,
        pid(c), period
    );
    const existingSet = new Set(existing.map((e) => e.tenant_id));

    let seq = await getNextInvoiceSeq(c.env.DB, pid(c), period);
    const created: any[] = [];

    for (const tenant of activeTenants) {
        if (existingSet.has(tenant.id)) continue;

        const id = generateId('inv');
        const invNo = invoiceNo(period, seq);
        seq++;

        await execute(
            c.env.DB,
            `INSERT INTO invoices (id, property_id, tenant_id, room_id, period, invoice_no, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            id, pid(c), tenant.id, tenant.room_id, period, invNo, tenant.monthly_rate
        );

        created.push({ id, invoice_no: invNo, tenant_name: tenant.name, room_no: tenant.room_no, amount: tenant.monthly_rate });
    }

    return c.json({ period, created_count: created.length, invoices: created }, 201);
});

// ── F) Payments ──────────────────────────────────
app.post('/api/payments', async (c) => {
    const body = await c.req.json();
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }

    const user = c.get('user');
    const d = parsed.data;
    const paidAt = d.paid_at || new Date().toISOString();

    // Verify invoice exists and is unpaid
    const invoice = await queryOne<{
        id: string; status: string; period: string; invoice_no: string;
        tenant_id: string; room_id: string; amount: number;
    }>(c.env.DB, 'SELECT * FROM invoices WHERE id = ?', d.invoice_id);

    if (!invoice) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, 404);
    }
    if (invoice.status === 'paid') {
        return c.json({ error: { code: 'CONFLICT', message: 'Invoice already paid' } }, 409);
    }

    const paymentId = generateId('pay');
    await execute(
        c.env.DB,
        `INSERT INTO payments (id, invoice_id, amount, method, proof_key, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        paymentId, d.invoice_id, d.amount, d.method, d.proof_key || null, d.notes || null, user.userId
    );

    // Mark invoice as paid
    await execute(
        c.env.DB,
        `UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?`,
        paidAt, d.invoice_id
    );

    let sheetsWarning: string | null = null;
    try {
        const settings = await getSettings(c.env.DB, pid(c));
        const sheetsConfig = getSheetsConfig(settings, c.env);
        if (sheetsConfig) {
            const tenant = await queryOne<{ name: string }>(c.env.DB, 'SELECT name FROM tenants WHERE id = ?', invoice.tenant_id);
            const room = await queryOne<{ room_no: number }>(c.env.DB, 'SELECT room_no FROM rooms WHERE id = ?', invoice.room_id);

            // 1. Rekap Penghuni Bayar (Sheet 2)
            await appendTenantPaymentRow(sheetsConfig, {
                date_paid: paidAt,
                period: invoice.period,
                invoice_no: invoice.invoice_no,
                tenant_name: tenant?.name || '',
                room_no: room?.room_no || 0,
                amount: d.amount,
                method: d.method,
                notes: d.notes || '',
                created_by: user.email,
            });

            // 2. Pemasukan Kas (Sheet 1)
            await appendCashflowRow(sheetsConfig, {
                date: paidAt,
                type: 'Pemasukan',
                description: `Pembayaran Kost: ${tenant?.name || 'Unknown'} (Kamar ${room?.room_no || '?'}) ${invoice.period}`,
                amount: d.amount,
                method: d.method,
                status: 'paid',
                notes: d.notes || '',
                created_by: user.email,
            });
        }
    } catch (err: any) {
        sheetsWarning = `Sheets sync failed: ${err.message}`;
        console.error(sheetsWarning);
    }

    return c.json({
        payment_id: paymentId,
        invoice_id: d.invoice_id,
        status: 'paid',
        paid_at: paidAt,
        ...(sheetsWarning ? { warning: sheetsWarning } : {}),
    }, 201);
});

// ── G) Expenses ──────────────────────────────────
app.get('/api/expenses', async (c) => {
    const period = c.req.query('period') || currentPeriod();
    if (!isValidPeriod(period)) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid period format' } }, 400);
    }
    const expenses = await getExpensesForPeriod(c.env.DB, pid(c), period);
    const total_expense = expenses.filter((e: any) => e.status === 'confirmed' && e.type === 'expense').reduce((s: number, e: any) => s + e.amount, 0);
    const total_income = expenses.filter((e: any) => e.status === 'confirmed' && e.type === 'income').reduce((s: number, e: any) => s + e.amount, 0);
    return c.json({ period, total_expense, total_income, expenses });
});

app.post('/api/expenses', async (c) => {
    const body = await c.req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }

    const user = c.get('user');
    const d = parsed.data;
    const id = generateId('exp');

    await execute(
        c.env.DB,
        `INSERT INTO expenses (id, property_id, expense_date, category, amount, method, receipt_key, status, notes, type, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, pid(c), d.expense_date, d.category, d.amount, d.method, d.receipt_key || null, d.status, d.notes || null, d.type, user.userId
    );

    // If confirmed immediately, sync to Sheets
    let sheetsWarning: string | null = null;
    if (d.status === 'confirmed') {
        try {
            const settings = await getSettings(c.env.DB, pid(c));
            const sheetsConfig = getSheetsConfig(settings, c.env);
            if (sheetsConfig) {
                const receiptUrl = d.receipt_key
                    ? `${new URL(c.req.url).origin}/api/uploads/${encodeURIComponent(d.receipt_key)}`
                    : undefined;
                await appendCashflowRow(sheetsConfig, {
                    date: d.expense_date,
                    type: d.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
                    description: `Cash: ${d.category} - ${d.notes || ''}`.trim(),
                    amount: d.amount,
                    method: d.method,
                    status: 'confirmed',
                    created_by: user.email,
                    notes: d.notes || '',
                    receipt_url: receiptUrl,
                });
            }
        } catch (err: any) {
            sheetsWarning = `Sheets sync failed: ${err.message}`;
            console.error(sheetsWarning);
        }
    }

    return c.json({
        id,
        ...d,
        created_by: user.userId,
        ...(sheetsWarning ? { warning: sheetsWarning } : {}),
    }, 201);
});

app.post('/api/expenses/confirm/:id', async (c) => {
    const expenseId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = confirmExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }

    const expense = await queryOne<any>(c.env.DB, 'SELECT * FROM expenses WHERE id = ?', expenseId);
    if (!expense) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Expense not found' } }, 404);
    }
    if (expense.status === 'confirmed') {
        return c.json({ error: { code: 'CONFLICT', message: 'Expense already confirmed' } }, 409);
    }

    const d = parsed.data;
    const sets: string[] = ['status = ?'];
    const vals: unknown[] = ['confirmed'];
    if (d.category !== undefined) { sets.push('category = ?'); vals.push(d.category); }
    if (d.amount !== undefined) { sets.push('amount = ?'); vals.push(d.amount); }
    if (d.method !== undefined) { sets.push('method = ?'); vals.push(d.method); }
    if (d.expense_date !== undefined) { sets.push('expense_date = ?'); vals.push(d.expense_date); }
    if (d.notes !== undefined) { sets.push('notes = ?'); vals.push(d.notes); }
    if (d.type !== undefined) { sets.push('type = ?'); vals.push(d.type); }
    vals.push(expenseId);

    await execute(c.env.DB, `UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, ...vals);

    // Sheets sync
    const user = c.get('user');
    let sheetsWarning: string | null = null;
    try {
        const settings = await getSettings(c.env.DB, pid(c));
        const sheetsConfig = getSheetsConfig(settings, c.env);
        if (sheetsConfig) {
            const updated = await queryOne<any>(c.env.DB, 'SELECT * FROM expenses WHERE id = ?', expenseId);
            if (updated) {
                const receiptUrl = updated.receipt_key
                    ? `${new URL(c.req.url).origin}/api/uploads/${encodeURIComponent(updated.receipt_key)}`
                    : undefined;
                await appendCashflowRow(sheetsConfig, {
                    date: updated.expense_date,
                    type: updated.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
                    description: `Cash: ${updated.category} - ${updated.notes || ''}`.trim(),
                    amount: updated.amount,
                    method: updated.method,
                    status: 'confirmed',
                    created_by: user.email,
                    notes: updated.notes || '',
                    receipt_url: receiptUrl,
                });
            }
        }
    } catch (err: any) {
        sheetsWarning = `Sheets sync failed: ${err.message}`;
        console.error(sheetsWarning);
    }

    return c.json({ ok: true, ...(sheetsWarning ? { warning: sheetsWarning } : {}) });
});

// ── Edit expense (admin only) ─────────────────────
app.patch('/api/expenses/:id', requireRole('admin_utama', 'admin'), async (c) => {
    const expenseId = c.req.param('id');
    const expense = await queryOne<any>(c.env.DB, 'SELECT * FROM expenses WHERE id = ?', expenseId);
    if (!expense) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Expense not found' } }, 404);
    }

    const body = await c.req.json();
    const parsed = confirmExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }
    const d = parsed.data;
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (d.category !== undefined) { sets.push('category = ?'); vals.push(d.category); }
    if (d.amount !== undefined) { sets.push('amount = ?'); vals.push(d.amount); }
    if (d.method !== undefined) { sets.push('method = ?'); vals.push(d.method); }
    if (d.expense_date !== undefined) { sets.push('expense_date = ?'); vals.push(d.expense_date); }
    if (d.notes !== undefined) { sets.push('notes = ?'); vals.push(d.notes); }
    if (d.type !== undefined) { sets.push('type = ?'); vals.push(d.type); }

    if (sets.length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'Nothing to update' } }, 400);
    }

    vals.push(expenseId);
    await execute(c.env.DB, `UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, ...vals);
    return c.json({ ok: true });
});

// ── Delete expense (admin only) ───────────────────
app.delete('/api/expenses/:id', requireRole('admin_utama', 'admin'), async (c) => {
    const expenseId = c.req.param('id');
    const expense = await queryOne<any>(c.env.DB, 'SELECT id FROM expenses WHERE id = ?', expenseId);
    if (!expense) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Expense not found' } }, 404);
    }
    await execute(c.env.DB, 'DELETE FROM expenses WHERE id = ?', expenseId);
    return c.json({ ok: true });
});

// ── H) Uploads (R2) ─────────────────────────────
app.post('/api/uploads/presign', async (c) => {
    const body = await c.req.json();
    const parsed = presignSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }

    const key = generateObjectKey({
        type: parsed.data.type,
        period: parsed.data.period,
        content_type: parsed.data.content_type,
        propertyId: pid(c),
    });

    return c.json(presignResponse(key));
});

// Serve file from R2 (GET)
app.get('/api/uploads/:key{.+}', async (c) => {
    const key = decodeURIComponent(c.req.param('key'));
    const obj = await getObject(c.env.R2_BUCKET, key);
    if (!obj) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'File not found' } }, 404);
    }
    const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';
    const body = await obj.arrayBuffer();
    return new Response(body, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
            'Cache-Control': 'private, max-age=3600',
        },
    });
});

// Actual R2 upload endpoint (frontend PUTs file here)
app.put('/api/uploads/:key{.+}', async (c) => {
    const key = c.req.param('key');
    const contentType = c.req.header('Content-Type') || 'application/octet-stream';
    const body = await c.req.arrayBuffer();

    await c.env.R2_BUCKET.put(key, body, {
        httpMetadata: { contentType },
    });

    return c.json({ object_key: key, size: body.byteLength });
});

// ── Upload via Google Apps Script (Drive) ──────────────
app.post('/api/uploads/drive', async (c) => {
    try {
        const contentType = c.req.header('Content-Type') || 'application/octet-stream';
        const rawFilename = c.req.header('X-Filename') || `nota-${Date.now()}`;
        const filename = decodeURIComponent(rawFilename);

        const body = await c.req.arrayBuffer();
        if (!body || body.byteLength === 0) {
            return c.json({ error: { code: 'VALIDATION', message: 'File kosong' } }, 400);
        }

        // Function to chunk-convert ArrayBuffer safely
        const bytes = new Uint8Array(body);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const params = new URLSearchParams();
        params.append('fileData', base64);
        params.append('mimeType', contentType);
        params.append('fileName', filename);

        const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyV0qwU2Yb1OKHWNrlus3IL0lq0JjDnyS1qfrmLtbardw0pJmWotbgwCrl-u1wzpLsBsw/exec";

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: params.toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const resultText = await response.text();
        let resultData: any = {};
        try {
            resultData = JSON.parse(resultText);
        } catch {
            throw new Error(`Apps Script invalid response: ${resultText}`);
        }

        if (resultData.status !== 'success') {
            throw new Error(resultData.message || 'Upload ke Drive gagal.');
        }

        return c.json({ url: resultData.url });

    } catch (err: any) {
        console.error('[Apps Script Error]', err?.message || err);
        return c.json({
            error: {
                code: 'DRIVE_ERROR',
                message: err?.message || 'Gagal tersambung ke layanan Drive otomatis.',
            }
        }, 500);
    }
});

// ── I) OCR (Groq Vision) ──────────────────────────
app.post('/api/ocr/receipt', async (c) => {
    const body = await c.req.json();
    const parsed = ocrReceiptSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }

    const settings = await getSettings(c.env.DB, pid(c));
    const apiKey = (settings as any)?.groq_api_key || c.env.GROQ_API_KEY;
    if (!apiKey) {
        return c.json({ error: { code: 'CONFIG', message: 'Groq API key not configured' } }, 500);
    }

    // Read image from R2
    const obj = await getObject(c.env.R2_BUCKET, parsed.data.receipt_key);
    if (!obj) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Receipt file not found in R2' } }, 404);
    }

    const imageBytes = await obj.arrayBuffer();

    // Convert to base64 for Groq Vision
    const base64 = btoa(
        new Uint8Array(imageBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const ocrPrompt = `You are an OCR assistant for an Indonesian boarding house (kost) expense tracker.
Analyze this receipt image and extract the following information as JSON:
{
  "merchant_name": "string or null",
  "transaction_date": "YYYY-MM-DD or null",
  "total_amount": number_in_rupiah_integer or null,
  "suggested_category": "one of: listrik, air, wifi, kebersihan, perbaikan, lainnya",
  "confidence": 0.0_to_1.0,
  "notes": "any additional relevant info or null"
}
Return ONLY the JSON object, no markdown formatting.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: ocrPrompt },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
                ],
            }],
            max_tokens: 1024,
            temperature: 0.1,
        }),
    });
    if (!groqRes.ok) {
        const errText = await groqRes.text();
        throw new Error(`Groq API error ${groqRes.status}: ${errText}`);
    }
    const groqData: any = await groqRes.json();
    const responseText = groqData?.choices?.[0]?.message?.content || '{}';
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let ocrParsed: any;
    try { ocrParsed = JSON.parse(cleaned); } catch { ocrParsed = {}; }

    const ocrResult = {
        merchant_name: ocrParsed.merchant_name || null,
        transaction_date: ocrParsed.transaction_date || null,
        total_amount: typeof ocrParsed.total_amount === 'number' ? ocrParsed.total_amount : null,
        suggested_category: ocrParsed.suggested_category || 'lainnya',
        confidence: typeof ocrParsed.confidence === 'number' ? ocrParsed.confidence : 0,
        notes: ocrParsed.notes || null,
        raw_json: cleaned,
    };

    // Call Groq Vision
    const ocrResultFinal = ocrResult;

    // Create draft expense
    const user = c.get('user');
    const id = generateId('exp');
    const expenseDate = parsed.data.expense_date || ocrResultFinal.transaction_date || new Date().toISOString().slice(0, 10);

    await execute(
        c.env.DB,
        `INSERT INTO expenses (id, property_id, expense_date, category, amount, method, receipt_key, status, ocr_json, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
        id,
        pid(c),
        expenseDate,
        ocrResultFinal.suggested_category || 'lainnya',
        ocrResultFinal.total_amount || 0,
        'other',
        parsed.data.receipt_key,
        ocrResultFinal.raw_json,
        ocrResultFinal.notes || `OCR confidence: ${ocrResultFinal.confidence}`,
        user.userId
    );

    return c.json({
        expense_id: id,
        status: 'draft',
        ocr: ocrResultFinal,
        expense_date: expenseDate,
        category: ocrResultFinal.suggested_category,
        amount: ocrResultFinal.total_amount,
    }, 201);
});

// ── J) Settings ──────────────────────────────────
app.get('/api/settings', async (c) => {
    const settings: any = await getSettings(c.env.DB, pid(c));
    // Strip sensitive fields before sending to client
    if (settings) {
        const { google_service_account_json, ...safe } = settings;
        // Mask API keys — only show if set or not
        if (safe.groq_api_key) safe.groq_api_key = safe.groq_api_key.slice(0, 8) + '...';
        if (safe.gemini_api_key) safe.gemini_api_key = safe.gemini_api_key.slice(0, 8) + '...';
        return c.json({ settings: { ...safe, has_service_account: !!google_service_account_json } });
    }
    return c.json({ settings });
});

// Full settings (admin only, for editing)
app.get('/api/settings/full', requireRole('admin_utama'), async (c) => {
    const settings = await getSettings(c.env.DB, pid(c));
    return c.json({ settings });
});

app.patch('/api/settings', requireRole('admin_utama', 'admin'), async (c) => {
    const body = await c.req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
    }

    const d = parsed.data;
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (d.default_monthly_rate !== undefined) { sets.push('default_monthly_rate = ?'); vals.push(d.default_monthly_rate); }
    if (d.default_deposit !== undefined) { sets.push('default_deposit = ?'); vals.push(d.default_deposit); }
    if (d.reminder_rules !== undefined) { sets.push('reminder_rules = ?'); vals.push(d.reminder_rules); }
    if (d.sheets_config !== undefined) { sets.push('sheets_config = ?'); vals.push(d.sheets_config); }
    if (d.gemini_api_key !== undefined) { sets.push('gemini_api_key = ?'); vals.push(d.gemini_api_key); }
    if (d.groq_api_key !== undefined) { sets.push('groq_api_key = ?'); vals.push(d.groq_api_key); }
    if (d.google_service_account_json !== undefined) { sets.push('google_service_account_json = ?'); vals.push(d.google_service_account_json); }
    if (d.sheets_spreadsheet_id !== undefined) { sets.push('sheets_spreadsheet_id = ?'); vals.push(d.sheets_spreadsheet_id); }
    if (d.sheets_income_sheet_name !== undefined) { sets.push('sheets_income_sheet_name = ?'); vals.push(d.sheets_income_sheet_name); }
    if (d.sheets_expense_sheet_name !== undefined) { sets.push('sheets_expense_sheet_name = ?'); vals.push(d.sheets_expense_sheet_name); }
    if (sets.length === 0) return c.json({ error: { code: 'VALIDATION', message: 'Nothing to update' } }, 400);
    vals.push(pid(c));
    await execute(c.env.DB, `UPDATE settings SET ${sets.join(', ')} WHERE property_id = ?`, ...vals);
    return c.json({ ok: true });
});

// ── Setup Sheets Headers ─────────────────────────
app.post('/api/sheets/setup-headers', requireRole('admin_utama', 'admin'), async (c) => {
    const settings = await getSettings(c.env.DB, pid(c));
    const sheetsConfig = getSheetsConfig(settings, c.env);
    if (!sheetsConfig) {
        return c.json({ error: { code: 'CONFIG', message: 'Google Sheets belum dikonfigurasi' } }, 400);
    }
    try {
        await setupSheetHeaders(sheetsConfig);
        return c.json({ ok: true, message: 'Header berhasil diterapkan ke spreadsheet' });
    } catch (err: any) {
        return c.json({ error: { code: 'SHEETS_ERROR', message: err?.message || 'Gagal setup header' } }, 500);
    }
});

// ── Cron handler (placeholder) ───────────────────
// Uncomment [triggers] in wrangler.toml to activate
app.get('/api/cron/reminders', requireRole('admin_utama', 'admin'), async (c) => {
    // This endpoint simulates what the cron would do
    const period = currentPeriod();
    const unpaid = await queryAll<{ tenant_id: string; name: string; room_no: number; amount: number }>(
        c.env.DB,
        `SELECT i.tenant_id, t.name, r.room_no, i.amount
     FROM invoices i JOIN tenants t ON t.id = i.tenant_id JOIN rooms r ON r.id = i.room_id
     WHERE i.property_id = ? AND i.period = ? AND i.status = 'unpaid'`,
        pid(c), period
    );

    console.log(`[CRON] ${unpaid.length} unpaid invoices for ${period}:`, JSON.stringify(unpaid));
    return c.json({ period, planned_reminders: unpaid.length, tenants: unpaid });
});

// ── Sheets config helper ─────────────────────────
function getSheetsConfig(settings: any, env: Env): SheetsConfig | null {
    const sa_json = settings?.google_service_account_json || env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const sp_id = settings?.sheets_spreadsheet_id || env.SHEETS_SPREADSHEET_ID;

    if (!sa_json || !sp_id) {
        return null;
    }
    try {
        const sa = JSON.parse(sa_json);
        return {
            spreadsheet_id: sp_id,
            income_sheet: settings?.sheets_income_sheet_name || env.SHEETS_INCOME_SHEET_NAME || 'Income',
            expense_sheet: settings?.sheets_expense_sheet_name || env.SHEETS_EXPENSE_SHEET_NAME || 'Expenses',
            service_account: sa,
        };
    } catch {
        return null;
    }
}

// ── Scheduled (cron) handler ─────────────────────
const scheduled: ExportedHandlerScheduledHandler<Env> = async (event, env) => {
    const period = currentPeriod();
    const unpaid = await queryAll<{ name: string; room_no: number }>(
        env.DB,
        `SELECT t.name, r.room_no
     FROM invoices i JOIN tenants t ON t.id = i.tenant_id JOIN rooms r ON r.id = i.room_id
     WHERE i.property_id = ? AND i.period = ? AND i.status = 'unpaid'`,
        env.PROPERTY_ID || 'prop_kostannisa',
        period
    );
    console.log(`[SCHEDULED] ${period}: ${unpaid.length} unpaid tenants. Reminder sending TBD.`);
};

// ── Telegram Setup (admin only, behind auth) ─────
app.post('/api/telegram/setup', requireRole('admin_utama'), async (c) => {
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return c.json({ error: 'Bot token not configured' }, 400);

    const webhookUrl = `${new URL(c.req.url).origin}/api/telegram/webhook`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json();
    return c.json({ webhook_url: webhookUrl, telegram_response: data });
});

export default {
    fetch: app.fetch,
    scheduled,
};
