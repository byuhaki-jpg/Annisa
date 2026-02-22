/**
 * API client for Kost Annisa Worker API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';

export class ApiError extends Error {
    constructor(public status: number, public data: any) {
        super(data?.error?.message || 'An API error occurred');
        this.name = 'ApiError';
    }
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });

    if (!response.ok) {
        if (response.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            // Prevent redirect loop if already on login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        const data = await response.json().catch(() => null);
        throw new ApiError(response.status, data);
    }

    return response.json() as Promise<T>;
}

export const api = {
    // Auth & Identity
    login: (data: any) => fetchApi('/login', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (email: string) => fetchApi('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, password: string) => fetchApi('/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    getMe: () => fetchApi('/me'),

    // Users (admin_utama)
    getUsers: () => fetchApi('/users'),
    createUser: (data: any) => fetchApi('/users', { method: 'POST', body: JSON.stringify(data) }),
    deactivateUser: (id: string) => fetchApi(`/users/${id}/deactivate`, { method: 'PATCH' }),
    deleteUser: (id: string) => fetchApi(`/users/${id}`, { method: 'DELETE' }),

    // Dashboard
    getDashboard: (period: string) => fetchApi(`/dashboard?period=${period}`),

    // Rooms
    getRooms: () => fetchApi('/rooms'),
    createRoom: (data: any) => fetchApi('/rooms', { method: 'POST', body: JSON.stringify(data) }),
    updateRoom: (id: string, data: any) => fetchApi(`/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    bulkUpdateRoomRate: (monthly_rate: number) =>
        fetchApi('/rooms/bulk-rate', { method: 'POST', body: JSON.stringify({ monthly_rate }) }),

    // Tenants
    getTenants: () => fetchApi('/tenants'),
    createTenant: (data: any) => fetchApi('/tenants', { method: 'POST', body: JSON.stringify(data) }),
    updateTenant: (id: string, data: any) => fetchApi(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deactivateTenant: (id: string) => fetchApi(`/tenants/${id}/deactivate`, { method: 'POST' }),
    deleteTenant: (id: string) => fetchApi(`/tenants/${id}`, { method: 'DELETE' }),

    // Invoices
    getInvoices: (period: string) => fetchApi(`/invoices?period=${period}`),
    generateInvoices: (period: string) => fetchApi(`/invoices/generate?period=${period}`, { method: 'POST' }),

    // Payments
    createPayment: (data: any) => fetchApi('/payments', { method: 'POST', body: JSON.stringify(data) }),

    // Expenses
    getExpenses: (period: string) => fetchApi(`/expenses?period=${period}`),
    createExpense: (data: any) => fetchApi('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    updateExpense: (id: string, data: any) => fetchApi(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteExpense: (id: string) => fetchApi(`/expenses/${id}`, { method: 'DELETE' }),
    confirmExpense: (id: string, data: any = {}) => fetchApi(`/expenses/confirm/${id}`, { method: 'POST', body: JSON.stringify(data) }),

    // Settings
    getSettings: () => fetchApi('/settings'),
    getSettingsFull: () => fetchApi('/settings/full'),
    updateSettings: (data: any) => fetchApi('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

    // Report (multi-period)
    getReport: (params?: { months?: number; from?: string; to?: string }) => {
        const qs = new URLSearchParams();
        if (params?.from && params?.to) {
            qs.set('from', params.from);
            qs.set('to', params.to);
        } else if (params?.months) {
            qs.set('months', String(params.months));
        }
        return fetchApi(`/report?${qs.toString()}`);
    },

    // Uploads (R2)
    /**
     * Step 1: Get a presigned key + upload_url for a receipt file.
     */
    presignReceipt: (period: string, contentType: string) =>
        fetchApi('/uploads/presign', {
            method: 'POST',
            body: JSON.stringify({ type: 'receipt', period, content_type: contentType }),
        }) as Promise<{ object_key: string; upload_url: string; method: string }>,

    /**
     * Step 2: PUT the actual file to the worker upload endpoint.
     */
    uploadFile: async (uploadUrl: string, file: File): Promise<void> => {
        const workerOrigin = API_BASE_URL.replace(/\/api$/, '');
        const fullUrl = uploadUrl.startsWith('http')
            ? uploadUrl
            : `${workerOrigin}${uploadUrl}`;
        const headers: Record<string, string> = {
            'Content-Type': file.type,
        };
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('auth_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }
        const res = await fetch(fullUrl, {
            method: 'PUT',
            headers,
            body: file,
        });
        if (!res.ok) {
            const msg = await res.text().catch(() => 'Upload gagal');
            throw new Error(msg);
        }
    },

    scanNotaAI: async (file: File): Promise<{ type: string; category: string; amount: number; notes: string }> => {
        const formData = new FormData();
        formData.append('file', file);

        let token = '';
        if (typeof window !== 'undefined') {
            token = localStorage.getItem('auth_token') || '';
        }

        const res = await fetch(`${API_BASE_URL}/expenses/scan-ai`, {
            method: 'POST',
            body: formData,
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Gagal scan nota AI' }));
            throw new Error(err.error || 'Terjadi kesalahan sistem');
        }
        return res.json();
    },

    /**
     * Upload file to Google Drive via the worker's Apps Script proxy.
     * Returns the shareable Google Drive URL.
     */
    uploadToDrive: async (file: File): Promise<{ url: string }> => {
        const workerOrigin = API_BASE_URL.replace(/\/api$/, '');
        const headers: Record<string, string> = {
            'Content-Type': file.type,
            'X-Filename': encodeURIComponent(file.name),
        };
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('auth_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }
        const res = await fetch(`${workerOrigin}/api/uploads/drive`, {
            method: 'POST',
            headers,
            body: file,
        });
        if (!res.ok) {
            const data = await res.json().catch(() => null) as any;
            throw new Error(data?.error?.message || 'Upload ke Google Drive gagal');
        }
        return res.json() as Promise<{ url: string }>;
    },

    /**
     * Build the URL to view a stored receipt.
     * If using Drive, it's already a full URL. Else, build R2 URL.
     */
    getReceiptUrl: (objectKey: string) =>
        objectKey.startsWith('https://')
            ? objectKey
            : `${API_BASE_URL}/uploads/${encodeURIComponent(objectKey)}`,
};
