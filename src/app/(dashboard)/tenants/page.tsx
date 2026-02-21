"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Power, Loader2, Users, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function TenantsPage() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data: tenantsData, isLoading } = useQuery({
        queryKey: ['tenants'],
        queryFn: () => api.getTenants(),
    });

    const { data: roomsData } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => api.getRooms(),
    });

    const tenants = (tenantsData as any)?.tenants || [];
    const rooms = (roomsData as any)?.rooms || [];
    const availableRooms = rooms.filter((r: any) => !r.tenant_id || r.tenant_id === editingId); // Rooms empty, OR belonging to the user currently being edited

    const createMutation = useMutation({
        mutationFn: (data: any) => api.createTenant(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success("Penghuni berhasil ditambahkan");
            setModalOpen(false);
        },
        onError: (err: any) => toast.error(err.message || "Gagal menambahkan penghuni")
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string, payload: any }) => api.updateTenant(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success("Data penghuni berhasil diperbarui");
            setModalOpen(false);
        },
        onError: (err: any) => toast.error(err.message || "Gagal memperbarui data penghuni")
    });

    const deactivateMutation = useMutation({
        mutationFn: (id: string) => api.deactivateTenant(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success("Penghuni berhasil dinonaktifkan (Check out)");
        },
        onError: (err: any) => toast.error(err.message || "Gagal menonaktifkan penghuni")
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteTenant(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success("Penghuni berhasil dihapus");
        },
        onError: (err: any) => toast.error(err.message || "Gagal menghapus penghuni")
    });

    const { control, handleSubmit, reset } = useForm({
        defaultValues: {
            name: "",
            wa_number: "",
            room_id: "",
            move_in_date: format(new Date(), "yyyy-MM-dd"),
            deposit_amount: 500000,
            is_active: true,
        },
    });

    const openAddModal = () => {
        setEditingId(null);
        reset({
            name: "",
            wa_number: "",
            room_id: "",
            move_in_date: format(new Date(), "yyyy-MM-dd"),
            deposit_amount: 500000,
            is_active: true,
        });
        setModalOpen(true);
    };

    const openEditModal = (tenant: any) => {
        setEditingId(tenant.id);
        reset({
            name: tenant.name,
            wa_number: tenant.wa_number || "",
            room_id: tenant.room_id,
            move_in_date: tenant.move_in_date,
            deposit_amount: tenant.deposit_amount,
            is_active: tenant.is_active,
        });
        setModalOpen(true);
    };

    const handleToggleActive = (tenant: any) => {
        if (tenant.is_active) {
            // Confirming deactivation
            if (window.confirm(`Yakin ingin menonaktifkan penghuni ${tenant.name}? Status kamar akan menjadi kosong dan tidak akan ditagih bulan depan.`)) {
                deactivateMutation.mutate(tenant.id);
            }
        } else {
            // Re-activating
            updateMutation.mutate({ id: tenant.id, payload: { is_active: true } });
        }
    };

    const handleDelete = (tenant: any) => {
        if (window.confirm(`Yakin ingin MENGHAPUS penghuni ${tenant.name}? Data yang dihapus tidak bisa dikembalikan.`)) {
            deleteMutation.mutate(tenant.id);
        }
    };

    const onSubmit = (formData: any) => {
        if (editingId) {
            updateMutation.mutate({ id: editingId, payload: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Penghuni</h2>
                    <p className="text-slate-500 mt-1 sm:mt-2 text-sm">Daftar semua orang yang mengekost saat ini maupun sebelumnya</p>
                </div>
                <Button onClick={openAddModal}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Tambah Penghuni
                </Button>
            </div>

            <div className="rounded-md border bg-white shadow-sm w-full overflow-x-auto">
                <Table className="min-w-max">
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="whitespace-nowrap">Nama</TableHead>
                            <TableHead className="whitespace-nowrap">No. WhatsApp</TableHead>
                            <TableHead className="whitespace-nowrap">Kamar</TableHead>
                            <TableHead className="whitespace-nowrap">Tgl Masuk</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Deposit</TableHead>
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
                        ) : tenants.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-500 italic">
                                    Belum ada data penghuni.
                                </TableCell>
                            </TableRow>
                        ) : (
                            tenants.map((t: any) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-semibold text-slate-700 whitespace-nowrap">{t.name}</TableCell>
                                    <TableCell className="whitespace-nowrap">{t.wa_number || '-'}</TableCell>
                                    <TableCell className="whitespace-nowrap">Kmr {t.room_no}</TableCell>
                                    <TableCell className="whitespace-nowrap">{format(new Date(t.move_in_date), "dd MMM yyyy", { locale: idLocale })}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(t.deposit_amount)}</TableCell>
                                    <TableCell className="text-center whitespace-nowrap">
                                        <Badge variant={t.is_active ? "default" : "secondary"}>
                                            {t.is_active ? "Aktif" : "Non-aktif (Pindah)"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                                        <Button variant="ghost" size="icon" onClick={() => openEditModal(t)}>
                                            <Pencil className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleToggleActive(t)} disabled={deactivateMutation.isPending || updateMutation.isPending}>
                                            <Power className={`h-4 w-4 ${t.is_active ? "text-emerald-500" : "text-slate-300"}`} />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} disabled={deleteMutation.isPending}>
                                            <Trash2 className="h-4 w-4 text-rose-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Penghuni" : "Tambah Penghuni"}</DialogTitle>
                            <DialogDescription>
                                Input data identitas diri dan pembagian kamar.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nama Lengkap Sesuai KTP</Label>
                                <Controller
                                    name="name"
                                    control={control}
                                    rules={{ required: true }}
                                    render={({ field }) => <Input id="name" placeholder="Fulan Haryanto..." {...field} />}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="wa_number">No. WhatsApp</Label>
                                <Controller
                                    name="wa_number"
                                    control={control}
                                    rules={{ required: true }}
                                    render={({ field }) => (
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-medium">+62</span>
                                            <Input id="wa_number" className="pl-10" placeholder="81234567890" {...field} />
                                        </div>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="room_id">Kamar</Label>
                                    <Controller
                                        name="room_id"
                                        control={control}
                                        rules={{ required: true }}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger id="room_id">
                                                    <SelectValue placeholder="Pilih Kamar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableRooms.map((r: any) => (
                                                        <SelectItem key={r.id} value={r.id}>
                                                            Kamar {r.room_no} - {formatCurrency(r.monthly_rate)}
                                                        </SelectItem>
                                                    ))}
                                                    {availableRooms.length === 0 && (
                                                        <SelectItem value="none" disabled>Tidak ada kamar kosong</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="move_in_date">Tanggal Masuk Kost</Label>
                                    <Controller
                                        name="move_in_date"
                                        control={control}
                                        rules={{ required: true }}
                                        render={({ field }) => <Input id="move_in_date" type="date" {...field} />}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="deposit_amount">Uang Titipan / Deposit (Rp)</Label>
                                <Controller
                                    name="deposit_amount"
                                    control={control}
                                    render={({ field }) => (
                                        <Input
                                            id="deposit_amount"
                                            type="number"
                                            value={field.value}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                        />
                                    )}
                                />
                            </div>

                            {editingId && (
                                <div className="flex items-center space-x-2 pt-2">
                                    <Controller
                                        name="is_active"
                                        control={control}
                                        render={({ field }) => (
                                            <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />
                                        )}
                                    />
                                    <Label htmlFor="is_active">Masih Aktif Nge-Kost</Label>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Simpan Data Penghuni
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
