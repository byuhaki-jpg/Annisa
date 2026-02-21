export type Role = 'admin_utama' | 'admin' | 'petugas';

export type Tenant = {
    id: string;
    name: string;
    wa_number: string;
    room_no: number;
    move_in_date: string;
    deposit_amount: number;
    active: boolean;
};

export type Room = {
    id: string;
    room_no: number;
    monthly_rate: number;
    status: 'active' | 'inactive';
};

export type Invoice = {
    id: string;
    invoice_no: string;
    tenant_id: string;
    room_no: number;
    period: string; // YYYY-MM
    amount: number;
    status: 'unpaid' | 'paid';
    paid_at?: string;
    payment_method?: 'transfer' | 'cash' | 'other';
    proof_file_url?: string;
    notes?: string;
};

export type ExpenseCategory = 'listrik' | 'air' | 'wifi' | 'kebersihan' | 'perbaikan' | 'lainnya';

export type Expense = {
    id: string;
    date: string;
    category: ExpenseCategory;
    amount: number;
    method: 'transfer' | 'cash' | 'other';
    status: 'draft' | 'confirmed';
    receipt_file_url?: string;
    notes?: string;
};

export type Settings = {
    default_monthly_rate: number;
    default_deposit: number;
    reminder_rules: string;
    google_sheets_config: string;
    gemini_api_key?: string;
    google_service_account_json?: string;
    sheets_spreadsheet_id?: string;
    sheets_income_sheet_name?: string;
    sheets_expense_sheet_name?: string;
};
