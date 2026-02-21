"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, DoorOpen, FileText, Receipt, Settings, BarChart2, Shield } from "lucide-react";
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
    const { role } = useAppStore();

    const items = [...dockItems];
    if (role === 'admin_utama') {
        items.push({ name: "Tim", href: "/users", icon: Shield });
    }

    return (
        <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
            style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
        >
            {/* Floating pill dock */}
            <div
                className="pointer-events-auto mx-3 max-w-[95vw] rounded-2xl border border-white/30 shadow-[0_8px_40px_rgba(0,0,0,0.12),0_2px_12px_rgba(0,0,0,0.08)]"
                style={{
                    background: "rgba(255, 255, 255, 0.72)",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                }}
            >
                {/* Gradient fade indicators */}
                <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-5 z-10 bg-gradient-to-r from-white/60 to-transparent rounded-l-2xl pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-5 z-10 bg-gradient-to-l from-white/60 to-transparent rounded-r-2xl pointer-events-none" />

                    <nav
                        className="flex items-stretch overflow-x-auto scrollbar-hide px-2 py-2 gap-0.5"
                        style={{
                            WebkitOverflowScrolling: "touch",
                        }}
                    >
                        {items.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        "flex flex-col items-center justify-center min-w-[56px] px-2.5 py-1.5 rounded-xl transition-all duration-200 select-none shrink-0",
                                        "active:scale-[0.85]",
                                        isActive
                                            ? "bg-slate-800 text-white shadow-md shadow-slate-800/30"
                                            : "text-slate-500 hover:bg-black/5 hover:text-slate-700"
                                    )}
                                >
                                    <item.icon className={cn(
                                        "w-[18px] h-[18px] mb-0.5 transition-transform duration-200",
                                        isActive && "drop-shadow-sm"
                                    )} />
                                    <span className={cn(
                                        "text-[9px] font-semibold leading-tight tracking-tight",
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
        </div>
    );
}
