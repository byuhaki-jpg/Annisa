"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, DoorOpen, FileText, Receipt, Settings, BarChart2, Shield, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

const dockItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Tagihan", href: "/invoices", icon: FileText },
    { name: "Kas", href: "/expenses", icon: Receipt },
    { name: "Laporan", href: "/report", icon: BarChart2 },
    { name: "Penghuni", href: "/tenants", icon: Users },
    { name: "Kamar", href: "/rooms", icon: DoorOpen },
    { name: "Setting", href: "/settings", icon: Settings },
];

export function MobileDock() {
    const pathname = usePathname();
    const { role, setScannerOpen } = useAppStore();

    const items = [...dockItems];
    if (role === 'admin_utama') {
        items.push({ name: "Tim", href: "/users", icon: Shield });
    }

    const leftItems = items.slice(0, Math.ceil(items.length / 2));
    const rightItems = items.slice(Math.ceil(items.length / 2));

    return (
        <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
            {/* Floating pill dock */}
            <div
                className="pointer-events-auto w-full mx-2 rounded-t-2xl border border-b-0 border-white/40 shadow-[0_-4px_30px_rgba(0,0,0,0.12)]"
                style={{
                    background: "rgba(255, 255, 255, 0.82)",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                }}
            >
                <nav className="flex items-end justify-around px-1 pt-2 pb-3">
                    {leftItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex flex-col items-center justify-center min-w-[48px] px-1.5 py-1 rounded-xl transition-all duration-200 select-none",
                                    "active:scale-[0.85]",
                                    isActive
                                        ? "bg-slate-800 text-white shadow-md shadow-slate-800/30"
                                        : "text-slate-500 hover:bg-black/5 hover:text-slate-700"
                                )}
                            >
                                <item.icon className={cn(
                                    "w-5 h-5 mb-0.5 transition-transform duration-200",
                                    isActive && "drop-shadow-sm"
                                )} />
                                <span className={cn(
                                    "text-[10px] font-semibold leading-tight",
                                    isActive ? "text-white/90" : "text-slate-500"
                                )}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}

                    {/* Middle Scanner Button */}
                    <div className="flex flex-col items-center justify-end px-1 relative">
                        <button
                            onClick={() => setScannerOpen(true)}
                            className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/40 flex items-center justify-center transition-all duration-200 active:scale-90 -mt-5 border-[3px] border-white transform hover:-translate-y-1"
                        >
                            <ScanLine className="w-7 h-7" />
                        </button>
                        <span className="text-[10px] font-semibold text-indigo-600 mt-1 leading-tight">
                            Scan
                        </span>
                    </div>

                    {rightItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex flex-col items-center justify-center min-w-[48px] px-1.5 py-1 rounded-xl transition-all duration-200 select-none",
                                    "active:scale-[0.85]",
                                    isActive
                                        ? "bg-slate-800 text-white shadow-md shadow-slate-800/30"
                                        : "text-slate-500 hover:bg-black/5 hover:text-slate-700"
                                )}
                            >
                                <item.icon className={cn(
                                    "w-5 h-5 mb-0.5 transition-transform duration-200",
                                    isActive && "drop-shadow-sm"
                                )} />
                                <span className={cn(
                                    "text-[10px] font-semibold leading-tight",
                                    isActive ? "text-white/90" : "text-slate-500"
                                )}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
