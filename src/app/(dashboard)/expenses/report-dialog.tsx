"use client";

import { useState, useRef } from "react";
import { format } from "date-fns";
import { Loader2, Download, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const CATEGORY_LABELS: Record<string, string> = {
    listrik: "Listrik", air: "Air", wifi: "WiFi / Internet",
    kebersihan: "Kebersihan", perbaikan: "Perbaikan", modal: "Modal Kas", lainnya: "Lainnya"
};

const METHOD_LABELS: Record<string, string> = { transfer: "Transfer", cash: "Tunai", other: "Lainnya" };

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
    const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'jpg' | null>(null);

    const reportRef = useRef<HTMLDivElement>(null);
    const [reportData, setReportData] = useState<any>(null);

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

    // This handles the process of fetching the data, waiting for the states to reflect in DOM, then screenshotting
    const handleDownload = async (formatType: 'pdf' | 'jpg') => {
        try {
            setDownloadingFormat(formatType);
            const data = await api.getExpensesReport(startDate, endDate);
            setReportData(data);

            // Wait for React to render the invisible report visually in the DOM
            // We use a small timeout to ensure DOM update is fully completed
            setTimeout(async () => {
                const element = reportRef.current;
                if (!element) {
                    toast.error("Gagal merender dokumen");
                    setDownloadingFormat(null);
                    return;
                }

                // Temporary make it visible but absolute and off-screen to screenshot it correctly
                element.style.display = 'block';

                // Yield to visually render
                await new Promise((resolve) => setTimeout(resolve, 100));

                try {
                    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
                    const imgData = canvas.toDataURL("image/jpeg", 1.0);

                    const filename = `Laporan_Kas_KostAnnisa_${startDate}_to_${endDate}`;

                    if (formatType === 'jpg') {
                        const link = document.createElement('a');
                        link.href = imgData;
                        link.download = `${filename}.jpg`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    } else if (formatType === 'pdf') {
                        // A4 size: 210 x 297 mm
                        const pdf = new jsPDF("p", "mm", "a4");
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        // Scale height proportionally
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                        pdf.save(`${filename}.pdf`);
                    }

                    toast.success(`Laporan berhasil diunduh sebagai ${formatType.toUpperCase()}`);
                    onOpenChange(false);
                } catch (err: any) {
                    console.error("PDF Render Error:", err);
                    toast.error("Gagal membuat file " + formatType.toUpperCase());
                } finally {
                    element.style.display = 'none';
                    setDownloadingFormat(null);
                    setReportData(null);
                }
            }, 300);

        } catch (err: any) {
            toast.error(err.message || "Gagal menarik data dari server.");
            setDownloadingFormat(null);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Download className="w-5 h-5 text-blue-600" /> Unduh Laporan Keuangan
                        </DialogTitle>
                        <DialogDescription>
                            Pilih rentang tanggal untuk ditarik datanya menjadi dokumen resmi (Kop Surat).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Dari Tanggal</Label>
                                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Sampai Tanggal</Label>
                                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
                        <Button
                            variant="default"
                            disabled={downloadingFormat !== null}
                            onClick={() => handleDownload('pdf')}
                            className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700"
                        >
                            {downloadingFormat === 'pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                            Unduh sbg PDF
                        </Button>
                        <Button
                            variant="outline"
                            disabled={downloadingFormat !== null}
                            onClick={() => handleDownload('jpg')}
                            className="w-full sm:w-1/2"
                        >
                            {downloadingFormat === 'jpg' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2 text-blue-600" />}
                            Unduh sbg JPG
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invisible Report Template for html2canvas */}
            <div
                ref={reportRef}
                style={{
                    display: 'none',
                    position: 'absolute',
                    left: '-9999px',
                    top: '-9999px',
                    width: '800px', // Fixed A4 proportion width for rendering
                    background: 'white',
                    color: 'black',
                    padding: '40px',
                    fontFamily: 'sans-serif'
                }}
            >
                {reportData && (
                    <div className="flex flex-col">
                        {/* Header/Kop Surat */}
                        <div className="flex flex-col items-center border-b-[3px] border-black pb-4 mb-6">
                            <h1 className="text-3xl font-bold uppercase tracking-widest text-black">Kost Annisa</h1>
                            <p className="text-gray-600">Sistem Manajemen Keuangan</p>
                            <h2 className="text-xl font-bold mt-4 uppercase">Laporan Kas Operasional</h2>
                            <p className="text-sm font-medium text-gray-500 mt-1">Periode: {format(new Date(startDate), "dd MMM yyyy")} s/d {format(new Date(endDate), "dd MMM yyyy")}</p>
                        </div>

                        {/* Summary Blocks */}
                        <div className="flex justify-between gap-4 mb-6">
                            <div className="flex-1 p-4 border border-gray-300 rounded-lg">
                                <p className="text-sm text-gray-500 font-bold">TOTAL PEMASUKAN</p>
                                <p className="text-xl font-bold text-emerald-600">{formatCurrency(reportData.total_income)}</p>
                            </div>
                            <div className="flex-1 p-4 border border-gray-300 rounded-lg">
                                <p className="text-sm text-gray-500 font-bold">TOTAL PENGELUARAN</p>
                                <p className="text-xl font-bold text-rose-600">{formatCurrency(reportData.total_expense)}</p>
                            </div>
                            <div className="flex-1 p-4 border border-gray-300 rounded-lg">
                                <p className="text-sm text-gray-500 font-bold">SISA SALDO</p>
                                <p className={`text-xl font-bold ${reportData.total_income - reportData.total_expense >= 0 ? "text-indigo-600" : "text-orange-600"}`}>
                                    {formatCurrency(reportData.total_income - reportData.total_expense)}
                                </p>
                            </div>
                        </div>

                        {/* Rincian Transaksi */}
                        <h3 className="text-lg font-bold mb-3 border-b pb-2">Rincian Transaksi</h3>
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2 font-bold w-24">Tanggal</th>
                                    <th className="border p-2 font-bold w-24">Jenis</th>
                                    <th className="border p-2 font-bold">Kategori & Keterangan</th>
                                    <th className="border p-2 font-bold text-center w-24">Metode</th>
                                    <th className="border p-2 font-bold text-right w-32">Nominal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.expenses.length === 0 ? (
                                    <tr><td colSpan={5} className="border p-4 text-center text-gray-500">Tidak ada transaksi di periode ini</td></tr>
                                ) : (
                                    reportData.expenses.map((exp: any) => (
                                        <tr key={exp.id}>
                                            <td className="border p-2 text-gray-700">{exp.expense_date}</td>
                                            <td className="border p-2">
                                                <span className={exp.type === 'income' ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-medium'}>
                                                    {exp.type === 'income' ? 'Masuk' : 'Keluar'}
                                                </span>
                                            </td>
                                            <td className="border p-2">
                                                <div className="font-semibold text-gray-800">{CATEGORY_LABELS[exp.category] || exp.category}</div>
                                                {exp.notes && <div className="text-gray-500 text-xs mt-0.5">{exp.notes}</div>}
                                            </td>
                                            <td className="border p-2 text-center text-gray-600">{METHOD_LABELS[exp.method] || exp.method}</td>
                                            <td className={`border p-2 text-right font-bold ${exp.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {formatCurrency(exp.amount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        <div className="mt-12 flex justify-end">
                            <div className="text-center">
                                <p className="text-sm text-gray-500 mb-12">Dicetak pada {format(new Date(), "dd MMM yyyy HH:mm")}</p>
                                <p className="text-sm font-bold text-gray-800 underline decoration-gray-400 underline-offset-4">Pengelola Kost Annisa</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
