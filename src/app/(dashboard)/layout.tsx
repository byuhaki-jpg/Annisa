import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileDock } from "@/components/layout/mobile-dock";
import { Suspense } from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 w-full">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <Suspense fallback={<div className="h-16 border-b shrink-0 flex items-center justify-center text-sm text-slate-500">Loading...</div>}>
                    <Topbar />
                </Suspense>
                <main className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8 relative">
                    <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-sm text-slate-500">Loading...</div>}>
                        {children}
                    </Suspense>
                </main>
            </div>
            <MobileDock />
        </div>
    );
}
