/**
 * Dispara o ciclo de pings — usado pelo Cron Job do Render.
 * Requer: API_URL (ou RENDER_EXTERNAL_URL) e CRON_SECRET
 */
const baseUrl = (process.env.API_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const secret = process.env.CRON_SECRET;

if (!baseUrl) {
  console.error('API_URL não configurada');
  process.exit(1);
}

if (!secret) {
  console.error('CRON_SECRET não configurado');
  process.exit(1);
}

const url = `${baseUrl}/api/cron/ping`;

try {
  const res = await fetch(url, {
    headers: { 'x-cron-secret': secret },
  });
  const body = await res.text();
  console.log(`[${res.status}] ${body}`);

  if (!res.ok) {
    process.exit(1);
  }
} catch (err) {
  console.error('Falha ao chamar cron:', err);
  process.exit(1);
}
