import axios from 'axios';

/**
 * Envia alerta via CallMeBot (WhatsApp).
 * Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */
export async function sendWhatsAppMessage(
  phone: string,
  apiKey: string,
  text: string
): Promise<void> {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    throw new Error('Número WhatsApp inválido. Use DDI+DDD+número (ex: 5585999999999)');
  }
  if (!apiKey?.trim()) {
    throw new Error('API Key do CallMeBot não informada');
  }

  // CallMeBot aceita com ou sem +; usamos + para formato internacional
  const phoneParam = digits.startsWith('+') ? digits : `+${digits}`;

  const res = await axios.get('https://api.callmebot.com/whatsapp.php', {
    params: {
      phone: phoneParam,
      text,
      apikey: apiKey.trim(),
      source: 'analytic-pulse',
    },
    timeout: 20_000,
    validateStatus: () => true,
  });

  const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  const lower = body.toLowerCase();

  // CallMeBot retorna 200 mesmo em erro — ler o body
  if (
    lower.includes('invalid api') ||
    lower.includes('not associated') ||
    lower.includes('bad request') ||
    lower.includes('not activated') ||
    lower.includes('not allowed') ||
    lower.includes('error')
  ) {
    throw new Error(`CallMeBot: ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250)}`);
  }

  if (
    !lower.includes('queued') &&
    !lower.includes('message sent') &&
    !lower.includes('ok') &&
    res.status >= 400
  ) {
    throw new Error(`CallMeBot (${res.status}): ${body.slice(0, 200)}`);
  }
}

export function formatAlertMessage(
  monitorName: string,
  monitorUrl: string,
  isUp: boolean,
  statusCode: number | null,
  errorMessage: string | null
): string {
  const timestamp = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
  });
  const icon = isUp ? '✅' : '🔴';
  const statusText = isUp ? 'ONLINE' : 'OFFLINE';

  let message = `${icon} ${monitorName} está ${statusText}\n\n`;
  message += `URL: ${monitorUrl}\n`;
  if (statusCode) message += `HTTP: ${statusCode}\n`;
  if (errorMessage) message += `Erro: ${errorMessage}\n`;
  message += `\n${timestamp}\n— Analytic Pulse`;

  return message;
}
