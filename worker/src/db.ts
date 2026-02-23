/**
 * D1 database helpers – thin wrappers around parameterized queries
 */

export type D1Database = import('@cloudflare/workers-types').D1Database;

// ── Generic helpers ──────────────────────────────

export async function queryAll<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
    const stmt = db.prepare(sql).bind(...params);
    const { results } = await stmt.all<T>();
    return results ?? [];
}

export async function queryOne<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
    const stmt = db.prepare(sql).bind(...params);
    return (await stmt.first<T>()) ?? null;
}

export async function execute(db: D1Database, sql: string, ...params: unknown[]) {
    return db.prepare(sql).bind(...params).run();
}

// ── Domain-specific queries ──────────────────────

export async function getAllRooms(db: D1Database, propertyId: string) {
    return queryAll(
        db,
        `SELECT r.*, t.name AS tenant_name, t.id AS tenant_id
     FROM rooms r
     LEFT JOIN tenants t ON t.room_id = r.id AND t.is_active = 1
     WHERE r.property_id = ?
     ORDER BY r.room_no`,
        propertyId
    );
}

export async function getAllTenants(db: D1Database, propertyId: string) {
    return queryAll(
        db,
        `SELECT t.*, r.room_no
     FROM tenants t
     JOIN rooms r ON r.id = t.room_id
     WHERE t.property_id = ?
     ORDER BY t.name`,
        propertyId
    );
}

export async function getInvoicesForPeriod(db: D1Database, propertyId: string, period: string) {
    return queryAll(
        db,
        `SELECT i.*, t.name AS tenant_name, t.move_in_date, r.room_no
     FROM invoices i
     JOIN tenants t ON t.id = i.tenant_id
     JOIN rooms r ON r.id = i.room_id
     WHERE i.property_id = ? AND i.period = ?
     ORDER BY r.room_no`,
        propertyId,
        period
    );
}

export async function getExpensesForPeriod(db: D1Database, propertyId: string, period: string) {
    return queryAll(
        db,
        `SELECT * FROM expenses
     WHERE property_id = ? AND expense_date LIKE ?
     ORDER BY expense_date DESC`,
        propertyId,
        `${period}%`
    );
}

export async function getExpensesForDateRange(db: D1Database, propertyId: string, startDate: string, endDate: string) {
    return queryAll(
        db,
        `SELECT * FROM expenses
     WHERE property_id = ? AND expense_date >= ? AND expense_date <= ?
     ORDER BY expense_date DESC`,
        propertyId,
        startDate,
        endDate
    );
}

export async function getDashboard(db: D1Database, propertyId: string, period: string) {
    // Total kas income for period (from expenses table, type='income')
    const income = await queryOne<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
     WHERE property_id = ? AND expense_date LIKE ? AND status = 'confirmed' AND type = 'income'`,
        propertyId,
        `${period}%`
    );

    // Total confirmed expenses for period
    const expense = await queryOne<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
     WHERE property_id = ? AND expense_date LIKE ? AND status = 'confirmed' AND type = 'expense'`,
        propertyId,
        `${period}%`
    );

    // Unpaid invoices for the period
    const unpaid = await queryAll<{
        tenant_id: string;
        name: string;
        room_no: number;
        invoice_id: string;
        amount: number;
    }>(
        db,
        `SELECT i.tenant_id, t.name, r.room_no, i.id AS invoice_id, i.amount
     FROM invoices i
     JOIN tenants t ON t.id = i.tenant_id
     JOIN rooms r ON r.id = i.room_id
     WHERE i.property_id = ? AND i.period = ? AND i.status = 'unpaid'
     ORDER BY r.room_no`,
        propertyId,
        period
    );

    // Paid invoices for the period
    const paid = await queryAll<{
        tenant_id: string;
        name: string;
        room_no: number;
        invoice_id: string;
        paid_at: string;
        amount: number;
    }>(
        db,
        `SELECT i.tenant_id, t.name, r.room_no, i.id AS invoice_id, i.paid_at, i.amount
     FROM invoices i
     JOIN tenants t ON t.id = i.tenant_id
     JOIN rooms r ON r.id = i.room_id
     WHERE i.property_id = ? AND i.period = ? AND i.status = 'paid'
     ORDER BY r.room_no`,
        propertyId,
        period
    );

    // Nunggak – tenants with any unpaid invoice in periods BEFORE the selected period
    const nunggak = await queryAll<{
        tenant_id: string;
        name: string;
        room_no: number;
        oldest_period: string;
        total_owed: number;
    }>(
        db,
        `SELECT i.tenant_id, t.name, r.room_no,
            MIN(i.period) AS oldest_period,
            SUM(i.amount) AS total_owed
     FROM invoices i
     JOIN tenants t ON t.id = i.tenant_id
     JOIN rooms r ON r.id = i.room_id
     WHERE i.property_id = ? AND i.period < ? AND i.status = 'unpaid'
     GROUP BY i.tenant_id
     ORDER BY oldest_period`,
        propertyId,
        period
    );

    // Expense breakdown by category
    const expenseBreakdown = await queryAll<{
        category: string;
        total: number;
    }>(
        db,
        `SELECT category, SUM(amount) AS total
     FROM expenses
     WHERE property_id = ? AND expense_date LIKE ? AND status = 'confirmed' AND type = 'expense'
     GROUP BY category
     ORDER BY total DESC`,
        propertyId,
        `${period}%`
    );

    return {
        period,
        income_total: income?.total ?? 0,
        expense_total: expense?.total ?? 0,
        net_total: (income?.total ?? 0) - (expense?.total ?? 0),
        expense_breakdown: expenseBreakdown,
        unpaid_tenants: unpaid,
        paid_tenants: paid,
        nunggak_tenants: nunggak,
    };
}

export async function getNextInvoiceSeq(db: D1Database, propertyId: string, period: string): Promise<number> {
    const row = await queryOne<{ cnt: number }>(
        db,
        `SELECT COUNT(*) AS cnt FROM invoices WHERE property_id = ? AND period = ?`,
        propertyId,
        period
    );
    return (row?.cnt ?? 0) + 1;
}

export async function getSettings(db: D1Database, propertyId: string) {
    return queryOne(db, 'SELECT * FROM settings WHERE property_id = ?', propertyId);
}
