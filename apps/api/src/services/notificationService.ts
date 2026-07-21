import { query } from '../infrastructure/db';
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

async function loadSettings(userId: string): Promise<NotificationRow | null> {
  const result = await query(
    `SELECT notification_channel, telegram_bot_token, telegram_chat_id,
            whatsapp_phone, whatsapp_api_key, is_enabled
     FROM notification_settings WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

function validateSettings(settings: NotificationRow | null): NotificationRow {
  if (!settings) {
    throw new Error('Salve as configurações antes de testar');
  }
  if (!settings.is_enabled) {
    throw new Error('Ative as notificações (checkbox) e salve');
  }

  const channel = settings.notification_channel || 'telegram';

  if (channel === 'whatsapp') {
    if (!settings.whatsapp_phone?.trim()) {
      throw new Error('Informe o número WhatsApp (DDI+DDD+número, ex: 5585999999999)');
    }
    if (!settings.whatsapp_api_key?.trim()) {
      throw new Error('Informe a API Key do CallMeBot. Ative em: wa.me/34644447167');
    }
  } else {
    if (!settings.telegram_bot_token?.trim() || !settings.telegram_chat_id?.trim()) {
      throw new Error('Informe Bot Token e Chat ID do Telegram');
    }
  }

  return settings;
}

export async function sendAlertNotification(
  userId: string,
  monitorName: string,
  monitorUrl: string,
  isUp: boolean,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  const settings = validateSettings(await loadSettings(userId));
  const channel = settings.notification_channel || 'telegram';
  const text = formatAlertMessage(
    monitorName,
    monitorUrl,
    isUp,
    statusCode,
    errorMessage
  );

  if (channel === 'whatsapp') {
    await sendWhatsAppMessage(
      settings.whatsapp_phone!,
      settings.whatsapp_api_key!,
      text
    );
    console.log(`📲 WhatsApp notification sent for monitor: ${monitorName}`);
    return;
  }

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
      bot_token: settings.telegram_bot_token!,
      chat_id: settings.telegram_chat_id!,
    },
    html
  );
  console.log(`📲 Telegram notification sent for monitor: ${monitorName}`);
}

export async function notifyStatusChange(
  userId: string,
  monitorName: string,
  monitorUrl: string,
  isUp: boolean,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    const settings = await loadSettings(userId);
    if (!settings?.is_enabled) return;
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

export async function notifySslExpiring(
  userId: string,
  monitorName: string,
  monitorUrl: string,
  daysRemaining: number,
  validTo: string | null
): Promise<boolean> {
  try {
    const settings = await loadSettings(userId);
    if (!settings?.is_enabled) return false;
    const validated = validateSettings(settings);
    const channel = validated.notification_channel || 'telegram';
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    const text =
      `🔐 SSL — ${monitorName}\n\n` +
      `Certificado expira em ${daysRemaining} dia(s).\n` +
      `URL: ${monitorUrl}\n` +
      (validTo ? `Validade: ${validTo}\n` : '') +
      `\nRenove o certificado para evitar downtime.\n` +
      `${timestamp}\n— Analytic Pulse`;

    if (channel === 'whatsapp') {
      await sendWhatsAppMessage(
        validated.whatsapp_phone!,
        validated.whatsapp_api_key!,
        text
      );
      return true;
    }

    const html =
      `🔐 <b>SSL — ${monitorName}</b>\n\n` +
      `Certificado expira em <b>${daysRemaining}</b> dia(s).\n` +
      `🔗 <code>${monitorUrl}</code>\n` +
      (validTo ? `📅 Validade: <code>${validTo}</code>\n` : '') +
      `\nRenove o certificado para evitar downtime.\n` +
      `\n⏰ ${timestamp}\n\n— <i>Analytic Pulse</i>`;

    await sendTelegramMessage(
      {
        bot_token: validated.telegram_bot_token!,
        chat_id: validated.telegram_chat_id!,
      },
      html
    );
    return true;
  } catch (err) {
    console.error('Failed to send SSL expiry notification:', err);
    return false;
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
