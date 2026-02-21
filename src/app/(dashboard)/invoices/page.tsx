"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { CheckCircle, Upload, CheckSquare, PlusCircle, Loader2, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
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

export default function InvoicesPage() {
    const searchParams = useSearchParams();
    const currentPeriod = searchParams.get("period") || format(new Date(), "yyyy-MM");
    const queryClient = useQueryClient();

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['invoices', currentPeriod],
        queryFn: () => api.getInvoices(currentPeriod),
    });

    const invoices = (data as any)?.invoices || [];

    const generateMutation = useMutation({
        mutationFn: () => api.generateInvoices(currentPeriod),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            if (res.created_count > 0) {
                toast.success(`${res.created_count} tagihan baru berhasil dibuat`);
            } else {
                toast.info("Semua penghuni aktif sudah memiliki tagihan di bulan ini");
            }
        },
        onError: (err: any) => {
            toast.error(err.message || "Gagal membuat tagihan");
        }
    });

    const paymentMutation = useMutation({
        mutationFn: (data: any) => api.createPayment(data),
        onSuccess: () => {
            toast.success("Pembayaran berhasil dicatat");
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            setModalOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Gagal mencatat pembayaran");
        }
    });

    const { control, handleSubmit, reset } = useForm({
        defaultValues: {
            amount: 0,
            method: "transfer",
            paid_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            notes: "",
        },
    });

    const openPaymentModal = (inv: any) => {
        setSelectedInvoice(inv);
        reset({
            amount: inv.amount,
            method: "transfer",
            paid_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            notes: "",
        });
        setModalOpen(true);
    };

    const onSubmit = (formData: any) => {
        if (selectedInvoice) {
            paymentMutation.mutate({
                invoice_id: selectedInvoice.id,
                amount: formData.amount,
                method: formData.method,
                paid_at: new Date(formData.paid_at).toISOString(),
                notes: formData.notes,
                proof_key: "", // Can add actual R2 upload logic later
            });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tagihan (Invoices)</h2>
                    <p className="text-slate-500 mt-1 sm:mt-2 text-sm">Kelola tagihan sewa kost per bulan</p>
                </div>
                <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                >
                    {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Buat Tagihan Bulan Ini
                </Button>
            </div>

            <div className="rounded-md border bg-white shadow-sm w-full overflow-x-auto">
                <Table className="min-w-max">
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="whitespace-nowrap">No. Tagihan</TableHead>
                            <TableHead className="whitespace-nowrap">Penghuni</TableHead>
                            <TableHead className="whitespace-nowrap">Kamar</TableHead>
                            <TableHead className="whitespace-nowrap">Periode</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Jumlah</TableHead>
                            <TableHead className="text-center whitespace-nowrap">Status</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : invoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-500 italic">
                                    Belum ada tagihan untuk periode ini
                                </TableCell>
                            </TableRow>
                        ) : (
                            invoices.map((inv: any) => (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-medium text-slate-700 whitespace-nowrap">{inv.invoice_no}</TableCell>
                                    <TableCell className="font-semibold whitespace-nowrap">{inv.tenant_name}</TableCell>
                                    <TableCell className="whitespace-nowrap">Kmr {inv.room_no}</TableCell>
                                    <TableCell className="whitespace-nowrap">{inv.period}</TableCell>
                                    <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(inv.amount)}</TableCell>
                                    <TableCell className="text-center whitespace-nowrap">
                                        <Badge variant={inv.status === "paid" ? "default" : "secondary"} className={inv.status === 'paid' ? 'bg-emerald-500 hover:bg-emerald-600' : 'text-slate-500'}>
                                            {inv.status === "paid" ? "Lunas" : "Belum Lunas"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                                        {inv.status === "unpaid" ? (
                                            <Button variant="outline" size="sm" onClick={() => openPaymentModal(inv)}>
                                                <CheckSquare className="h-4 w-4 mr-2" /> Catat Lunas
                                            </Button>
                                        ) : (
                                            <span className="text-sm text-slate-400 italic">
                                                Dilunasi {format(new Date(inv.paid_at), "dd MMM yyyy", { locale: id })}
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Catat Pembayaran</DialogTitle>
                            <DialogDescription>
                                Jadikan tagihan {selectedInvoice?.invoice_no} ({selectedInvoice?.tenant_name}) lunas.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="amount">Jumlah (Rp)</Label>
                                <Controller
                                    name="amount"
                                    control={control}
                                    render={({ field }) => (
                                        <Input id="amount" type="number" readOnly className="bg-slate-50" {...field} />
                                    )}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="method">Metode Pembayaran</Label>
                                <Controller
                                    name="method"
                                    control={control}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger id="method">
                                                <SelectValue placeholder="Pilih metode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="transfer">Transfer Bank</SelectItem>
                                                <SelectItem value="cash">Tunai (Cash)</SelectItem>
                                                <SelectItem value="qris">QRIS</SelectItem>
                                                <SelectItem value="other">Metode Lainnya</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="paid_at">Tanggal & Waktu Bayar</Label>
                                <Controller
                                    name="paid_at"
                                    control={control}
                                    render={({ field }) => (
                                        <Input id="paid_at" type="datetime-local" {...field} />
                                    )}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="notes">Catatan (Opsional)</Label>
                                <Controller
                                    name="notes"
                                    control={control}
                                    render={({ field }) => (
                                        <Textarea id="notes" placeholder="Catatan bukti transfer, dll" className="resize-none" {...field} />
                                    )}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Bukti Transfer / Upload</Label>
                                <div className="text-xs text-slate-500 italic p-3 bg-slate-50 border rounded-md">
                                    Fitur Upload Bukti Transfer ke Cloudflare R2 otomatis belum diaktifkan dalam demo/versi ini. Bukti dapat discan dengan AI secara otomatis di rilis mendatang.
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={paymentMutation.isPending}>
                                {paymentMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Simpan Pembayaran
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
