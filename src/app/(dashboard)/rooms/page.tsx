"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, DoorOpen } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RoomsPage() {

    const { data, isLoading } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => api.getRooms(),
    });

    const rooms = (data as any)?.rooms || [];

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Kamar</h2>
                    <p className="text-slate-500 mt-1 sm:mt-2 text-sm">Daftar kamar Kost Annisa beserta tarif bulanan</p>
                </div>
                {/* Future: Add Room button for Admin */}
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p>Memuat data kamar...</p>
                </div>
            ) : rooms.length === 0 ? (
                <div className="text-center py-20 border rounded-lg bg-white border-dashed text-slate-500">
                    <DoorOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>Belum ada kamar yang terdaftar di database.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room: any) => {
                        const occupantName = room.tenant_name;
                        const isOccupied = !!occupantName;

                        return (
                            <Card key={room.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                                <CardHeader className="bg-slate-50/50 pb-3 border-b">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-xl">Kamar {room.room_no}</CardTitle>
                                            <CardDescription className="mt-1">
                                                {isOccupied ? (
                                                    <span className="text-emerald-600 font-medium">Terisi</span>
                                                ) : (
                                                    <span className="text-slate-500">Kosong</span>
                                                )}
                                            </CardDescription>
                                        </div>
                                        <Badge variant={room.is_active ? "default" : "secondary"}>
                                            {room.is_active ? "Aktif" : "Non-aktif"}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium text-slate-500">Penghuni Saat Ini</span>
                                        <p className="text-base font-semibold text-slate-800">
                                            {isOccupied ? occupantName : <span className="text-slate-300 italic">Kosong</span>}
                                        </p>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <Label htmlFor={`rate-${room.room_no}`} className="text-slate-500">Tarif Bulanan</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-medium">Rp</span>
                                            <Input
                                                id={`rate-${room.room_no}`}
                                                type="text"
                                                value={new Intl.NumberFormat('id-ID').format(room.monthly_rate)}
                                                className="pl-9 bg-slate-50 font-medium"
                                                disabled
                                                readOnly
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
