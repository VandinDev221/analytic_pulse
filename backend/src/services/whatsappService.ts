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
  const normalizedPhone = phone.replace(/\D/g, '');
  const res = await axios.get('https://api.callmebot.com/whatsapp.php', {
    params: {
      phone: normalizedPhone,
      text,
      apikey: apiKey,
    },
    timeout: 15_000,
    validateStatus: () => true,
  });

  const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  if (res.status >= 400 || /error|fail/i.test(body)) {
    throw new Error(`WhatsApp API: ${body.slice(0, 200)}`);
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

  let message = `${icon} *${monitorName}* está *${statusText}*\n\n`;
  message += `🔗 ${monitorUrl}\n`;
  if (statusCode) message += `📊 HTTP: ${statusCode}\n`;
  if (errorMessage) message += `❌ ${errorMessage}\n`;
  message += `\n⏰ ${timestamp}\n— Analytic Pulse`;

  return message;
}
