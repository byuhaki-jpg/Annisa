"use client";

import { useRef, useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X, Camera as CameraIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";

const ALLOWED_CATEGORIES = ['listrik', 'air', 'wifi', 'kebersihan', 'perbaikan', 'gaji', 'modal', 'lainnya'];

export function AIScannerModal() {
    const { isScannerOpen, setScannerOpen } = useAppStore();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);

    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [scannedData, setScannedData] = useState<{
        type: string;
        category: string;
        amount: number;
        notes: string;
    } | null>(null);

    // Reset state each time modal opens
    useEffect(() => {
        if (!isScannerOpen) {
            setTimeout(() => {
                setImageUrl(null);
                setScannedData(null);
                setUploading(false);
                setSaving(false);
            }, 300);
        }
    }, [isScannerOpen]);

    const processFile = async (file: File) => {
        const objectUrl = URL.createObjectURL(file);
        setImageUrl(objectUrl);
        setUploading(true);

        try {
            // Kita proses ke AI langung dari File buffer
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

    // Ini dipanggil saat tombol AI Scanner ditekan
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannedData) return;
        try {
            setSaving(true);

            // First we need to upload the image to Drive so it actually gets a receipt_key.
            // But wait, the previous code uploads to Drive in handleFileChange! 
            // We didn't upload this image to Drive yet to save time!
            // Let's do it right now to save it in Google Drive.

            // Reconstruct file from Object URL
            const fetchRes = await fetch(imageUrl as string);
            const blob = await fetchRes.blob();
            const file = new File([blob], `scan-${Date.now()}.jpeg`, { type: 'image/jpeg' });

            const { url: driveUrl } = await api.uploadToDrive(file);

            // API endpoint untuk nambah expense? Wait, let's use the local API if available.
            // Oh right, we can just call standard POST /api/expenses
            const payload = {
                type: scannedData.type as 'income' | 'expense',
                category: scannedData.category,
                amount: Number(scannedData.amount),
                method: 'cash' as const, // default
                expense_date: new Date().toISOString().split('T')[0],
                notes: scannedData.notes + ' (via AI Scan)',
                receipt_key: driveUrl,
            };

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api'}/expenses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Gagal menyimpan hasil');

            toast.success("Berhasil disimpan!");
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["expenses"] });

            handleClose();
        } catch (err: any) {
            toast.error(err.message || "Gagal upload gambar dan simpan");
        } finally {
            setSaving(true);
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
                                        Silakan periksa kembali data di bawah lalu simpan.
                                    </div>
                                </div>

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
                                        <Label>Nominal (Rp)</Label>
                                        <Input
                                            type="number"
                                            value={scannedData.amount || ''}
                                            onChange={(e) => setScannedData({ ...scannedData, amount: Number(e.target.value) })}
                                            className="font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label>Kategori {scannedData.type === 'income' && '(Bebas saja)'}</Label>
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
                                            <SelectItem value="lainnya">Lainnya...</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Keterangan / Deskripsi Nota</Label>
                                    <Textarea
                                        value={scannedData.notes}
                                        onChange={(e) => setScannedData({ ...scannedData, notes: e.target.value })}
                                        className="resize-none"
                                        rows={2}
                                    />
                                </div>

                                <Button type="submit" disabled={saving || uploading} className="w-full mt-2">
                                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : "Simpan Pengeluaran"}
                                </Button>
                            </form>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
