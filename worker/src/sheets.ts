/**
 * Google Sheets API helper to append income and expense rows
 * Uses a Service Account for server-to-server auth.
 */

type ServiceAccountKey = {
    client_email: string;
    private_key: string;
    token_uri: string;
};

// ── JWT for Service Account ──────────────────────

async function createJwt(sa: ServiceAccountKey): Promise<string> {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    };

    const enc = (obj: unknown) =>
        btoa(JSON.stringify(obj))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

    const unsignedToken = `${enc(header)}.${enc(claim)}`;

    // Import private key for signing
    const pemContents = sa.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\\n/g, '')
        .replace(/\s/g, '');

    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
    );

    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return `${unsignedToken}.${sig}`;
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
    const jwt = await createJwt(sa);
    const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';

    const res = await fetch(tokenUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token exchange failed: ${text}`);
    }

    const data: any = await res.json();
    return data.access_token;
}

// ── Append Row ───────────────────────────────────

async function appendRow(
    spreadsheetId: string,
    sheetName: string,
    values: string[][],
    sa: ServiceAccountKey
): Promise<void> {
    const accessToken = await getAccessToken(sa);
    const range = `${sheetName}!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sheets append failed: ${text}`);
    }
}

// ── Setup Headers & Formatting ───────────────────

async function getSheetId(spreadsheetId: string, sheetName: string, accessToken: string): Promise<number> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data: any = await res.json();
    const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
    return sheet?.properties?.sheetId ?? 0;
}

async function setupOneSheet(
    spreadsheetId: string,
    sheetName: string,
    headers: string[],
    sa: ServiceAccountKey
): Promise<void> {
    const accessToken = await getAccessToken(sa);
    const sheetId = await getSheetId(spreadsheetId, sheetName, accessToken);

    // 1. Read ALL existing data
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:Z`;
    const readRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const readData: any = await readRes.json();
    const allRows: string[][] = readData.values || [];

    // 2. Separate: remove any existing header rows (matching first header), keep data rows
    const dataRows = allRows.filter(row => row[0] && row[0] !== headers[0]);

    // 3. Clear entire sheet
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:Z:clear`;
    await fetch(clearUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: '{}',
    });

    // 4. Write headers + data back
    const allValues = [headers, ...dataRows];
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: allValues }),
    });

    // 5. Format header: bold, dark blue bg, white text, freeze row 1, auto-resize
    const formatReq = {
        requests: [
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.1, green: 0.2, blue: 0.45 },
                            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                            horizontalAlignment: 'CENTER',
                        },
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
                },
            },
            {
                updateSheetProperties: {
                    properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                    fields: 'gridProperties.frozenRowCount',
                },
            },
            {
                autoResizeDimensions: {
                    dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: headers.length },
                },
            },
        ],
    };
    await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(formatReq),
        }
    );
}

export async function setupSheetHeaders(config: SheetsConfig): Promise<void> {
    const incomeHeaders = ['Tanggal Bayar', 'Periode', 'No. Invoice', 'Nama Penghuni', 'Kamar', 'Jumlah (Rp)', 'Metode', 'Catatan', 'Dibuat Oleh'];
    const expenseHeaders = ['Tanggal', 'Jenis', 'Deskripsi', 'Jumlah (Rp)', 'Metode', 'Status', 'Dibuat Oleh', 'Catatan', 'Bukti Nota', 'Saldo'];

    await setupOneSheet(config.spreadsheet_id, config.income_sheet, incomeHeaders, config.service_account);
    await setupOneSheet(config.spreadsheet_id, config.expense_sheet, expenseHeaders, config.service_account);

    // Insert running balance formula in J2 of expense sheet
    const accessToken = await getAccessToken(config.service_account);
    const formulaRange = `${config.expense_sheet}!J2`;
    const formulaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheet_id}/values/${encodeURIComponent(formulaRange)}?valueInputOption=USER_ENTERED`;
    // SCAN formula: running cumulative sum. Pemasukan adds, Pengeluaran subtracts.
    const formula = '=ARRAYFORMULA(IF(A2:A="","",SCAN(0,IF(B2:B="Pemasukan",D2:D,-D2:D),LAMBDA(acc,val,acc+val))))';
    await fetch(formulaUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[formula]] }),
    });
}

// ── Domain functions ─────────────────────────────

export type SheetsConfig = {
    spreadsheet_id: string;
    income_sheet: string; // Actually used for "Pembayaran/Tenants"
    expense_sheet: string; // Actually used for "Kas/Cashflow"
    service_account: ServiceAccountKey;
};

// Writes to the "Rekap Penghuni" sheet (Sheet 2)
export async function appendTenantPaymentRow(
    config: SheetsConfig,
    row: {
        date_paid: string;
        period: string;
        invoice_no: string;
        tenant_name: string;
        room_no: number;
        amount: number;
        method: string;
        notes: string;
        created_by: string;
    }
): Promise<void> {
    await appendRow(config.spreadsheet_id, config.income_sheet, [
        [
            row.date_paid,
            row.period,
            row.invoice_no,
            row.tenant_name,
            String(row.room_no),
            String(row.amount),
            row.method,
            row.notes,
            row.created_by,
        ],
    ], config.service_account);
}

// Writes to the "Kas" sheet (Sheet 1) (For both Income and Expense)
export async function appendCashflowRow(
    config: SheetsConfig,
    row: {
        date: string;
        type: 'Pemasukan' | 'Pengeluaran';
        description: string;
        amount: number;
        method: string;
        status: string;
        created_by: string;
        notes: string;
        receipt_url?: string;
    }
): Promise<void> {
    await appendRow(config.spreadsheet_id, config.expense_sheet, [
        [
            row.date,
            row.type,
            row.description,
            String(row.amount),
            row.method,
            row.status,
            row.created_by,
            row.notes,
            row.receipt_url || '',
        ],
    ], config.service_account);
}
