"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    ReferenceLine,
    Cell,
} from "recharts";
import { format, parse, subMonths } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Loader2, TrendingDown, CalendarDays, ReceiptText } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// ── Constants ─────────────────────────────────────

const fmt = (dt: Date) => format(dt, "yyyy-MM");

const PRESETS = [
    { label: "3 Bulan", from: () => fmt(subMonths(new Date(), 2)), to: () => fmt(new Date()) },
    { label: "6 Bulan", from: () => fmt(subMonths(new Date(), 5)), to: () => fmt(new Date()) },
    { label: "12 Bulan", from: () => fmt(subMonths(new Date(), 11)), to: () => fmt(new Date()) },
    { label: "24 Bulan", from: () => fmt(subMonths(new Date(), 23)), to: () => fmt(new Date()) },
];

// Colour palette for expense categories
const CATEGORY_COLORS: Record<string, string> = {
    listrik: "#f59e0b",   // amber
    air: "#3b82f6",   // blue
    wifi: "#8b5cf6",   // violet
    kebersihan: "#10b981",   // emerald
    perbaikan: "#ef4444",   // red
    lainnya: "#6b7280",   // gray
};

const CATEGORY_LABELS: Record<string, string> = {
    listrik: "Listrik",
    air: "Air",
    wifi: "WiFi / Internet",
    kebersihan: "Kebersihan",
    perbaikan: "Perbaikan",
    lainnya: "Lainnya",
};

// ── Helpers ────────────────────────────────────────

const formatRp = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const formatRpShort = (val: number) => {
    if (Math.abs(val) >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}Jt`;
    if (Math.abs(val) >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}Rb`;
    return `Rp ${val}`;
};

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const period: string = payload[0]?.payload?.period;
    if (!period) return null;
    const date = parse(period, "yyyy-MM", new Date());
    const periodLabel = format(date, "MMMM yyyy", { locale: idLocale });
    const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-4 min-w-[210px]">
            <p className="font-semibold text-slate-700 mb-2 text-sm">{periodLabel}</p>
            {payload.filter((p: any) => p.value > 0).map((p: any) => (
                <div key={p.dataKey} className="flex justify-between gap-4 text-xs mb-1">
                    <span style={{ color: p.fill || p.color }} className="font-medium">
                        {CATEGORY_LABELS[p.dataKey] ?? p.dataKey}
                    </span>
                    <span className="font-semibold text-slate-700">{formatRp(p.value)}</span>
                </div>
            ))}
            {payload.length > 1 && (
                <div className="border-t mt-2 pt-2 flex justify-between text-xs font-bold text-slate-800">
                    <span>Total</span>
                    <span>{formatRp(total)}</span>
                </div>
            )}
        </div>
    );
};

const SimpleTotalTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const period: string = payload[0]?.payload?.period;
    if (!period) return null;
    const date = parse(period, "yyyy-MM", new Date());
    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 min-w-[180px]">
            <p className="font-semibold text-slate-700 mb-1 text-sm">
                {format(date, "MMMM yyyy", { locale: idLocale })}
            </p>
            <div className="flex justify-between gap-4 text-sm">
                <span className="text-rose-600 font-medium">Total Pengeluaran</span>
                <span className="font-bold text-slate-800">{formatRp(payload[0].value)}</span>
            </div>
        </div>
    );
};

// ── Page ───────────────────────────────────────────

