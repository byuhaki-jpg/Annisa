"use client";

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { PlusCircle, Pencil, Loader2, Trash2, AlertTriangle, Paperclip, Eye, Upload, X, FileImage, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { api } from "@/lib/api";
import { ReportDownloadDialog } from "./report-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// ── Constants ─────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
    listrik: "Listrik",
    air: "Air",
    wifi: "WiFi / Internet",
    kebersihan: "Kebersihan",
    perbaikan: "Perbaikan",
    modal: "Modal Kas",
    lainnya: "Lainnya",
};

const METHOD_LABELS: Record<string, string> = {
    transfer: "Transfer",
    cash: "Tunai",
    other: "Lainnya",
};

// ── Receipt Uploader (Google Drive proxy) ─────────

interface ReceiptUploaderProps {
    onUploaded: (driveUrl: string) => void;
    existingUrl?: string | null;
}

function ReceiptUploader({ onUploaded, existingUrl }: ReceiptUploaderProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [localUrl, setLocalUrl] = useState<string | null>(existingUrl ?? null);

    const handleNativeCamera = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60, // Kompres native sebelum upload (hemat kuota)
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt, // Munculkan pilihan: Kamera / Galeri
                promptLabelHeader: 'Scan Nota',
                promptLabelPhoto: 'Dari Galeri',
                promptLabelPicture: 'Gunakan Kamera',
            });

            if (!image.base64String) return;

            // Konversi Base64 dari Native Camera menjadi objek File untuk upload
            const byteCharacters = atob(image.base64String);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: `image/${image.format || 'jpeg'}` });
            const file = new File([blob], `scan-nota-${Date.now()}.${image.format || 'jpg'}`, { type: `image/${image.format || 'jpeg'}` });

            setUploading(true);
            const { url } = await api.uploadToDrive(file);
            setLocalUrl(url);
            onUploaded(url);
            toast.success("Foto nota berhasil diunggah!");
        } catch (err: any) {
            if (err.message && err.message.includes('User cancelled photos app')) return; // Ignore kalau user cuma close kamera
            toast.error("Kamera dibatalkan atau error: " + (err.message || ''));
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error("File terlalu besar. Maksimal 10 MB.");
            return;
        }
        if (!file.type.match(/^image\/(jpeg|png|webp)|application\/pdf$/)) {
            toast.error("Format harus JPG, PNG, WebP, atau PDF.");
            return;
        }

        setUploading(true);
        try {
            const { url } = await api.uploadToDrive(file);
            setLocalUrl(url);
            onUploaded(url);
            toast.success("Nota berhasil diunggah ke Google Drive!");
        } catch (err: any) {
            toast.error(err.message || "Gagal mengunggah nota");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const handleRemove = () => {
        setLocalUrl(null);
        onUploaded("");
    };

    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileChange}
            />

            {localUrl ? (
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                        {/* Google Drive icon */}
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                            <path d="M4.433 22l4-6.928H22l-4 6.928H4.433z" fill="#3777E3" />
                            <path d="M2 22l6-10.392L11 17.5 7 22H2z" fill="#FFCD3E" opacity="0.8" />
                            <path d="M8 11.608L14 2h6L14 11.608H8z" fill="#11A861" />
                        </svg>
                        <span className="truncate max-w-[180px] font-medium">Tersimpan otomatis</span>
                    </div>
                    <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => window.open(localUrl, '_blank')}>
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                            onClick={handleRemove}>
                            <X className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
                        </Button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                        if (Capacitor.isNativePlatform()) {
                            handleNativeCamera();
                        } else {
                            fileRef.current?.click();
                        }
                    }}
                    className="w-full flex flex-col items-center gap-1.5 py-4 text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-60 bg-white rounded-md border border-slate-200 shadow-sm hover:border-slate-300"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">Terhubung ke Drive...</span>
                        </>
                    ) : (
                        <>
                            <FileImage className="w-6 h-6 text-blue-500 mb-1" />
                            <span className="text-sm font-semibold text-slate-700">Scan Nota / Upload</span>
                            <span className="text-xs text-slate-400">Ambil dari Kamera atau Galeri</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
}


