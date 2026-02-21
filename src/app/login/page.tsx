"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Role } from "@/lib/types";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Building2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

function ForgotPasswordForm({ onClose }: { onClose: () => void }) {
    const [forgotEmail, setForgotEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        try {
            await api.forgotPassword(forgotEmail);
            setSent(true);
        } catch {
            toast.error("Gagal mengirim email. Coba lagi.");
        } finally {
            setSending(false);
        }
    };

    if (sent) {
        return (
            <>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        ✅ Email Terkirim
                    </DialogTitle>
                    <DialogDescription>
                        Jika email <span className="font-semibold">{forgotEmail}</span> terdaftar di sistem, link reset password sudah dikirim.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 mt-2">
                    <p className="font-medium mb-1">📧 Cek inbox email Anda:</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-700">
                        <li>Buka email dari <strong>Kost Annisa</strong></li>
                        <li>Klik tombol <strong>"Reset Password"</strong></li>
                        <li>Masukkan password baru (berlaku 15 menit)</li>
                    </ol>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                </DialogFooter>
            </>
        );
    }

    return (
        <form onSubmit={handleForgot}>
            <DialogHeader>
                <DialogTitle>Lupa Password?</DialogTitle>
                <DialogDescription>
                    Masukkan email akun Anda. Kami akan mengirim link untuk reset password.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        type="email"
                        placeholder="email@contoh.com"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
            <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                <Button type="submit" disabled={sending}>
                    {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Kirim Link Reset
                </Button>
            </DialogFooter>
        </form>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const { setRole } = useAppStore();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res: any = await api.login({ email, password });
            localStorage.setItem("auth_token", res.token);
            setRole(res.role as Role);
            toast.success("Login berhasil!");
            router.push("/dashboard");
        } catch (err: any) {
            toast.error(err.message || "Gagal login. Periksa email dan password.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950" />
            <div className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
                                      radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)`,
                }}
            />

            {/* Floating decorative elements */}
            <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

            {/* Login card */}
            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Kost Annisa
                    </h1>
                    <p className="text-blue-200/60 mt-1 text-sm">
                        Sistem Manajemen Keuangan Kos
                    </p>
                </div>

                {/* Card */}
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-blue-100">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/50" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="nama@email.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-blue-200/30 focus:border-blue-400 focus:ring-blue-400/20 h-11 rounded-xl"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-blue-100">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/50" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-blue-200/30 focus:border-blue-400 focus:ring-blue-400/20 h-11 rounded-xl"
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

                        {/* Forgot password */}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setForgotOpen(true)}
                                className="text-xs text-blue-300/70 hover:text-blue-200 transition-colors"
                            >
                                Lupa password?
                            </button>
                        </div>

                        {/* Submit */}
                        <Button
                            className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all duration-200 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Memverifikasi...
                                </>
                            ) : (
                                "Masuk"
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-blue-200/30 mt-6">
                    © 2026 Kost Annisa · Sistem Internal
                </p>
            </div>

            {/* Forgot Password Dialog */}
            <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <ForgotPasswordForm onClose={() => setForgotOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
