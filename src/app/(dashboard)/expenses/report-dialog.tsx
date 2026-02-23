"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Download, FileText, Share2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

const CATEGORY_LABELS: Record<string, string> = {
    listrik: "Listrik",
    air: "Air",
    wifi: "WiFi / Internet",
    kebersihan: "Kebersihan",
    perbaikan: "Perbaikan",
    gaji: "Gaji Karyawan",
    modal: "Modal Kas",
    lainnya: "Lainnya",
};

const METHOD_LABELS: Record<string, string> = {
    transfer: "Transfer",
    cash: "Tunai",
    other: "Lainnya",
};

function formatRp(n: number): string {
    return "Rp " + n.toLocaleString("id-ID");
}

function buildPDF(
    data: { expenses: any[]; total_income: number; total_expense: number },
    startDate: string,
    endDate: string
) {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 16;

    // ── Kop Surat ──────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("KOST ANNISA", pageWidth / 2, y, { align: "center" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Sistem Manajemen Keuangan", pageWidth / 2, y, { align: "center" });
    y += 5;

    // Garis tebal bawah kop
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ── Judul Laporan ───────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("LAPORAN KAS OPERASIONAL", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const periodeLabel = `Periode: ${format(new Date(startDate), "dd MMM yyyy")} s/d ${format(new Date(endDate), "dd MMM yyyy")}`;
    doc.text(periodeLabel, pageWidth / 2, y, { align: "center" });
    y += 10;

    // ── Kotak Ringkasan (3 kotak) ───────────────────
    const boxW = (pageWidth - margin * 2 - 8) / 3; // 3 kotak, gap 4mm
    const boxH = 20;
    const saldo = data.total_income - data.total_expense;

    const boxes = [
        { title: "TOTAL PEMASUKAN", value: formatRp(data.total_income), color: [16, 185, 129] as [number, number, number] },
        { title: "TOTAL PENGELUARAN", value: formatRp(data.total_expense), color: [239, 68, 68] as [number, number, number] },
        { title: "SISA SALDO", value: formatRp(saldo), color: saldo >= 0 ? [79, 70, 229] as [number, number, number] : [234, 88, 12] as [number, number, number] },
    ];

    boxes.forEach((box, i) => {
        const x = margin + i * (boxW + 4);
        // Border kotak
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, boxW, boxH, 2, 2);

        // Judul kotak
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(box.title, x + 4, y + 7);

        // Nominal kotak
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(box.color[0], box.color[1], box.color[2]);
        doc.text(box.value, x + 4, y + 15);
    });

    doc.setTextColor(0, 0, 0); // reset
    y += boxH + 10;

    // ── Tabel Rincian ───────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Rincian Transaksi", margin, y);
    y += 2;

    const tableBody = data.expenses.map((exp: any) => [
        exp.expense_date,
        exp.type === "income" ? "Masuk" : "Keluar",
        (CATEGORY_LABELS[exp.category] || exp.category) + (exp.notes ? `\n${exp.notes}` : ""),
        METHOD_LABELS[exp.method] || exp.method,
        formatRp(exp.amount),
    ]);

    if (tableBody.length === 0) {
        tableBody.push(["", "", "Tidak ada transaksi di periode ini", "", ""]);
    }

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Tanggal", "Jenis", "Kategori & Keterangan", "Metode", "Nominal"]],
        body: tableBody,
        headStyles: {
            fillColor: [241, 245, 249],
            textColor: [30, 41, 59],
            fontStyle: "bold",
            fontSize: 8,
            cellPadding: 3,
        },
        bodyStyles: {
            fontSize: 8,
            cellPadding: 2.5,
            textColor: [51, 65, 85],
        },
        columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: 16 },
            3: { cellWidth: 20, halign: "center" },
            4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        didParseCell: (hookData: any) => {
            // Warnai kolom Jenis
            if (hookData.section === "body" && hookData.column.index === 1) {
                const val = hookData.cell.raw as string;
                if (val === "Masuk") {
                    hookData.cell.styles.textColor = [16, 185, 129];
                    hookData.cell.styles.fontStyle = "bold";
                } else if (val === "Keluar") {
                    hookData.cell.styles.textColor = [239, 68, 68];
                    hookData.cell.styles.fontStyle = "bold";
                }
            }
            // Warnai kolom Nominal
            if (hookData.section === "body" && hookData.column.index === 4) {
                const rowIdx = hookData.row.index;
                const exp = data.expenses[rowIdx];
                if (exp) {
                    hookData.cell.styles.textColor = exp.type === "income" ? [16, 185, 129] : [239, 68, 68];
                }
            }
        },
    });

    // ── Footer tanda tangan ────────────────────────
    const finalY = (doc as any).lastAutoTable?.finalY ?? y + 40;
    const footerY = finalY + 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Dicetak pada ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageWidth - margin, footerY, { align: "right" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text("Pengelola Kost Annisa", pageWidth - margin - 10, footerY + 20, { align: "center" });
    // Garis tanda tangan
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - margin - 40, footerY + 22, pageWidth - margin + 20, footerY + 22);

    return doc;
}

