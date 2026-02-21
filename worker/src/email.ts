/**
 * Email service using Resend API
 */

export async function sendResetPasswordEmail(
    resendApiKey: string,
    toEmail: string,
    resetLink: string,
    userName: string | null,
): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'Kost Annisa <onboarding@resend.dev>',
            to: [toEmail],
            subject: 'Reset Password - Kost Annisa',
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; padding: 40px 0;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #1e3a5f, #3b82f6); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🏠 Kost Annisa</h1>
      <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px;">Reset Password</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Halo <strong>${userName || 'Pengguna'}</strong>,
      </p>
      <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
        Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk membuat password baru:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(59,130,246,0.3);">
          Reset Password
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
        Link ini berlaku selama <strong>15 menit</strong>. Jika Anda tidak meminta reset password, abaikan email ini.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #cbd5e1; font-size: 11px; text-align: center;">
        © 2026 Kost Annisa · Email otomatis, jangan dibalas
      </p>
    </div>
  </div>
</body>
</html>`,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gagal kirim email: ${text}`);
    }
}
