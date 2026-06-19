import { query } from '../lib/db';
import { sendTelegramMessage } from './telegramApi';
import { sendWhatsAppMessage, formatAlertMessage } from './whatsappService';

export type NotificationChannel = 'telegram' | 'whatsapp';

interface NotificationRow {
  notification_channel: NotificationChannel;
  is_enabled: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  whatsapp_phone?: string;
  whatsapp_api_key?: string;
}

export async function sendAlertNotification(
  userId: string,
  monitorName: string,
  monitorUrl: string,
  isUp: boolean,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  const result = await query(
    `SELECT notification_channel, telegram_bot_token, telegram_chat_id,
            whatsapp_phone, whatsapp_api_key, is_enabled
     FROM notification_settings WHERE user_id = $1`,
    [userId]
  );

  const settings: NotificationRow | undefined = result.rows[0];
  if (!settings?.is_enabled) return;

  const channel = settings.notification_channel || 'telegram';
  const text = formatAlertMessage(
    monitorName,
    monitorUrl,
    isUp,
    statusCode,
    errorMessage
  );

  if (channel === 'whatsapp') {
    if (!settings.whatsapp_phone || !settings.whatsapp_api_key) return;
    await sendWhatsAppMessage(
      settings.whatsapp_phone,
      settings.whatsapp_api_key,
      text
    );
    console.log(`📲 WhatsApp notification sent for monitor: ${monitorName}`);
    return;
  }

  if (!settings.telegram_bot_token || !settings.telegram_chat_id) return;

  const timestamp = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  const icon = isUp ? '✅' : '🔴';
  const statusText = isUp ? 'ONLINE' : 'OFFLINE';

  let html = `${icon} <b>${monitorName}</b> está <b>${statusText}</b>\n\n`;
  html += `🔗 <code>${monitorUrl}</code>\n`;
  if (statusCode) html += `📊 Status HTTP: <b>${statusCode}</b>\n`;
  if (errorMessage) html += `❌ Erro: <code>${errorMessage}</code>\n`;
  html += `\n⏰ ${timestamp}\n\n— <i>Analytic Pulse</i>`;

  await sendTelegramMessage(
    {
      bot_token: settings.telegram_bot_token,
      chat_id: settings.telegram_chat_id,
    },
    html
  );
  console.log(`📲 Telegram notification sent for monitor: ${monitorName}`);
}

/** @deprecated use sendAlertNotification */
export async function notifyStatusChange(
  userId: string,
  monitorName: string,
  monitorUrl: string,
  isUp: boolean,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    await sendAlertNotification(
      userId,
      monitorName,
      monitorUrl,
      isUp,
      statusCode,
      errorMessage
    );
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

export async function sendTestNotification(userId: string): Promise<void> {
  await sendAlertNotification(
    userId,
    'Teste Analytic Pulse',
    'https://analytic-pulse.vercel.app',
    true,
    200,
    null
  );
}