export function ReportDownloadDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const today = format(new Date(), "yyyy-MM-dd");
    const firstDay = format(new Date(), "yyyy-MM-01");
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(today);
    const [isDownloading, setIsDownloading] = useState(false);
    const [pdfBlob, setPdfBlob] = useState<{ url: string; file: File; filename: string } | null>(null);

    const handleGenerate = async () => {
        try {
            setIsDownloading(true);
            const data: any = await api.getExpensesReport(startDate, endDate);
            const doc = buildPDF(data, startDate, endDate);
            const filename = `Laporan_Kas_KostAnnisa_${startDate}_sd_${endDate}.pdf`;

            // Convert to Blob instead of force downlod
            const blob = doc.output('blob');
            const file = new File([blob], filename, { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            setPdfBlob({ url, file, filename });
            toast.success("Laporan PDF berhasil dibuat!");
        } catch (err: any) {
            console.error("PDF Error:", err);
            toast.error(err.message || "Gagal membuat laporan PDF");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            if (pdfBlob?.url) URL.revokeObjectURL(pdfBlob.url);
            setPdfBlob(null);
        }
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-blue-600" /> Unduh Laporan Keuangan
                    </DialogTitle>
                    <DialogDescription>
                        Pilih rentang tanggal untuk ditarik datanya menjadi dokumen PDF resmi (Kop Surat).
                    </DialogDescription>
                </DialogHeader>

                {!pdfBlob ? (
                    <>
                        <div className="flex flex-col gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Dari Tanggal</Label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Sampai Tanggal</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="default"
                                disabled={isDownloading}
                                onClick={handleGenerate}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isDownloading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <FileText className="w-4 h-4 mr-2" />
                                )}
                                Buat Laporan PDF
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-1 text-center">
                            <p className="font-semibold text-slate-800 text-lg">Laporan Siap!</p>
                            <p className="text-sm text-slate-500 break-all px-4">{pdfBlob.filename}</p>
                        </div>
                        <div className="flex w-full gap-3 mt-4 px-2">
                            <Button
                                className="flex-1"
                                variant="outline"
                                onClick={async () => {
                                    try {
                                        if (Capacitor.isNativePlatform()) {
                                            // Native: simpan ke folder Downloads via Capacitor Filesystem
                                            const reader = new FileReader();
                                            reader.onloadend = async () => {
                                                const base64Data = (reader.result as string).split(',')[1];
                                                await Filesystem.writeFile({
                                                    path: pdfBlob.filename,
                                                    data: base64Data,
                                                    directory: Directory.Documents,
                                                });
                                                toast.success(`PDF disimpan di folder Documents/${pdfBlob.filename}`);
                                            };
                                            reader.readAsDataURL(pdfBlob.file);
                                        } else {
                                            // Web fallback
                                            const a = document.createElement("a");
                                            a.href = pdfBlob.url;
                                            a.download = pdfBlob.filename;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            toast.success("Berhasil mengunduh PDF");
                                        }
                                    } catch (err: any) {
                                        console.error("Save error:", err);
                                        toast.error("Gagal menyimpan PDF: " + (err.message || ""));
                                    }
                                }}
                            >
                                <Download className="w-4 h-4 mr-2" /> Simpan
                            </Button>
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={async () => {
                                    try {
                                        if (Capacitor.isNativePlatform()) {
                                            // Native: simpan temp file lalu share via native share sheet
                                            const reader = new FileReader();
                                            reader.onloadend = async () => {
                                                try {
                                                    const base64Data = (reader.result as string).split(',')[1];
                                                    // Simpan file sementara untuk di-share
                                                    const savedFile = await Filesystem.writeFile({
                                                        path: pdfBlob.filename,
                                                        data: base64Data,
                                                        directory: Directory.Cache,
                                                    });
                                                    // Buka native share sheet (WhatsApp, Telegram, dll)
                                                    await Share.share({
                                                        title: "Laporan Kas Kost Annisa",
                                                        text: "Berikut lampiran Laporan Kas Kost Annisa.",
                                                        url: savedFile.uri,
                                                        dialogTitle: "Bagikan Laporan PDF",
                                                    });
                                                } catch (err: any) {
                                                    if (err.message !== 'Share canceled') {
                                                        console.error("Share error:", err);
                                                        toast.error("Gagal membagikan file.");
                                                    }
                                                }
                                            };
                                            reader.readAsDataURL(pdfBlob.file);
                                        } else {
                                            // Web fallback: gunakan Web Share API jika tersedia
                                            if (navigator.canShare && navigator.canShare({ files: [pdfBlob.file] })) {
                                                await navigator.share({
                                                    files: [pdfBlob.file],
                                                    title: "Laporan Kas Kost Annisa",
                                                    text: "Berikut lampiran Laporan Kas Kost Annisa."
                                                });
                                            } else {
                                                // Fallback: langsung download
                                                const a = document.createElement("a");
                                                a.href = pdfBlob.url;
                                                a.download = pdfBlob.filename;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                toast.info("PDF telah diunduh. Silakan share secara manual via WhatsApp.");
                                            }
                                        }
                                    } catch (err: any) {
                                        if (err.name !== 'AbortError') {
                                            console.error("Share error:", err);
                                            toast.error("Gagal membagikan file.");
                                        }
                                    }
                                }}
                            >
                                <Share2 className="w-4 h-4 mr-2" /> Bagikan
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
