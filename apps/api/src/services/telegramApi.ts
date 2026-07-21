import axios from 'axios';
import { query } from '../infrastructure/db';

export interface TelegramConfig {
  bot_token: string;
  chat_id: string;
}

let cachedBotToken: string | null | undefined;

/** Token do env ou do primeiro usuário que configurou no dashboard. */
export async function resolveBotToken(): Promise<string | undefined> {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return process.env.TELEGRAM_BOT_TOKEN;
  }
  if (cachedBotToken !== undefined) {
    return cachedBotToken ?? undefined;
  }
  try {
    const result = await query(
      `SELECT telegram_bot_token FROM notification_settings
       WHERE telegram_bot_token IS NOT NULL AND telegram_bot_token != ''
       LIMIT 1`
    );
    cachedBotToken = result.rows[0]?.telegram_bot_token ?? null;
  } catch {
    cachedBotToken = null;
  }
  return cachedBotToken ?? undefined;
}

export function getAppBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;
  await axios.post(url, {
    chat_id: config.chat_id,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

export async function registerTelegramWebhook(): Promise<boolean> {
  const token = await resolveBotToken();
  if (!token) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN não configurado — comandos do bot desativados');
    return false;
  }

  const baseUrl =
    process.env.API_PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://analytic-pulse-api.onrender.com';

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  try {
    const body: Record<string, string> = { url: webhookUrl };
    if (secret) body.secret_token = secret;

    const res = await axios.post(
      `https://api.telegram.org/bot${token}/setWebhook`,
      body
    );

    if (res.data?.ok) {
      console.log(`✅ Telegram webhook: ${webhookUrl}`);
      return true;
    }
    console.warn('⚠️  Telegram setWebhook:', res.data?.description);
    return false;
  } catch (err) {
    console.error('Failed to register Telegram webhook:', err);
    return false;
  }
}

export async function getWebhookInfo(): Promise<unknown> {
  const token = await resolveBotToken();
  if (!token) return null;
  const res = await axios.get(
    `https://api.telegram.org/bot${token}/getWebhookInfo`
  );
  return res.data?.result;
}
