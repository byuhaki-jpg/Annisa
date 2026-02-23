"use client";

import { useRef, useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X, Camera as CameraIcon, CheckCircle2, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";

const ALLOWED_CATEGORIES = ['listrik', 'air', 'wifi', 'kebersihan', 'perbaikan', 'gaji', 'modal', 'lainnya'];

interface ScannedItem {
    name: string;
    qty: number;
    unit: string;
    price: number;
    subtotal: number;
}

interface ScannedData {
    type: string;
    category: string;
    amount: number;
    notes: string;
    items?: ScannedItem[];
    store?: string;
}

export function AIScannerModal() {
    const { isScannerOpen, setScannerOpen } = useAppStore();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);

    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [scannedData, setScannedData] = useState<ScannedData | null>(null);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editSubtotal, setEditSubtotal] = useState("");

    // Reset state each time modal opens
    useEffect(() => {
        if (!isScannerOpen) {
            setTimeout(() => {
                setImageUrl(null);
                setImageFile(null);
                setScannedData(null);
                setUploading(false);
                setSaving(false);
                setEditingIdx(null);
            }, 300);
        }
    }, [isScannerOpen]);

    const processFile = async (file: File) => {
        const objectUrl = URL.createObjectURL(file);
        setImageUrl(objectUrl);
        setImageFile(file);
        setUploading(true);

        try {
            const data = await api.scanNotaAI(file);
            setScannedData(data);
            toast.success("Nota berhasil dibaca AI!");
        } catch (err: any) {
            toast.error(err.message || "Gagal membaca nota");
            handleClose();
        } finally {
            setUploading(false);
        }
    };

    const handleNativeCamera = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt,
                promptLabelHeader: 'Scan Nota AI',
                promptLabelPhoto: 'Dari Galeri',
                promptLabelPicture: 'Gunakan Kamera',
            });
            if (!image.base64String) return;
            const byteCharacters = atob(image.base64String);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: `image/${image.format || 'jpeg'}` });
            const file = new File([blob], `scan-${Date.now()}.${image.format || 'jpg'}`, { type: `image/${image.format || 'jpeg'}` });

            processFile(file);
        } catch (err: any) {
            handleClose();
            if (err.message && err.message.includes('User cancelled')) return;
        }
    };

    const handleWebSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
    };

    useEffect(() => {
        if (isScannerOpen && !imageUrl && !uploading && !scannedData) {
            if (Capacitor.isNativePlatform()) {
                handleNativeCamera();
            } else {
                fileRef.current?.click();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isScannerOpen]);

    const handleClose = () => {
        if (uploading || saving) return;
        setScannerOpen(false);
    };

    const hasItems = scannedData?.items && scannedData.items.length > 1;

    const handleRemoveItem = (idx: number) => {
        if (!scannedData?.items) return;
        const newItems = scannedData.items.filter((_, i) => i !== idx);
        const newAmount = newItems.reduce((s, it) => s + it.subtotal, 0);
        setScannedData({ ...scannedData, items: newItems, amount: newAmount });
    };

    const handleStartEdit = (idx: number) => {
        if (!scannedData?.items) return;
        const item = scannedData.items[idx];
        setEditingIdx(idx);
        setEditName(`${item.qty > 1 ? item.qty + (item.unit !== 'pcs' ? ' ' + item.unit : 'x') + ' ' : ''}${item.name}`);
        setEditSubtotal(String(item.subtotal));
    };

    const handleSaveEdit = () => {
        if (editingIdx === null || !scannedData?.items) return;
        const newItems = [...scannedData.items];
        newItems[editingIdx] = {
            ...newItems[editingIdx],
            name: editName,
            subtotal: Number(editSubtotal) || newItems[editingIdx].subtotal,
        };
        const newAmount = newItems.reduce((s, it) => s + it.subtotal, 0);
        setScannedData({ ...scannedData, items: newItems, amount: newAmount });
        setEditingIdx(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannedData) return;
        try {
            setSaving(true);

            // Upload image to Drive
            let driveUrl = '';
            if (imageFile) {
                const result = await api.uploadToDrive(imageFile);
                driveUrl = result.url;
            } else if (imageUrl) {
                const fetchRes = await fetch(imageUrl as string);
                const blob = await fetchRes.blob();
                const file = new File([blob], `scan-${Date.now()}.jpeg`, { type: 'image/jpeg' });
                const result = await api.uploadToDrive(file);
                driveUrl = result.url;
            }

            const today = new Date().toISOString().split('T')[0];
            const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || '' : '';
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';

            if (hasItems && scannedData.items) {
                // Multi-item: save each item as separate expense
                let savedCount = 0;
                for (const item of scannedData.items) {
                    const itemNotes = `${item.qty > 1 ? item.qty + (item.unit !== 'pcs' ? ' ' + item.unit : 'x') + ' ' : ''}${item.name}`;
                    const payload = {
                        type: scannedData.type as 'income' | 'expense',
                        category: scannedData.category,
                        amount: item.subtotal,
                        method: 'cash' as const,
                        expense_date: today,
                        notes: itemNotes + ' (via AI Scan)',
                        receipt_key: driveUrl,
                    };

                    const res = await fetch(`${apiUrl}/expenses`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) savedCount++;
                }
                toast.success(`${savedCount} item berhasil disimpan!`);
            } else {
                // Single item
                const payload = {
                    type: scannedData.type as 'income' | 'expense',
                    category: scannedData.category,
                    amount: Number(scannedData.amount),
                    method: 'cash' as const,
                    expense_date: today,
                    notes: scannedData.notes + ' (via AI Scan)',
                    receipt_key: driveUrl,
                };

                const res = await fetch(`${apiUrl}/expenses`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error('Gagal menyimpan hasil');
                toast.success("Berhasil disimpan!");
            }

            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            handleClose();
        } catch (err: any) {
            toast.error(err.message || "Gagal upload gambar dan simpan");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleWebSelect} />
            <Dialog open={isScannerOpen} onOpenChange={(val) => { if (!val) handleClose(); }}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto w-[95vw] rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                                <CameraIcon className="w-5 h-5" />
                            </span>
                            Analisis Nota AI
                        </DialogTitle>
                        <DialogDescription>
                            AI sedang membaca dan mengekstrak rincian keuangan dari nota.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 mt-2">
                        {/* Image Preview */}
                        {imageUrl && (
                            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imageUrl} alt="Nota" className="w-full h-full object-contain" />
                                {uploading && (
                                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                        <div className="text-sm font-medium text-slate-700">Membaca nota...</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {scannedData && !uploading && (
                            <form onSubmit={handleSave} className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                                    <div className="text-sm text-green-800">
                                        <span className="font-semibold block text-green-700">Scan Berhasil</span>
                                        {hasItems
                                            ? `${scannedData.items!.length} item terdeteksi. Masing-masing akan disimpan terpisah.`
                                            : 'Silakan periksa kembali data di bawah lalu simpan.'
                                        }
                                    </div>
                                </div>

                                {/* Store name */}
                                {scannedData.store && (
                                    <div className="text-sm text-slate-600 font-medium flex items-center gap-1.5">
                                        🏪 {scannedData.store}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Jenis Transaksi</Label>
                                        <Select
                                            value={scannedData.type}
                                            onValueChange={(val) => setScannedData({ ...scannedData, type: val })}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="expense">Pengeluaran</SelectItem>
                                                <SelectItem value="income">Pemasukan</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Kategori</Label>
                                        <Select
                                            value={scannedData.category}
                                            onValueChange={(val) => setScannedData({ ...scannedData, category: val })}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="listrik">Listrik PLN</SelectItem>
                                                <SelectItem value="air">Air PDAM / Jetpump</SelectItem>
                                                <SelectItem value="wifi">Internet / WiFi</SelectItem>
                                                <SelectItem value="kebersihan">Kebersihan / Sampah</SelectItem>
                                                <SelectItem value="perbaikan">Perbaikan / Maintenance</SelectItem>
                                                <SelectItem value="gaji">Gaji Karyawan / Jaga</SelectItem>
                                                <SelectItem value="modal">Modal</SelectItem>
                                                <SelectItem value="lainnya">Lainnya...</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Multi-item table */}
                                {hasItems ? (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">📦 Rincian Item ({scannedData.items!.length})</Label>
                                        <div className="border rounded-lg divide-y">
                                            {scannedData.items!.map((item, idx) => (
                                                <div key={idx} className="p-2.5 flex items-center gap-2">
                                                    {editingIdx === idx ? (
                                                        <div className="flex-1 flex flex-col gap-1.5">
                                                            <Input
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                className="h-8 text-sm"
                                                                placeholder="Nama item"
                                                            />
                                                            <div className="flex gap-2 items-center">
                                                                <span className="text-xs text-slate-500">Rp</span>
                                                                <Input
                                                                    type="number"
                                                                    value={editSubtotal}
                                                                    onChange={(e) => setEditSubtotal(e.target.value)}
                                                                    className="h-8 text-sm font-mono flex-1"
                                                                />
                                                                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={handleSaveEdit}>
                                                                    OK
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm truncate">
                                                                    {item.qty > 1 && (
                                                                        <span className="text-blue-600 font-medium">
                                                                            {item.qty}{item.unit !== 'pcs' ? ' ' + item.unit : 'x'}{' '}
                                                                        </span>
                                                                    )}
                                                                    {item.name}
                                                                </div>
                                                                {item.qty > 1 && item.price > 0 && (
                                                                    <div className="text-xs text-slate-400">@Rp {item.price.toLocaleString('id-ID')}</div>
                                                                )}
                                                            </div>
                                                            <div className="text-sm font-mono font-medium text-right whitespace-nowrap">
                                                                Rp {item.subtotal.toLocaleString('id-ID')}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEdit(idx)}
                                                                className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(idx)}
                                                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-right text-sm font-semibold text-slate-700 pt-1">
                                            💰 Total: Rp {scannedData.amount.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                ) : (
                                    /* Single item fallback */
                                    <>
                                        <div className="space-y-1">
                                            <Label>Nominal (Rp)</Label>
                                            <Input
                                                type="number"
                                                value={scannedData.amount || ''}
                                                onChange={(e) => setScannedData({ ...scannedData, amount: Number(e.target.value) })}
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Keterangan / Deskripsi Nota</Label>
                                            <Input
                                                value={scannedData.notes}
                                                onChange={(e) => setScannedData({ ...scannedData, notes: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}

                                <Button type="submit" disabled={saving || uploading} className="w-full mt-2">
                                    {saving
                                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</>
                                        : hasItems
                                            ? `Simpan Semua (${scannedData.items!.length} item)`
                                            : "Simpan Pengeluaran"
                                    }
                                </Button>
                            </form>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
