import type { AlertChannel, AlertChannelKind } from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import { sendTelegramMessage } from '../../../services/telegramApi';
import {
  formatAlertMessage,
  sendWhatsAppMessage,
} from '../../../services/whatsappService';

export interface AlertPayload {
  title: string;
  monitorName: string;
  monitorUrl: string;
  isUp: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  ruleName: string;
  metric: string;
  severity: string;
  latencyMs?: number | null;
}

export async function deliverToChannel(
  channel: AlertChannel,
  payload: AlertPayload
): Promise<void> {
  const text = buildPlainText(payload);
  const html = buildHtml(payload);
  const config = channel.config;

  switch (channel.kind as AlertChannelKind) {
    case 'telegram': {
      const botToken = String(config.bot_token || config.telegram_bot_token || '');
      const chatId = String(config.chat_id || config.telegram_chat_id || '');
      if (!botToken || !chatId) throw new Error('Telegram channel misconfigured');
      await sendTelegramMessage({ bot_token: botToken, chat_id: chatId }, html);
      return;
    }
    case 'whatsapp': {
      const phone = String(config.phone || config.whatsapp_phone || '');
      const apiKey = String(config.api_key || config.whatsapp_api_key || '');
      if (!phone || !apiKey) throw new Error('WhatsApp channel misconfigured');
      await sendWhatsAppMessage(phone, apiKey, text);
      return;
    }
    case 'webhook':
    case 'slack':
    case 'discord':
    case 'teams': {
      const url = String(config.url || '');
      if (!url) throw new Error(`${channel.kind} channel missing url`);
      const body =
        channel.kind === 'slack'
          ? { text }
          : channel.kind === 'discord'
            ? { content: text }
            : channel.kind === 'teams'
              ? {
                  '@type': 'MessageCard',
                  summary: payload.title,
                  themeColor: payload.isUp ? '22c55e' : 'ef4444',
                  title: payload.title,
                  text,
                }
              : {
                  ...payload,
                  message: text,
                  source: 'analytic-pulse',
                };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof config.headers === 'object' && config.headers
            ? (config.headers as Record<string, string>)
            : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Webhook HTTP ${res.status}`);
      }
      return;
    }
    case 'email': {
      const to = String(config.to || '');
      if (!to) throw new Error('Email channel missing to');
      if (!env.resendApiKey) throw new Error('RESEND_API_KEY not configured');

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.emailFrom || 'Analytic Pulse <onboarding@resend.dev>',
          to: [to],
          subject: payload.title,
          text,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Email failed: ${errText}`);
      }
      return;
    }
    default:
      throw new Error(`Unsupported channel kind: ${channel.kind}`);
  }
}

function buildPlainText(payload: AlertPayload): string {
  return formatAlertMessage(
    payload.monitorName,
    payload.monitorUrl,
    payload.isUp,
    payload.statusCode,
    payload.errorMessage
  );
}

function buildHtml(payload: AlertPayload): string {
  const icon = payload.isUp ? '✅' : '🔴';
  const status = payload.isUp ? 'ONLINE' : 'OFFLINE';
  const timestamp = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  let html = `${icon} <b>${payload.monitorName}</b> está <b>${status}</b>\n\n`;
  html += `📋 Regra: <b>${payload.ruleName}</b> (${payload.metric})\n`;
  html += `🔗 <code>${payload.monitorUrl}</code>\n`;
  if (payload.statusCode) html += `📊 Status HTTP: <b>${payload.statusCode}</b>\n`;
  if (payload.latencyMs != null) html += `⏱ Latência: <b>${payload.latencyMs} ms</b>\n`;
  if (payload.errorMessage) html += `❌ Erro: <code>${payload.errorMessage}</code>\n`;
  html += `\n⏰ ${timestamp}\n\n— <i>Analytic Pulse Alert Engine</i>`;
  return html;
}
