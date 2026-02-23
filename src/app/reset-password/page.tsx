"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            return toast.error("Password minimal 6 karakter");
        }
        if (password !== confirmPassword) {
            return toast.error("Konfirmasi password tidak cocok");
        }

        setIsLoading(true);
        try {
            await api.resetPassword(token, password);
            setSuccess(true);
            toast.success("Password berhasil direset!");
        } catch (err: any) {
            toast.error(err.message || "Gagal reset password. Link mungkin sudah kedaluwarsa.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950" />
                <div className="relative z-10 text-center">
                    <p className="text-red-300 text-lg">Link reset tidak valid.</p>
                    <Button variant="link" className="text-blue-300 mt-4" onClick={() => router.push("/login")}>
                        Kembali ke Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full items-center justify-center relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950" />
            <div className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
                                      radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)`,
                }}
            />
            <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />

            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/90 shadow-lg shadow-blue-500/25 mb-4 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="https://blogger.googleusercontent.com/img/a/AVvXsEiPO3Ehdp9v2r7JuQM9VTvIKbpwCv316_f7uxT_fS_3HR-ef7RFBDO2s1XX0H8DJM-urPA8HHFcRDakcxyIgQ21qKqlgATWhipN5IxJiMrEZO-JAOUXeoeZ26xp4Y3pkt8AUM-Hd4YCA5SLq7N7JkPQ8W6WnR2kcfbVLMlKOryK2dYihdQOMjgoTgXTT_YS" alt="Kos Annisa" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Reset Password</h1>
                    <p className="text-blue-200/60 mt-1 text-sm">Kost Annisa</p>
                </div>

                {/* Card */}
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8">
                    {success ? (
                        <div className="text-center py-4 space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-2">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white">Password Berhasil Direset!</h2>
                            <p className="text-blue-200/60 text-sm">Silakan login dengan password baru Anda.</p>
                            <Button
                                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold mt-4"
                                onClick={() => router.push("/login")}
                            >
                                Masuk ke Login
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-blue-100">Password Baru</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/50" />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        minLength={6}
                                        placeholder="Min. 6 karakter"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-blue-200/30 focus:border-blue-400 h-11 rounded-xl"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/50 hover:text-blue-200 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-blue-100">Konfirmasi Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/50" />
                                    <Input
                                        type="password"
                                        required
                                        minLength={6}
                                        placeholder="Ketik ulang password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-blue-200/30 focus:border-blue-400 h-11 rounded-xl"
                                    />
                                </div>
                            </div>

                            <Button
                                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all duration-200"
                                type="submit"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    "Simpan Password Baru"
                                )}
                            </Button>
                        </form>
                    )}
                </div>

                <p className="text-center text-xs text-blue-200/30 mt-6">
                    <button onClick={() => router.push("/login")} className="hover:text-blue-200 transition-colors">
                        ← Kembali ke halaman Login
                    </button>
                </p>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
