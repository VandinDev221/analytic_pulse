import { query } from '../lib/db';
import { sendTelegramMessage } from './telegramApi';

/**
 * Notifies the monitor owner if their service status changed.
 * Loads Telegram config from the notification_settings table.
 */
export async function notifyStatusChange(
  userId: string,
  monitorName: string,
  monitorUrl: string,
  isUp: boolean,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    const result = await query(
      `SELECT telegram_bot_token, telegram_chat_id, is_enabled 
       FROM notification_settings 
       WHERE user_id = $1`,
      [userId]
    );

    const settings = result.rows[0];

    if (!settings?.is_enabled || !settings.telegram_bot_token || !settings.telegram_chat_id) {
      return;
    }

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const icon = isUp ? '✅' : '🔴';
    const statusText = isUp ? 'ONLINE' : 'OFFLINE';

    let message = `${icon} <b>${monitorName}</b> está <b>${statusText}</b>\n\n`;
    message += `🔗 <code>${monitorUrl}</code>\n`;

    if (statusCode) {
      message += `📊 Status HTTP: <b>${statusCode}</b>\n`;
    }
    if (errorMessage) {
      message += `❌ Erro: <code>${errorMessage}</code>\n`;
    }

    message += `\n⏰ ${timestamp}`;
    message += `\n\n— <i>PingPulse Monitor</i>`;

    await sendTelegramMessage(
      { bot_token: settings.telegram_bot_token, chat_id: settings.telegram_chat_id },
      message
    );

    console.log(`📲 Telegram notification sent for monitor: ${monitorName}`);
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
  }
}
