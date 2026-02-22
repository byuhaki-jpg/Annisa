"use client";

import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { FileText, PlusCircle, Loader2, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658'];

export default function DashboardPage() {
    const searchParams = useSearchParams();
    const currentPeriod = searchParams.get("period") || format(new Date(), "yyyy-MM");
    const queryClient = useQueryClient();

    const { data: dashboard, isLoading, error } = useQuery({
        queryKey: ['dashboard', currentPeriod],
        queryFn: () => api.getDashboard(currentPeriod),
    });

    const generateMutation = useMutation({
        mutationFn: () => api.generateInvoices(currentPeriod),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success(`${res.created_count} tagihan berhasil dibuat`);
        },
        onError: (err: any) => {
            toast.error(err.message || "Gagal membuat tagihan");
        }
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
    };

    if (error) {
        return <div className="p-8 text-rose-500 bg-rose-50 rounded-md">Gagal memuat data: {(error as any).message}</div>;
    }

    if (isLoading || !dashboard) {
        return <div className="flex h-full items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
    }

    const {
        income_total,
        expense_total,
        expense_breakdown,
        unpaid_tenants,
        paid_tenants,
        nunggak_tenants
    } = dashboard as any;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Ringkasan</h2>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateMutation.mutate()}
                        disabled={generateMutation.isPending}
                    >
                        {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                        Buat Tagihan Bulan Ini
                    </Button>
                    <Button variant="outline" size="sm" className="hidden sm:flex" asChild>
                        <a href="/expenses">
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Tambah Pengeluaran
                        </a>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Pemasukan (Lunas)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(income_total)}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Pengeluaran (Dikonfirmasi)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600">{formatCurrency(expense_total)}</div>
                    </CardContent>
                </Card>
            </div>

            {nunggak_tenants?.length > 0 && (
                <Card className="shadow-sm border-orange-200 bg-orange-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-orange-800 flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            Penunggak Sebelumnya
                        </CardTitle>
                        <CardDescription className="text-orange-700">Terdapat penghuni dengan tagihan belum dibayar sebelum {currentPeriod}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {nunggak_tenants.map((t: any) => (
                                <div key={t.tenant_id} className="flex justify-between items-center text-sm bg-white p-3 rounded border border-orange-100">
                                    <div className="min-w-0 flex-1 mr-2">
                                        <p className="font-semibold text-slate-800 truncate">{t.name} (Kamar {t.room_no})</p>
                                        <p className="text-xs text-slate-500">Menunggak sejak {t.oldest_period}</p>
                                    </div>
                                    <span className="font-bold text-rose-600 shrink-0 text-sm">{formatCurrency(t.total_owed)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-8 md:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Rincian Pengeluaran</CardTitle>
                        <CardDescription>Komposisi pengeluaran bulan ini</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!expense_breakdown || expense_breakdown.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-slate-500 italic">Belum ada pengeluaran</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expense_breakdown}
                                        dataKey="total"
                                        nameKey="category"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {expense_breakdown.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Belum Bayar</CardTitle>
                        <CardDescription>{unpaid_tenants?.length || 0} tagihan belum dibayar untuk periode ini</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!unpaid_tenants || unpaid_tenants.length === 0 ? (
                            <div className="text-sm text-slate-500 italic py-4 text-center">Semua sudah ditagih & lunas (atau belum digenerate)</div>
                        ) : (
                            <div className="space-y-2">
                                {unpaid_tenants.map((inv: any) => (
                                    <div key={inv.invoice_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="min-w-0 flex-1 mr-2">
                                            <p className="font-medium text-slate-800 text-sm truncate">{inv.name}</p>
                                            <p className="text-xs text-slate-500">Kmr {inv.room_no}</p>
                                        </div>
                                        <span className="font-bold text-rose-600 text-sm shrink-0">
                                            {formatCurrency(inv.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {unpaid_tenants?.length > 0 && (
                            <div className="mt-4 flex justify-end">
                                <Button variant="secondary" size="sm" asChild>
                                    <a href="/invoices">Catat Pembayaran</a>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Sudah Bayar</CardTitle>
                        <CardDescription>{paid_tenants?.length || 0} tagihan lunas untuk periode ini</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!paid_tenants || paid_tenants.length === 0 ? (
                            <div className="text-sm text-slate-500 italic py-4 text-center">Belum ada pembayaran lunas</div>
                        ) : (
                            <div className="space-y-2">
                                {paid_tenants.map((inv: any) => (
                                    <div key={inv.invoice_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="min-w-0 flex-1 mr-2">
                                            <p className="font-medium text-slate-800 text-sm truncate">{inv.name}</p>
                                            <p className="text-xs text-slate-500">Kmr {inv.room_no}</p>
                                        </div>
                                        <span className="text-slate-500 text-xs shrink-0">
                                            {inv.paid_at ? format(new Date(inv.paid_at), "dd MMM, HH:mm", { locale: id }) : "-"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
