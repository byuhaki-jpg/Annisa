/**
 * Utility helpers: ID generation, period formatting, currency
 */

export function generateId(prefix: string = ''): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}_${ts}${rand}` : `${ts}${rand}`;
}

/** Current period as YYYY-MM */
export function currentPeriod(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/** Parse and validate YYYY-MM format */
export function isValidPeriod(p: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

/** Generate invoice number: INV-YYYYMM-NNNN */
export function invoiceNo(period: string, seq: number): string {
    const ym = period.replace('-', '');
    return `INV-${ym}-${String(seq).padStart(4, '0')}`;
}

/** File extension from content type */
export function extFromContentType(ct: string): string {
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'application/pdf': 'pdf',
    };
    return map[ct] || 'bin';
}
