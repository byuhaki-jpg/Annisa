"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

    const handleDownload = async () => {
        try {
            setIsDownloading(true);
            const data: any = await api.getExpensesReport(startDate, endDate);
            const doc = buildPDF(data, startDate, endDate);
            const filename = `Laporan_Kas_KostAnnisa_${startDate}_sd_${endDate}.pdf`;
            doc.save(filename);
            toast.success("Laporan PDF berhasil diunduh!");
            onOpenChange(false);
        } catch (err: any) {
            console.error("PDF Error:", err);
            toast.error(err.message || "Gagal membuat laporan PDF");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-blue-600" /> Unduh Laporan Keuangan
                    </DialogTitle>
                    <DialogDescription>
                        Pilih rentang tanggal untuk ditarik datanya menjadi dokumen PDF resmi (Kop Surat).
                    </DialogDescription>
                </DialogHeader>

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
                        onClick={handleDownload}
                        className="w-full bg-red-600 hover:bg-red-700"
                    >
                        {isDownloading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <FileText className="w-4 h-4 mr-2" />
                        )}
                        Unduh Laporan PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