// ── Main Page ─────────────────────────────────────

export default function ExpensesPage() {
    const searchParams = useSearchParams();
    const currentPeriod = searchParams.get("period") || format(new Date(), "yyyy-MM");
    const queryClient = useQueryClient();

    const [modalOpen, setModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [pendingKey, setPendingKey] = useState<string>("");   // receipt key held during form

    // ── Current user role ──────────────────────────
    const { data: meData } = useQuery({
        queryKey: ['me'],
        queryFn: () => api.getMe(),
        staleTime: Infinity,
    });
    const isAdmin = (meData as any)?.role === 'admin' || (meData as any)?.role === 'admin_utama';

    // ── Expenses data ──────────────────────────────
    const { data, isLoading } = useQuery({
        queryKey: ['expenses', currentPeriod],
        queryFn: () => api.getExpenses(currentPeriod),
    });

    const expenses = (data as any)?.expenses || [];
    const totalExpense = (data as any)?.total_expense || 0;
    const totalIncome = (data as any)?.total_income || 0;
    const sisaSaldo = totalIncome - totalExpense;

    // ── Mutations ──────────────────────────────────
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const createMutation = useMutation({
        mutationFn: (payload: any) => api.createExpense(payload),
        onSuccess: () => { invalidate(); toast.success("Data berhasil disimpan"); setModalOpen(false); },
        onError: (err: any) => toast.error(err.message || "Gagal menyimpan"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: any }) => api.updateExpense(id, payload),
        onSuccess: () => { invalidate(); toast.success("Pengeluaran berhasil diperbarui"); setModalOpen(false); },
        onError: (err: any) => toast.error(err.message || "Gagal memperbarui"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteExpense(id),
        onSuccess: () => { invalidate(); toast.success("Pengeluaran berhasil dihapus"); setDeleteTarget(null); },
        onError: (err: any) => toast.error(err.message || "Gagal menghapus"),
    });

    // ── Form ───────────────────────────────────────
    const { control, handleSubmit, reset } = useForm({
        defaultValues: {
            date: format(new Date(), "yyyy-MM-dd"),
            type: "expense",
            category: "lainnya",
            amount: 0,
            method: "cash",
            notes: "",
            status: true,
        },
    });

    const openAddModal = () => {
        setEditingId(null);
        setPendingKey("");
        reset({ date: format(new Date(), "yyyy-MM-dd"), type: "expense", category: "lainnya", amount: 0, method: "cash", notes: "", status: true });
        setModalOpen(true);
    };

    const openEditModal = (exp: any) => {
        setEditingId(exp.id);
        setPendingKey(exp.receipt_key || "");
        reset({
            date: exp.expense_date,
            type: exp.type || "expense",
            category: exp.category,
            amount: exp.amount,
            method: exp.method,
            notes: exp.notes || "",
            status: exp.status === "confirmed",
        });
        setModalOpen(true);
    };

    const onSubmit = (formData: any) => {
        const payload: any = {
            expense_date: formData.date,
            type: formData.type,
            category: formData.category,
            amount: Number(formData.amount),
            method: formData.method,
            status: formData.status ? "confirmed" : "draft",
            notes: formData.notes,
        };
        if (pendingKey) payload.receipt_key = pendingKey;

        if (editingId) {
            updateMutation.mutate({ id: editingId, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

    const isSaving = createMutation.isPending || updateMutation.isPending;

    // ── Render ─────────────────────────────────────
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Kas Operasional</h2>
                    <p className="text-slate-500 mt-1 sm:mt-2 text-sm">Daftar Pemasukan dan Pengeluaran (Listrik, Perbaikan, Modal Kos, dsb)</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setReportModalOpen(true)}>
                        <Download className="mr-2 h-4 w-4" /> Laporan PDF
                    </Button>
                    <Button onClick={openAddModal}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Catat Kas
                    </Button>
                </div>
            </div>

            {/* Total */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between bg-white border border-emerald-100 bg-emerald-50/10 rounded-lg p-5 shadow-sm">
                    <div>
                        <h3 className="text-sm font-medium text-emerald-600 uppercase tracking-wider">Pemasukan</h3>
                        <p className="text-xs text-slate-500 font-mono mt-1">{currentPeriod}</p>
                    </div>
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    ) : (
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</div>
                    )}
                </div>
                <div className="flex items-center justify-between bg-white border border-rose-100 bg-rose-50/10 rounded-lg p-5 shadow-sm">
                    <div>
                        <h3 className="text-sm font-medium text-rose-500 uppercase tracking-wider">Pengeluaran</h3>
                        <p className="text-xs text-slate-500 font-mono mt-1">{currentPeriod}</p>
                    </div>
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                    ) : (
                        <div className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpense)}</div>
                    )}
                </div>
                <div className={`flex items-center justify-between bg-white border rounded-lg p-5 shadow-sm ${sisaSaldo >= 0 ? "border-indigo-100 bg-indigo-50/10" : "border-orange-100 bg-orange-50/10"}`}>
                    <div>
                        <h3 className={`text-sm font-medium uppercase tracking-wider ${sisaSaldo >= 0 ? "text-indigo-600" : "text-orange-600"}`}>Sisa Saldo</h3>
                        <p className="text-xs text-slate-500 font-mono mt-1">{currentPeriod}</p>
                    </div>
                    {isLoading ? (
                        <Loader2 className={`w-6 h-6 animate-spin ${sisaSaldo >= 0 ? "text-indigo-500" : "text-orange-500"}`} />
                    ) : (
                        <div className={`text-2xl font-bold ${sisaSaldo >= 0 ? "text-indigo-600" : "text-orange-600"}`}>
                            {formatCurrency(sisaSaldo)}
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-white shadow-sm w-full overflow-x-auto">
                <Table className="min-w-max">
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                            <TableHead className="whitespace-nowrap">Kategori</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Jumlah</TableHead>
                            <TableHead className="whitespace-nowrap">Metode</TableHead>
                            <TableHead className="whitespace-nowrap">Status</TableHead>
                            <TableHead className="text-center w-10 whitespace-nowrap">Nota</TableHead>
                            {isAdmin && <TableHead className="text-center w-28 whitespace-nowrap">Aksi</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Memuat data...
                                </TableCell>
                            </TableRow>
                        ) : expenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400">
                                    Belum ada pengeluaran di periode ini.
                                </TableCell>
                            </TableRow>
                        ) : (
                            expenses.map((exp: any) => (
                                <TableRow key={exp.id} className="hover:bg-slate-50/60">
                                    <TableCell className="text-slate-600 whitespace-nowrap">{exp.expense_date}</TableCell>
                                    <TableCell className="font-medium align-top min-w-[200px]">
                                        <Badge variant="outline" className={`mb-1.5 ${exp.type === 'income' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-rose-600 border-rose-200 bg-rose-50'}`}>
                                            {exp.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                                        </Badge>
                                        <div className="whitespace-nowrap">{CATEGORY_LABELS[exp.category] ?? exp.category}</div>
                                        {exp.notes && (
                                            <p className="text-xs text-slate-500 break-words whitespace-pre-wrap mt-1 max-w-[300px] leading-relaxed">{exp.notes}</p>
                                        )}
                                    </TableCell>
                                    <TableCell className={`text-right font-semibold whitespace-nowrap ${exp.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {exp.type === 'income' ? '+' : '-'}{formatCurrency(exp.amount)}
                                    </TableCell>
                                    <TableCell className="text-slate-600 whitespace-nowrap">
                                        {METHOD_LABELS[exp.method] ?? exp.method}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <Badge variant={exp.status === "confirmed" ? "default" : "secondary"}>
                                            {exp.status === "confirmed" ? "Sukses" : "Draft"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">
                                        {exp.receipt_key ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                title="Lihat Nota"
                                                onClick={() => window.open(api.getReceiptUrl(exp.receipt_key), '_blank')}
                                            >
                                                <Paperclip className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <span className="text-slate-200 text-lg">—</span>
                                        )}
                                    </TableCell>
                                    {isAdmin && (
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                    title="Edit"
                                                    onClick={() => openEditModal(exp)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                    title="Hapus"
                                                    onClick={() => setDeleteTarget(exp)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Add/Edit Modal ── */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[460px] max-h-[85vh] overflow-y-auto">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Transaksi Kas" : "Catat Transaksi Kas"}</DialogTitle>
                            <DialogDescription>
                                Lengkapi detail transaksi operasional kas kos.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">

                            {/* Jenis Transaksi */}
                            <div className="grid gap-2">
                                <Label>Jenis Transaksi</Label>
                                <Controller name="type" control={control}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="income">Pemasukan Kas (Modal)</SelectItem>
                                                <SelectItem value="expense">Pengeluaran</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                            </div>

                            {/* Date */}
                            <div className="grid gap-2">
                                <Label htmlFor="date">Tanggal</Label>
                                <Controller name="date" control={control}
                                    render={({ field }) => <Input id="date" type="date" {...field} />} />
                            </div>

                            {/* Category + Method */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Kategori</Label>
                                    <Controller name="category" control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="modal">Modal Kas (Pemasukan)</SelectItem>
                                                    <SelectItem value="listrik">Listrik</SelectItem>
                                                    <SelectItem value="air">Air</SelectItem>
                                                    <SelectItem value="wifi">WiFi / Internet</SelectItem>
                                                    <SelectItem value="kebersihan">Kebersihan</SelectItem>
                                                    <SelectItem value="perbaikan">Perbaikan</SelectItem>
                                                    <SelectItem value="lainnya">Lainnya</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Metode</Label>
                                    <Controller name="method" control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="transfer">Transfer</SelectItem>
                                                    <SelectItem value="cash">Tunai</SelectItem>
                                                    <SelectItem value="other">Lainnya</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="grid gap-2">
                                <Label htmlFor="amount">Jumlah (Rp)</Label>
                                <Controller name="amount" control={control}
                                    render={({ field }) => (
                                        <Input id="amount" type="number" min={0}
                                            value={field.value}
                                            onChange={(e) => field.onChange(Number(e.target.value))} />
                                    )} />
                            </div>

                            {/* Notes */}
                            <div className="grid gap-2">
                                <Label htmlFor="notes">Catatan</Label>
                                <Controller name="notes" control={control}
                                    render={({ field }) => (
                                        <Textarea id="notes" placeholder="Keterangan detail pembelian"
                                            className="resize-none" rows={2} {...field} />
                                    )} />
                            </div>

                            {/* Receipt Upload */}
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1.5">
                                    <Paperclip className="w-3.5 h-3.5" />
                                    Upload Nota
                                    <span className="text-xs font-normal text-slate-400">(opsional)</span>
                                </Label>
                                <ReceiptUploader
                                    existingUrl={pendingKey || null}
                                    onUploaded={(url) => setPendingKey(url)}
                                />
                            </div>

                            {/* Status toggle */}
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50/50">
                                <div>
                                    <p className="text-sm font-medium">Konfirmasi Transaksi</p>
                                    <p className="text-xs text-slate-500">Aktifkan agar masuk ke total bulan ini</p>
                                </div>
                                <Controller name="status" control={control}
                                    render={({ field }) => (
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    )} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingId ? "Simpan Perubahan" : "Simpan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm Dialog ── */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle className="h-5 w-5" /> Hapus Transaksi?
                        </DialogTitle>
                        <DialogDescription>
                            {deleteTarget && (
                                <>
                                    Anda akan menghapus{" "}
                                    <span className="font-semibold text-slate-700">
                                        {CATEGORY_LABELS[deleteTarget.category] ?? deleteTarget.category}
                                    </span>{" "}
                                    sebesar{" "}
                                    <span className="font-semibold text-rose-600">
                                        {formatCurrency(deleteTarget.amount)}
                                    </span>{" "}
                                    ({deleteTarget.expense_date}).
                                    <br /><br />
                                    <span className="text-rose-600 font-medium">Tindakan ini tidak bisa dibatalkan.</span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
                        <Button variant="destructive" disabled={deleteMutation.isPending}
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
                            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ya, Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Report Download Modal ── */}
            <ReportDownloadDialog open={reportModalOpen} onOpenChange={setReportModalOpen} />
        </div>
    );
}
