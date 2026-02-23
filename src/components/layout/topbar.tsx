"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parse } from "date-fns";
import { id } from "date-fns/locale";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { Role } from "@/lib/types";

export function Topbar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    const currentPeriod = searchParams.get("period") || format(new Date(), "yyyy-MM");
    const [currentYear, currentMonth] = currentPeriod.split("-");

    const p = pathname || "";
    const showMonthPicker = p.includes("/dashboard") || p.includes("/invoices") || p.includes("/expenses");

    // Generate years (e.g., 2024 to 2030)
    const currentRealYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => String(currentRealYear - 2 + i));

    // Generate months 01-12
    const monthsRaw = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));

    const handleYearChange = (val: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("period", `${val}-${currentMonth}`);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleMonthChange = (val: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("period", `${currentYear}-${val}`);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleLogout = () => {
        localStorage.removeItem("auth_token");
        router.push("/login");
    };

    return (
        <div className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b shrink-0 min-h-[4rem]"
            style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}>
            <div className="flex items-center gap-2 md:gap-4">
                {/* Mobile app title */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Kos Annisa" className="md:hidden w-7 h-7 rounded object-contain" />
                <span className="md:hidden text-sm font-bold text-slate-800 tracking-tight">Kost Annisa</span>

                {showMonthPicker && (
                    <div className="flex items-center gap-1 md:gap-2">
                        <span className="hidden sm:inline text-sm font-medium text-slate-500">Periode:</span>
                        <Select value={currentMonth} onValueChange={handleMonthChange}>
                            <SelectTrigger className="w-[100px] md:w-[140px] text-xs md:text-sm h-8 md:h-10">
                                <SelectValue placeholder="Pilih bulan" />
                            </SelectTrigger>
                            <SelectContent>
                                {monthsRaw.map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {format(parse(m, "MM", new Date()), "MMMM", { locale: id })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={currentYear} onValueChange={handleYearChange}>
                            <SelectTrigger className="w-[75px] md:w-[100px] text-xs md:text-sm h-8 md:h-10">
                                <SelectValue placeholder="Tahun" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map((y) => (
                                    <SelectItem key={y} value={y}>
                                        {y}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}
