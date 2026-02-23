"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, DoorOpen, FileText, Receipt, Settings, BarChart2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Tagihan", href: "/invoices", icon: FileText },
    { name: "Kas Operasional", href: "/expenses", icon: Receipt },
    { name: "Laporan", href: "/report", icon: BarChart2 },
    { name: "Penghuni", href: "/tenants", icon: Users },
    { name: "Kamar", href: "/rooms", icon: DoorOpen },
    { name: "Pengaturan", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { role } = useAppStore();

    const links = [...navigation];
    if (role === 'admin_utama') {
        links.push({ name: "Kelola Tim", href: "/users", icon: Shield });
    }

    return (
        <div className="hidden md:flex bg-slate-900 border-r text-slate-100 flex-col w-64 h-full shrink-0">
            <div className="p-5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://blogger.googleusercontent.com/img/a/AVvXsEiPO3Ehdp9v2r7JuQM9VTvIKbpwCv316_f7uxT_fS_3HR-ef7RFBDO2s1XX0H8DJM-urPA8HHFcRDakcxyIgQ21qKqlgATWhipN5IxJiMrEZO-JAOUXeoeZ26xp4Y3pkt8AUM-Hd4YCA5SLq7N7JkPQ8W6WnR2kcfbVLMlKOryK2dYihdQOMjgoTgXTT_YS" alt="Kos Annisa" className="w-10 h-10 rounded-lg object-contain bg-white/10 p-0.5" />
                <h1 className="text-xl font-bold tracking-tight text-white">Kost Annisa</h1>
            </div>
            <nav className="flex-1 px-4 space-y-1">
                {links.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                isActive
                                    ? "bg-slate-800 text-white"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
                &copy; {new Date().getFullYear()} Kost Annisa
            </div>
        </div>
    );
}
