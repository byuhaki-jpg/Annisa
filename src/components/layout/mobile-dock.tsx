"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, DoorOpen, FileText, Receipt, Settings, BarChart2, Shield, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useEffect, useRef, useState } from "react";

const dockItems = [
    { name: "Dash", href: "/dashboard", icon: LayoutDashboard },
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
    const scrollRef = useRef<HTMLDivElement>(null);

    const items = [...dockItems];
    if (role === 'admin_utama') {
        items.push({ name: "Tim", href: "/users", icon: Shield });
    }

    const renderItem = (item: any) => {
        const isActive = pathname.startsWith(item.href);
        return (
            <Link
                key={item.name}
                href={item.href}
                className={cn(
                    "flex flex-col items-center justify-center min-w-[70px] shrink-0 h-16 transition-all duration-300 active:scale-95 group",
                    isActive ? "text-blue-500" : "text-slate-800"
                )}
            >
                <div className={cn(
                    "relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300",
                    isActive ? "bg-blue-50" : "group-hover:bg-slate-100"
                )}>
                    <item.icon className={cn(
                        "w-[26px] h-[26px] transition-transform",
                        isActive ? "stroke-[2.5px]" : "stroke-[1.5px]"
                    )} />
                </div>
                <span className={cn(
                    "text-[12px] font-medium tracking-wide mt-0.5",
                    isActive ? "font-bold" : ""
                )}>
                    {item.name}
                </span>
            </Link>
        );
    };

    return (
        <div
            className="md:hidden fixed bottom-6 left-0 right-0 z-50 flex flex-col items-center pointer-events-none"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
            {/* Scan FAB Floating on top right somewhat */}
            <div className="absolute -top-16 right-4 pointer-events-auto">
                <button
                    onClick={() => setScannerOpen(true)}
                    className="w-14 h-14 rounded-full bg-[#1b9aee] text-white flex items-center justify-center shadow-lg active:scale-90 transition-all duration-200"
                >
                    <ScanLine className="w-[30px] h-[30px] stroke-[2px]" />
                </button>
            </div>

            {/* Main Pill Navbar */}
            <div className="pointer-events-auto mx-4 bg-white/95 backdrop-blur-md rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100/50 max-w-[95vw] overflow-hidden">
                <div
                    ref={scrollRef}
                    className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory flex-nowrap items-center px-2 h-[88px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {items.map(renderItem)}
                </div>
            </div>
        </div>
    );
}
