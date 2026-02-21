"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Tenant, Room, Invoice, Expense, Settings, Role } from './types';
import { mockTenants, mockRooms, mockInvoices, mockExpenses, mockSettings } from './mock-data';

type AppContextType = {
    role: Role;
    setRole: (role: Role) => void;
    tenants: Tenant[];
    addTenant: (tenant: Omit<Tenant, 'id'>) => void;
    updateTenant: (id: string, tenant: Partial<Tenant>) => void;
    deleteTenant: (id: string) => void;
    rooms: Room[];
    invoices: Invoice[];
    markInvoicePaid: (id: string, payload: Partial<Invoice>) => void;
    addInvoice: (invoice: Omit<Invoice, 'id'>) => void;
    updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
    expenses: Expense[];
    addExpense: (expense: Omit<Expense, 'id'>) => void;
    updateExpense: (id: string, expense: Partial<Expense>) => void;
    confirmExpense: (id: string) => void;
    deleteExpense: (id: string) => void;
    settings: Settings;
    updateSettings: (settings: Partial<Settings>) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<Role>('admin');
    const [tenants, setTenants] = useState<Tenant[]>(mockTenants);
    const [rooms, setRooms] = useState<Room[]>(mockRooms);
    const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
    const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);
    const [settings, setSettings] = useState<Settings>(mockSettings);

    const addTenant = (tenant: Omit<Tenant, 'id'>) => {
        setTenants([...tenants, { ...tenant, id: `t${Date.now()}` }]);
    };

    const updateTenant = (id: string, updatedFields: Partial<Tenant>) => {
        setTenants(tenants.map(t => t.id === id ? { ...t, ...updatedFields } : t));
    };

    const deleteTenant = (id: string) => {
        setTenants(tenants.filter(t => t.id !== id));
    };

    const markInvoicePaid = (id: string, payload: Partial<Invoice>) => {
        setInvoices(invoices.map(i => i.id === id ? { ...i, status: 'paid', ...payload } : i));
    };

    const addInvoice = (invoice: Omit<Invoice, 'id'>) => {
        setInvoices([...invoices, { ...invoice, id: `i${Date.now()}` }]);
    };

    const updateInvoice = (id: string, updatedFields: Partial<Invoice>) => {
        setInvoices(invoices.map(i => i.id === id ? { ...i, ...updatedFields } : i));
    };

    const addExpense = (expense: Omit<Expense, 'id'>) => {
        setExpenses([...expenses, { ...expense, id: `e${Date.now()}` }]);
    };

    const updateExpense = (id: string, updatedFields: Partial<Expense>) => {
        setExpenses(expenses.map(e => e.id === id ? { ...e, ...updatedFields } : e));
    };

    const confirmExpense = (id: string) => {
        setExpenses(expenses.map(e => e.id === id ? { ...e, status: 'confirmed' } : e));
    };

    const deleteExpense = (id: string) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    const updateSettings = (newSettings: Partial<Settings>) => {
        setSettings({ ...settings, ...newSettings });
    };

    return (
        <AppContext.Provider value={{
            role, setRole,
            tenants, addTenant, updateTenant, deleteTenant,
            rooms,
            invoices, markInvoicePaid, addInvoice, updateInvoice,
            expenses, addExpense, updateExpense, confirmExpense, deleteExpense,
            settings, updateSettings
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppStore() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppStore must be used within an AppProvider');
    }
    return context;
}
