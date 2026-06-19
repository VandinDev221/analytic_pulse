import axios from 'axios';

export interface TelegramConfig {
  bot_token: string;
  chat_id: string;
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

export function getAppBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}

export async function registerTelegramWebhook(): Promise<void> {
  const token = getAppBotToken();
  if (!token) return;

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
    } else {
      console.warn('⚠️  Telegram setWebhook:', res.data?.description);
    }
  } catch (err) {
    console.error('Failed to register Telegram webhook:', err);
  }
}
