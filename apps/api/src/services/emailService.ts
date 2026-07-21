const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Analytic Pulse <onboarding@resend.dev>';

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY ausente. Código para ${email}: ${code}`);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Serviço de e-mail não configurado');
    }
    return;
  }

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#6366f1;margin:0 0 8px">Analytic Pulse</h2>
      <p style="color:#52525b;margin:0 0 24px">Use o código abaixo para confirmar seu cadastro:</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b">${code}</span>
      </div>
      <p style="color:#71717a;font-size:13px;margin:0">Válido por 15 minutos. Se você não solicitou, ignore este e-mail.</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email],
      subject: `${code} — confirme seu cadastro no Analytic Pulse`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error:', res.status, body);
    throw new Error('Falha ao enviar e-mail de verificação');
  }
}
