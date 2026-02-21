import { Tenant, Room, Invoice, Expense, Settings } from './types';

export const mockTenants: Tenant[] = [
    { id: 't1', name: 'Andi Saputra', wa_number: '081234567890', room_no: 1, move_in_date: '2023-01-15', deposit_amount: 500000, active: true },
    { id: 't2', name: 'Budi Santoso', wa_number: '081298765432', room_no: 2, move_in_date: '2023-03-10', deposit_amount: 500000, active: true },
    { id: 't3', name: 'Citra Dewi', wa_number: '081311223344', room_no: 3, move_in_date: '2023-06-05', deposit_amount: 500000, active: true },
    { id: 't4', name: 'Dian Anugrah', wa_number: '085612345678', room_no: 4, move_in_date: '2023-09-20', deposit_amount: 500000, active: true },
];

export const mockRooms: Room[] = [
    { id: 'r1', room_no: 1, monthly_rate: 1500000, status: 'active' },
    { id: 'r2', room_no: 2, monthly_rate: 1500000, status: 'active' },
    { id: 'r3', room_no: 3, monthly_rate: 1500000, status: 'active' },
    { id: 'r4', room_no: 4, monthly_rate: 1500000, status: 'active' },
    { id: 'r5', room_no: 5, monthly_rate: 1500000, status: 'active' },
    { id: 'r6', room_no: 6, monthly_rate: 1500000, status: 'active' },
    { id: 'r7', room_no: 7, monthly_rate: 1500000, status: 'active' },
    { id: 'r8', room_no: 8, monthly_rate: 1500000, status: 'active' },
    { id: 'r9', room_no: 9, monthly_rate: 1500000, status: 'active' },
];

export const mockInvoices: Invoice[] = [
    { id: 'i1', invoice_no: 'INV-202310-01', tenant_id: 't1', room_no: 1, period: '2023-10', amount: 1500000, status: 'paid', paid_at: '2023-10-05T10:00:00Z', payment_method: 'transfer' },
    { id: 'i2', invoice_no: 'INV-202310-02', tenant_id: 't2', room_no: 2, period: '2023-10', amount: 1500000, status: 'paid', paid_at: '2023-10-03T14:30:00Z', payment_method: 'cash' },
    { id: 'i3', invoice_no: 'INV-202310-03', tenant_id: 't3', room_no: 3, period: '2023-10', amount: 1500000, status: 'unpaid' },
    { id: 'i4', invoice_no: 'INV-202310-04', tenant_id: 't4', room_no: 4, period: '2023-10', amount: 1500000, status: 'unpaid' },
];

export const mockExpenses: Expense[] = [
    { id: 'e1', date: '2023-10-10', category: 'listrik', amount: 350000, method: 'transfer', status: 'confirmed' },
    { id: 'e2', date: '2023-10-15', category: 'air', amount: 150000, method: 'cash', status: 'confirmed' },
    { id: 'e3', date: '2023-10-20', category: 'kebersihan', amount: 100000, method: 'cash', status: 'draft' },
];

export const mockSettings: Settings = {
    default_monthly_rate: 1500000,
    default_deposit: 500000,
    reminder_rules: '{\n  "days_before_due": [3, 1],\n  "days_after_due": [1, 3, 7]\n}',
    google_sheets_config: '{\n  "spreadsheet_id": "1BxiMVs0XRYFgwnmcuQ1TkyYm8g8F...",\n  "sheet_names": {\n    "tenants": "Data_Tenants",\n    "invoices": "Data_Invoices"\n  }\n}',
    gemini_api_key: "",
    google_service_account_json: "",
    sheets_spreadsheet_id: "",
    sheets_income_sheet_name: "Income",
    sheets_expense_sheet_name: "Expenses",
};
