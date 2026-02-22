"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { api } from "@/lib/api";

// ── Helper: attempt to parse JSON ─────────────────
function tryParseJson(str: string): { ok: boolean; error?: string } {
    if (!str.trim()) return { ok: true };
    try { JSON.parse(str); return { ok: true }; }
    catch (e: any) { return { ok: false, error: e.message }; }
}

export default function SettingsPage() {
    const queryClient = useQueryClient();

    // ── Fetch settings ────────────────────────────
    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => api.getSettingsFull(),
    });
    const settings: any = (data as any)?.settings ?? {};

    // ── Primary settings state ────────────────────
    const [rate, setRate] = useState<number | "">("");
    const [deposit, setDeposit] = useState<number | "">("");
    const [applyToRooms, setApplyToRooms] = useState(false);
    const [rateInit, setRateInit] = useState(false);

    // Lazily initialise so we don't overwrite user edits on re-render
    if (!isLoading && !rateInit) {
        setRate(settings.default_monthly_rate ?? 0);
        setDeposit(settings.default_deposit ?? 0);
        setRateInit(true);
    }

    // ── Integration state ─────────────────────────
    const [groqApiKey, setGroqApiKey] = useState("");
    const [serviceAccountJson, setServiceAccountJson] = useState("");
    const [spreadsheetId, setSpreadsheetId] = useState("");
    const [incomeSheet, setIncomeSheet] = useState("Income");
    const [expenseSheet, setExpenseSheet] = useState("Expenses");
    const [intInit, setIntInit] = useState(false);

    if (!isLoading && !intInit) {
        setGroqApiKey(settings.groq_api_key || "");
        setServiceAccountJson(settings.google_service_account_json || "");
        setSpreadsheetId(settings.sheets_spreadsheet_id || "");
        setIncomeSheet(settings.sheets_income_sheet_name || "Income");
        setExpenseSheet(settings.sheets_expense_sheet_name || "Expenses");
        setIntInit(true);
    }

    // ── Mutations ──────────────────────────────────
    const bulkRoomMutation = useMutation({
        mutationFn: (r: number) => api.bulkUpdateRoomRate(r),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
    });

    const primaryMutation = useMutation({
        mutationFn: (payload: any) => api.updateSettings(payload),
        onSuccess: async (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            if (applyToRooms && vars.default_monthly_rate) {
                try {
                    await bulkRoomMutation.mutateAsync(vars.default_monthly_rate);
                    toast.success(`Pengaturan disimpan & tarif ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(vars.default_monthly_rate)} diterapkan ke semua kamar`);
                } catch {
                    toast.warning("Pengaturan disimpan, tapi gagal update tarif kamar.");
                }
            } else {
                toast.success("Pengaturan berhasil disimpan");
            }
        },
        onError: (err: any) => toast.error(err.message || "Gagal menyimpan pengaturan"),
    });

    const aiMutation = useMutation({
        mutationFn: (payload: any) => api.updateSettings(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            toast.success("Konfigurasi AI berhasil disimpan");
        },
        onError: (err: any) => toast.error(err.message || "Gagal menyimpan konfigurasi AI"),
    });

    const sheetsMutation = useMutation({
        mutationFn: (payload: any) => api.updateSettings(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            toast.success("Konfigurasi Google Sheets berhasil disimpan");
        },
        onError: (err: any) => toast.error(err.message || "Gagal menyimpan Google Sheets"),
    });

    // ── Handlers ───────────────────────────────────
    const handleSavePrimary = () => {
        primaryMutation.mutate({
            default_monthly_rate: Number(rate) || 0,
            default_deposit: Number(deposit) || 0,
        });
    };

    const handleSaveAI = () => {
        aiMutation.mutate({
            groq_api_key: groqApiKey.trim() || null,
        });
    };

    const handleSaveSheets = () => {
        // Validate Service Account JSON before sending
        if (serviceAccountJson.trim()) {
            const check = tryParseJson(serviceAccountJson);
            if (!check.ok) {
                toast.error(`Service Account JSON tidak valid: ${check.error}`);
                return;
            }
        }

        sheetsMutation.mutate({
            google_service_account_json: serviceAccountJson.trim() || null,
            sheets_spreadsheet_id: spreadsheetId.trim() || null,
            sheets_income_sheet_name: incomeSheet.trim() || "Income",
            sheets_expense_sheet_name: expenseSheet.trim() || "Expenses",
        });
    };

    const jsonError = tryParseJson(serviceAccountJson);
    const isSavingPrimary = primaryMutation.isPending || bulkRoomMutation.isPending;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mr-3" />
                <span>Memuat pengaturan...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl pb-16 overflow-x-hidden w-full">
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Pengaturan</h2>
                <p className="text-slate-500 mt-1 sm:mt-2 text-sm">Kelola preferensi sistem Kost Annisa</p>
            </div>

            <div className="grid gap-6">

                {/* ── Default Tarif ── */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Tarif Default</CardTitle>
                        <CardDescription>
                            Nilai ini digunakan sebagai default saat menambah penyewa atau membuat tagihan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="defaultRate">Tarif Bulanan Default (Rp)</Label>
                                <Input
                                    id="defaultRate"
                                    type="number"
                                    value={rate}
                                    onChange={(e) => setRate(e.target.value === "" ? "" : Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="defaultDeposit">Deposit Default (Rp)</Label>
                                <Input
                                    id="defaultDeposit"
                                    type="number"
                                    value={deposit}
                                    onChange={(e) => setDeposit(e.target.value === "" ? "" : Number(e.target.value))}
                                />
                            </div>
                        </div>

                        {/* Apply to all rooms toggle */}
                        <div className={`flex items-start gap-3 rounded-lg p-3 border transition-colors ${applyToRooms ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
                            }`}>
                            <Switch
                                id="applyToRooms"
                                checked={applyToRooms}
                                onCheckedChange={setApplyToRooms}
                                className="mt-0.5"
                            />
                            <div>
                                <Label htmlFor="applyToRooms" className="text-sm font-medium cursor-pointer">
                                    Terapkan tarif baru ke semua kamar
                                </Label>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Jika aktif, semua kamar akan diupdate ke tarif {" "}
                                    <strong>
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(rate) || 0)}
                                    </strong> saat klik Simpan.
                                </p>
                                {applyToRooms && (
                                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-700">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Tarif individual per kamar akan ikut berubah.
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button onClick={handleSavePrimary} disabled={isSavingPrimary}>
                            {isSavingPrimary ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : primaryMutation.isSuccess ? (
                                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />
                            ) : null}
                            Simpan Pengaturan
                        </Button>
                    </CardContent>
                </Card>

                {/* ── Konfigurasi AI ── */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Kecerdasan Buatan (AI)</CardTitle>
                        <CardDescription>
                            Konfigurasi engine AI untuk mengenali foto nota (Gemini) dan chat manual (Groq).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="groqApiKey">Groq API Key</Label>
                            <Input
                                id="groqApiKey"
                                type="password"
                                placeholder="gsk_..."
                                value={groqApiKey}
                                onChange={(e) => setGroqApiKey(e.target.value)}
                            />
                            <p className="text-xs text-slate-500">Digunakan untuk scan nota (Vision) dan parse chat teks (Llama-3.3). Dapatkan di <a href="https://console.groq.com" target="_blank" className="underline text-blue-600">console.groq.com</a></p>
                        </div>

                        <Button
                            onClick={handleSaveAI}
                            disabled={aiMutation.isPending}
                            variant="outline"
                            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                            {aiMutation.isPending
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : aiMutation.isSuccess
                                    ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                                    : null}
                            Simpan API Key AI
                        </Button>
                    </CardContent>
                </Card>

                {/* ── Integrasi Google Sheets ── */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Integrasi Google Sheets</CardTitle>
                        <CardDescription>
                            Sinkronisasi data otomatis dari bot Telegram ke Spreadsheet Anda.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="spreadsheetId">Google Spreadsheet ID</Label>
                            <Input
                                id="spreadsheetId"
                                placeholder="1BxiMVs0XRYFgwnmcuQ1TkyYm8g8F..."
                                value={spreadsheetId}
                                onChange={(e) => setSpreadsheetId(e.target.value)}
                            />
                            <p className="text-xs text-slate-500">ID panjang dari URL spreadsheet Anda.</p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="incomeSheet">Nama Sheet Rekap Penghuni</Label>
                                <Input
                                    id="incomeSheet"
                                    value={incomeSheet}
                                    onChange={(e) => setIncomeSheet(e.target.value)}
                                    placeholder="Income"
                                />
                                <p className="text-xs text-slate-500">Sheet untuk rekap pembayaran sewa.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="expenseSheet">Nama Sheet Kas / Arus Kas</Label>
                                <Input
                                    id="expenseSheet"
                                    value={expenseSheet}
                                    onChange={(e) => setExpenseSheet(e.target.value)}
                                    placeholder="Expenses"
                                />
                                <p className="text-xs text-slate-500">Sheet untuk semua pemasukan &amp; pengeluaran.</p>
                            </div>
                        </div>

                        {/* Service Account JSON */}
                        <div className="space-y-2">
                            <Label htmlFor="serviceAccount">Google Service Account JSON</Label>
                            <Textarea
                                id="serviceAccount"
                                placeholder='{"type": "service_account", "project_id": "...", ...}'
                                className={`font-mono text-xs h-36 resize-none ${serviceAccountJson && !jsonError.ok ? "border-rose-400 focus-visible:ring-rose-400" : ""
                                    }`}
                                value={serviceAccountJson}
                                onChange={(e) => setServiceAccountJson(e.target.value)}
                            />
                            {serviceAccountJson && !jsonError.ok ? (
                                <p className="text-xs text-rose-600">JSON tidak valid: {jsonError.error}</p>
                            ) : (
                                <p className="text-xs text-slate-500">
                                    Kredensial service account dengan akses edit ke spreadsheet.
                                    {" "}
                                    <button
                                        type="button"
                                        className="underline text-blue-600"
                                        onClick={() => {
                                            const input = document.createElement("input");
                                            input.type = "file";
                                            input.accept = "application/json";
                                            input.onchange = (e: any) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setServiceAccountJson(ev.target?.result as string);
                                                reader.readAsText(file);
                                            };
                                            input.click();
                                        }}
                                    >
                                        Upload file .json
                                    </button>
                                </p>
                            )}
                        </div>

                        <Button
                            onClick={handleSaveSheets}
                            disabled={sheetsMutation.isPending || (!!serviceAccountJson && !jsonError.ok)}
                            variant="outline"
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                            {sheetsMutation.isPending
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : sheetsMutation.isSuccess
                                    ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                                    : null}
                            Simpan Konfigurasi Sheets
                        </Button>
                    </CardContent>
                </Card>

                {/* ── Reminder Rules (placeholder) ── */}
                <Card className="shadow-sm border-slate-200 opacity-60">
                    <CardHeader>
                        <CardTitle>
                            Reminder Rules{" "}
                            <span className="ml-2 text-xs bg-slate-200 text-slate-700 py-1 px-2 rounded font-medium">
                                Coming Soon
                            </span>
                        </CardTitle>
                        <CardDescription>Konfigurasi pengingat WhatsApp otomatis.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            disabled
                            className="font-mono text-sm h-24 bg-slate-50 resize-none"
                            value={settings.reminder_rules ?? ""}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