export default function ReportPage() {
    const now = new Date();
    const [from, setFrom] = useState(fmt(subMonths(now, 5)));
    const [to, setTo] = useState(fmt(now));
    const [activePreset, setActivePreset] = useState("6 Bulan");

    const selectPreset = (preset: typeof PRESETS[0]) => {
        setFrom(preset.from());
        setTo(preset.to());
        setActivePreset(preset.label);
    };

    const handleFromChange = (val: string) => { setFrom(val); setActivePreset("Kustom"); };
    const handleToChange = (val: string) => { setTo(val >= from ? val : from); setActivePreset("Kustom"); };

    const { data, isLoading } = useQuery({
        queryKey: ["report", from, to],
        queryFn: () => api.getReport({ from, to }),
        enabled: !!from && !!to,
    });

    const rawData = (data as any)?.data || [];
    const allCategories: string[] = (data as any)?.categories || [];

    const chartData = useMemo(() =>
        rawData.map((row: any) => ({
            ...row,
            label: format(parse(row.period, "yyyy-MM", new Date()), "MMM yy", { locale: idLocale }),
        })),
        [rawData]);

    const totalExpense = chartData.reduce((s: number, r: any) => s + r.total, 0);
    const avgExpense = chartData.length > 0 ? totalExpense / chartData.length : 0;
    const maxMonth = [...chartData].sort((a: any, b: any) => b.total - a.total)[0];
    const minMonth = [...chartData].filter((r: any) => r.total > 0).sort((a: any, b: any) => a.total - b.total)[0];

    // Category totals for summary
    const catTotals: Record<string, number> = {};
    for (const row of rawData) {
        for (const cat of allCategories) {
            catTotals[cat] = (catTotals[cat] ?? 0) + (row[cat] ?? 0);
        }
    }

    const fromLabel = from ? format(parse(from, "yyyy-MM", new Date()), "MMMM yyyy", { locale: idLocale }) : "";
    const toLabel = to ? format(parse(to, "yyyy-MM", new Date()), "MMMM yyyy", { locale: idLocale }) : "";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">

            {/* Header */}
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Laporan Pengeluaran</h2>
                <p className="text-slate-500 mt-1 text-sm">Biaya operasional kost (listrik, air, wifi, dll) per periode</p>
            </div>

            {/* Filter Panel */}
            <Card className="border-slate-200">
                <CardContent className="pt-5 pb-5">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-slate-500 uppercase tracking-wider font-medium">Preset Cepat</Label>
                            <div className="flex gap-2 flex-wrap">
                                {PRESETS.map((p) => (
                                    <Button
                                        key={p.label}
                                        variant={activePreset === p.label ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => selectPreset(p)}
                                    >
                                        {p.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="hidden sm:block w-px self-stretch bg-slate-200 mx-1" />

                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" /> Rentang Kustom
                            </Label>
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-1">
                                    <Label htmlFor="from-period" className="text-xs text-slate-400">Dari</Label>
                                    <Input id="from-period" type="month" value={from} max={to}
                                        onChange={(e) => handleFromChange(e.target.value)} className="w-40 text-sm" />
                                </div>
                                <span className="text-slate-400 mt-5">→</span>
                                <div className="flex flex-col gap-1">
                                    <Label htmlFor="to-period" className="text-xs text-slate-400">Sampai</Label>
                                    <Input id="to-period" type="month" value={to} min={from} max={fmt(now)}
                                        onChange={(e) => handleToChange(e.target.value)} className="w-40 text-sm" />
                                </div>
                            </div>
                        </div>

                        {from && to && (
                            <div className="mt-auto">
                                <span className="inline-flex items-center gap-1.5 text-xs bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full font-medium">
                                    <ReceiptText className="w-3.5 h-3.5" />
                                    {fromLabel} — {toLabel} ({chartData.length} bulan)
                                </span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-rose-100 bg-rose-50/50">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-rose-100">
                                <TrendingDown className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-rose-700 uppercase tracking-wider">Total Pengeluaran</p>
                                <p className="text-2xl font-bold text-rose-700">{formatRpShort(totalExpense)}</p>
                                <p className="text-xs text-rose-600">{chartData.length} bulan dipilih</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-amber-100 bg-amber-50/50">
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-100">
                                <ReceiptText className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Rata-rata / Bulan</p>
                                <p className="text-2xl font-bold text-amber-700">{formatRpShort(avgExpense)}</p>
                                <p className="text-xs text-amber-600">per bulan</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200">
                    <CardContent className="pt-6 pb-4">
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bulan Tertinggi vs Terendah</p>
                            {maxMonth && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">
                                        {format(parse(maxMonth.period, "yyyy-MM", new Date()), "MMM yyyy", { locale: idLocale })}
                                        <span className="ml-1 text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">max</span>
                                    </span>
                                    <span className="font-bold text-rose-700">{formatRpShort(maxMonth.total)}</span>
                                </div>
                            )}
                            {minMonth && minMonth.period !== maxMonth?.period && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">
                                        {format(parse(minMonth.period, "yyyy-MM", new Date()), "MMM yyyy", { locale: idLocale })}
                                        <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">min</span>
                                    </span>
                                    <span className="font-bold text-emerald-700">{formatRpShort(minMonth.total)}</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-24 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mr-3" />
                    <span>Memuat data laporan...</span>
                </div>
            ) : chartData.length === 0 ? (
                <div className="text-center py-16 text-slate-400 border rounded-lg bg-white border-dashed">
                    <ReceiptText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Tidak ada data pengeluaran untuk rentang periode yang dipilih.</p>
                </div>
            ) : (
                <>
                    {/* Stacked Bar Chart per Category */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Pengeluaran per Kategori</CardTitle>
                            <CardDescription>Breakdown biaya operasional per bulan — {fromLabel} hingga {toLabel}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={380}>
                                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false}
                                        axisLine={{ stroke: "#e2e8f0" }} interval={0}
                                        angle={chartData.length > 6 ? -45 : 0}
                                        textAnchor={chartData.length > 6 ? "end" : "middle"}
                                        height={50} />
                                    <YAxis tickFormatter={formatRpShort} tick={{ fontSize: 10, fill: "#64748b" }}
                                        tickLine={false} axisLine={false} width={60} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                                        formatter={(val) => CATEGORY_LABELS[val] ?? val}
                                    />
                                    {allCategories.map((cat) => (
                                        <Bar key={cat} dataKey={cat} name={cat}
                                            fill={CATEGORY_COLORS[cat] ?? "#94a3b8"}
                                            stackId="a"
                                            radius={allCategories.indexOf(cat) === allCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                            maxBarSize={48}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Category summary pie-style horizontal bars */}
                    {allCategories.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Proporsi per Kategori</CardTitle>
                                <CardDescription>Total pengeluaran per jenis biaya selama {chartData.length} bulan</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {allCategories
                                    .map(cat => ({ cat, total: catTotals[cat] ?? 0 }))
                                    .sort((a, b) => b.total - a.total)
                                    .map(({ cat, total }) => {
                                        const pct = totalExpense > 0 ? (total / totalExpense) * 100 : 0;
                                        return (
                                            <div key={cat}>
                                                <div className="flex justify-between mb-1 text-sm">
                                                    <span className="font-medium text-slate-700">{CATEGORY_LABELS[cat] ?? cat}</span>
                                                    <span className="text-slate-500">{formatRp(total)} <span className="text-slate-400">({pct.toFixed(1)}%)</span></span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-2 rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] ?? "#94a3b8" }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </CardContent>
                        </Card>
                    )}

                    {/* Line Chart Trend */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Tren Total Pengeluaran</CardTitle>
                            <CardDescription>Perkembangan total biaya operasional tiap bulan</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false}
                                        axisLine={{ stroke: "#e2e8f0" }} interval={0}
                                        angle={chartData.length > 6 ? -45 : 0}
                                        textAnchor={chartData.length > 6 ? "end" : "middle"}
                                        height={50} />
                                    <YAxis tickFormatter={formatRpShort} tick={{ fontSize: 10, fill: "#64748b" }}
                                        tickLine={false} axisLine={false} width={60} />
                                    <Tooltip content={<SimpleTotalTooltip />} />
                                    <ReferenceLine y={avgExpense} stroke="#fbbf24" strokeDasharray="4 4"
                                        label={{ value: "Rata-rata", position: "right", fontSize: 10, fill: "#d97706" }} />
                                    <Line type="monotone" dataKey="total" name="Total Pengeluaran"
                                        stroke="#f43f5e" strokeWidth={2.5}
                                        dot={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            return (
                                                <circle key={payload.period} cx={cx} cy={cy} r={4}
                                                    fill={payload.total === maxMonth?.total ? "#ef4444" : "#f43f5e"}
                                                    stroke="white" strokeWidth={1.5} />
                                            );
                                        }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Detail Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Rincian Per Periode</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="text-left px-6 py-3 font-medium text-slate-500">Periode</th>
                                            {allCategories.map(cat => (
                                                <th key={cat} className="text-right px-4 py-3 font-medium text-slate-500 whitespace-nowrap">
                                                    {CATEGORY_LABELS[cat] ?? cat}
                                                </th>
                                            ))}
                                            <th className="text-right px-6 py-3 font-medium text-rose-600">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {chartData.slice().reverse().map((row: any) => (
                                            <tr key={row.period} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-6 py-3 font-medium text-slate-700 whitespace-nowrap">
                                                    {format(parse(row.period, "yyyy-MM", new Date()), "MMMM yyyy", { locale: idLocale })}
                                                    {row.period === maxMonth?.period && (
                                                        <span className="ml-2 text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">tertinggi</span>
                                                    )}
                                                </td>
                                                {allCategories.map(cat => (
                                                    <td key={cat} className="px-4 py-3 text-right text-slate-600">
                                                        {(row[cat] ?? 0) > 0 ? formatRp(row[cat]) : <span className="text-slate-200">—</span>}
                                                    </td>
                                                ))}
                                                <td className="px-6 py-3 text-right font-bold text-rose-700">
                                                    {row.total > 0 ? formatRp(row.total) : <span className="text-slate-300">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t-2 font-bold">
                                        <tr>
                                            <td className="px-6 py-3 text-slate-700">Total ({chartData.length} Periode)</td>
                                            {allCategories.map(cat => (
                                                <td key={cat} className="px-4 py-3 text-right text-slate-600">
                                                    {(catTotals[cat] ?? 0) > 0 ? formatRp(catTotals[cat]) : <span className="text-slate-300">—</span>}
                                                </td>
                                            ))}
                                            <td className="px-6 py-3 text-right text-rose-700">{formatRp(totalExpense)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
