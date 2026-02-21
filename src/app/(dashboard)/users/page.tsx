"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { PlusCircle, Trash2, PowerOff, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
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
import { useAppStore } from "@/lib/store";

export default function UsersPage() {
    const queryClient = useQueryClient();
    const { role } = useAppStore();

    const [modalOpen, setModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

    // Fetch users
    const { data, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.getUsers(),
        enabled: role === 'admin_utama', // Only fetch if admin_utama
    });
    const users = (data as any)?.users || [];

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

    const createMutation = useMutation({
        mutationFn: (payload: any) => api.createUser(payload),
        onSuccess: () => { invalidate(); toast.success("Pengguna berhasil ditambahkan"); setModalOpen(false); },
        onError: (err: any) => toast.error(err.message || "Gagal membuat pengguna"),
    });

    const deactivateMutation = useMutation({
        mutationFn: (id: string) => api.deactivateUser(id),
        onSuccess: () => { invalidate(); toast.success("Akses pengguna dicabut"); },
        onError: (err: any) => toast.error(err.message || "Gagal mencabut akses"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteUser(id),
        onSuccess: () => { invalidate(); toast.success("Pengguna berhasil dihapus"); setDeleteTarget(null); },
        onError: (err: any) => toast.error(err.message || "Gagal menghapus pengguna"),
    });

    const { control, handleSubmit, reset } = useForm({
        defaultValues: { email: "", name: "", password: "", role: "petugas" },
    });

    const openAddModal = () => {
        reset({ email: "", name: "", password: "", role: "petugas" });
        setModalOpen(true);
    };

    const onSubmit = (formData: any) => {
        if (formData.password?.length < 6) {
            return toast.error("Password minimal 6 karakter");
        }
        createMutation.mutate(formData);
    };

    const ROLE_LABELS: Record<string, string> = {
        'admin_utama': 'Admin Utama',
        'admin': 'Admin',
        'petugas': 'Petugas',
    };

    if (role !== 'admin_utama') {
        return <div className="p-8 text-center text-slate-500">Anda tidak memiliki akses ke halaman ini.</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Manajemen Tim</h2>
                    <p className="text-slate-500 mt-1 sm:mt-2 text-sm">Kelola akses Admin dan Petugas Kos</p>
                </div>
                <Button onClick={openAddModal}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Tambah Anggota
                </Button>
            </div>

            <div className="rounded-md border bg-white shadow-sm w-full overflow-x-auto">
                <Table className="min-w-max">
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="whitespace-nowrap">Nama Pengguna</TableHead>
                            <TableHead className="whitespace-nowrap">Email</TableHead>
                            <TableHead className="whitespace-nowrap">Peran (Role)</TableHead>
                            <TableHead className="whitespace-nowrap">Status Akses</TableHead>
                            <TableHead className="text-right w-28 whitespace-nowrap">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Memuat data...
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-slate-400">Belum ada anggota tim.</TableCell>
                            </TableRow>
                        ) : (
                            users.map((u: any) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium text-slate-700 whitespace-nowrap">{u.name || '-'}</TableCell>
                                    <TableCell className="whitespace-nowrap">{u.email}</TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <Badge variant={u.role === 'admin_utama' ? 'default' : u.role === 'admin' ? 'secondary' : 'outline'}>
                                            {ROLE_LABELS[u.role] ?? u.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <Badge variant={u.is_active ? 'default' : 'destructive'} className={u.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : ''}>
                                            {u.is_active ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        {u.role !== 'admin_utama' && (
                                            <div className="flex justify-end gap-1">
                                                {u.is_active === 1 && (
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                                                        title="Cabut Akses"
                                                        onClick={() => deactivateMutation.mutate(u.id)}
                                                    >
                                                        <PowerOff className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                    title="Hapus"
                                                    onClick={() => setDeleteTarget(u)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Tambah Anggota Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-blue-600" />
                                Buat Akses Baru
                            </DialogTitle>
                            <DialogDescription>Tambahkan email dan password karyawan baru.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nama Lengkap</Label>
                                <Controller name="name" control={control}
                                    render={({ field }) => <Input placeholder="Nama staf" required {...field} />} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Email</Label>
                                <Controller name="email" control={control}
                                    render={({ field }) => <Input type="email" placeholder="email@contoh.com" required {...field} />} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Password Sementara</Label>
                                <Controller name="password" control={control}
                                    render={({ field }) => <Input type="password" required minLength={6} placeholder="Min. 6 karakter" {...field} />} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Level Akses</Label>
                                <Controller name="role" control={control}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="petugas">Petugas (Hanya input kas/data baru)</SelectItem>
                                                <SelectItem value="admin">Admin (Akses edit/hapus penuh)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Buat Akun
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Hapus Konfirmasi */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle className="h-5 w-5" /> Hapus Akses Pengguna?
                        </DialogTitle>
                        <DialogDescription>
                            {deleteTarget && (
                                <>
                                    Anda akan menghapus profil akses <span className="font-semibold">{deleteTarget.email}</span>.
                                    Mereka tidak akan bisa lagi masuk ke dalam sistem. Ini tidak dapat dibatalkan.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
                        <Button variant="destructive" disabled={deleteMutation.isPending}
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
                            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ya, Hapus Permanen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
