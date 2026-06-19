import { query } from '../lib/db';
import { pingUrl } from './pingService';
import { sendTelegramMessage, resolveBotToken } from './telegramApi';

const DASHBOARD_URL =
  process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
  'https://analytic-pulse.vercel.app';

interface LinkedUser {
  user_id: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  is_enabled: boolean;
  email: string;
}

interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

async function findUserByChatId(chatId: string): Promise<LinkedUser | null> {
  const result = await query(
    `SELECT ns.user_id, ns.telegram_bot_token, ns.telegram_chat_id, ns.is_enabled, u.email
     FROM notification_settings ns
     JOIN users u ON u.id = ns.user_id
     WHERE ns.telegram_chat_id = $1`,
    [chatId]
  );
  return result.rows[0] ?? null;
}

async function replyConfig(chatId: number, user?: LinkedUser | null): Promise<{
  bot_token: string;
  chat_id: string;
} | null> {
  const token = user?.telegram_bot_token || (await resolveBotToken());
  if (!token) return null;
  return { bot_token: token, chat_id: String(chatId) };
}

async function reply(
  chatId: number,
  text: string,
  user?: LinkedUser | null
): Promise<void> {
  const config = await replyConfig(chatId, user);
  if (!config) {
    console.error('Telegram reply skipped: no bot token');
    return;
  }
  await sendTelegramMessage(config, text);
}

function parseCommand(text: string): { command: string; args: string } {
  const first = text.trim().split(/\s+/)[0] ?? '';
  const command = first.split('@')[0].toLowerCase();
  const args = text.trim().slice(first.length).trim();
  return { command, args };
}

function statusIcon(status: string): string {
  if (status === 'up') return '🟢';
  if (status === 'down') return '🔴';
  if (status === 'active') return '🟡';
  return '⚪';
}

async function cmdStart(chatId: number): Promise<void> {
  await reply(
    chatId,
    `👋 <b>Bem-vindo ao Analytic Pulse!</b>

Monitor de uptime com alertas em tempo real.

<b>Seu Chat ID:</b> <code>${chatId}</code>

Cole esse ID no painel → <b>Notificações</b> para vincular sua conta.

📊 <a href="${DASHBOARD_URL}">Abrir dashboard</a>

Use /help para ver todos os comandos.`
  );
}

async function cmdHelp(chatId: number): Promise<void> {
  await reply(
    chatId,
    `📖 <b>Comandos disponíveis</b>

/start — Boas-vindas e Chat ID
/help — Esta ajuda
/status — Resumo dos monitores
/monitors — Lista de monitores
/uptime — Uptime 7 dias
/alerts — Status dos alertas
/alerts on — Ativar alertas
/alerts off — Desativar alertas
/test — Alerta de teste
/ping URL — Testar um site
/settings — Suas configurações
/dashboard — Link do painel
/about — Sobre o app`
  );
}

async function cmdAbout(chatId: number): Promise<void> {
  await reply(
    chatId,
    `ℹ️ <b>Analytic Pulse</b>

Monitor open-source de disponibilidade de sites e APIs.

• Pings a cada minuto
• Alertas via Telegram
• Gráficos de latência
• Status page pública

<a href="${DASHBOARD_URL}">${DASHBOARD_URL}</a>`
  );
}

async function cmdDashboard(chatId: number): Promise<void> {
  await reply(
    chatId,
    `📊 <b>Dashboard</b>\n\n<a href="${DASHBOARD_URL}">Acessar Analytic Pulse</a>`
  );
}

async function requireLinked(
  chatId: number
): Promise<LinkedUser | null> {
  const user = await findUserByChatId(String(chatId));
  if (!user) {
    await reply(
      chatId,
      `⚠️ Conta não vinculada.

1. Acesse o <a href="${DASHBOARD_URL}">dashboard</a>
2. Aba <b>Notificações</b>
3. Cole seu Chat ID: <code>${chatId}</code>
4. Salve e envie /start novamente`
    );
    return null;
  }
  return user;
}

async function cmdStatus(chatId: number, user: LinkedUser): Promise<void> {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'up') AS up_count,
       COUNT(*) FILTER (WHERE status = 'down') AS down_count,
       COUNT(*) FILTER (WHERE status = 'active') AS pending_count,
       COUNT(*) FILTER (WHERE status = 'inactive') AS inactive_count,
       COUNT(*) AS total
     FROM monitors WHERE user_id = $1`,
    [user.user_id]
  );
  const s = result.rows[0];
  await reply(
    chatId,
    `📊 <b>Resumo</b> (${user.email})

🟢 Online: <b>${s.up_count}</b>
🔴 Offline: <b>${s.down_count}</b>
🟡 Aguardando: <b>${s.pending_count}</b>
⚪ Pausados: <b>${s.inactive_count}</b>
━━━━━━━━━━━━━━
Total: <b>${s.total}</b> monitores`,
    user
  );
}

async function cmdMonitors(chatId: number, user: LinkedUser): Promise<void> {
  const result = await query(
    `SELECT name, url, status, last_checked_at, last_response_time_ms
     FROM monitors WHERE user_id = $1 AND status != 'inactive'
     ORDER BY name LIMIT 15`,
    [user.user_id]
  );
  if (result.rows.length === 0) {
    await reply(chatId, '📭 Nenhum monitor ativo. Crie um no dashboard.', user);
    return;
  }
  let msg = `📋 <b>Monitores ativos</b>\n\n`;
  for (const m of result.rows) {
    const latency = m.last_response_time_ms ? ` · ${m.last_response_time_ms}ms` : '';
    msg += `${statusIcon(m.status)} <b>${m.name}</b> — ${m.status.toUpperCase()}${latency}\n`;
    msg += `   <code>${m.url}</code>\n`;
  }
  if (result.rows.length === 15) msg += `\n<i>Mostrando até 15 monitores</i>`;
  await reply(chatId, msg, user);
}

async function cmdUptime(chatId: number, user: LinkedUser): Promise<void> {
  const result = await query(
    `SELECT m.name,
       ROUND(
         COUNT(*) FILTER (WHERE pl.is_up)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
       ) AS uptime_pct,
       COUNT(*) AS checks
     FROM monitors m
     LEFT JOIN ping_logs pl ON pl.monitor_id = m.id
       AND pl.created_at >= NOW() - INTERVAL '7 days'
     WHERE m.user_id = $1 AND m.status != 'inactive'
     GROUP BY m.id, m.name
     ORDER BY m.name
     LIMIT 15`,
    [user.user_id]
  );
  if (result.rows.length === 0) {
    await reply(chatId, '📭 Nenhum monitor para calcular uptime.', user);
    return;
  }
  let msg = `📈 <b>Uptime — 7 dias</b>\n\n`;
  for (const m of result.rows) {
    const pct = m.checks > 0 ? `${m.uptime_pct ?? 0}%` : 'sem dados';
    msg += `${statusIcon('up')} <b>${m.name}</b>: ${pct} (${m.checks} checks)\n`;
  }
  await reply(chatId, msg, user);
}

async function cmdAlerts(
  chatId: number,
  user: LinkedUser,
  args: string
): Promise<void> {
  const arg = args.toLowerCase();
  if (arg === 'on' || arg === 'off') {
    const enabled = arg === 'on';
    await query(
      `UPDATE notification_settings SET is_enabled = $1, updated_at = NOW() WHERE user_id = $2`,
      [enabled, user.user_id]
    );
    await reply(
      chatId,
      enabled
        ? '🔔 Alertas <b>ativados</b>. Você receberá notificações quando um monitor mudar de status.'
        : '🔕 Alertas <b>desativados</b>. Use /alerts on para reativar.',
      user
    );
    return;
  }
  await reply(
    chatId,
    `🔔 <b>Alertas:</b> ${user.is_enabled ? 'ATIVADOS ✅' : 'DESATIVADOS 🔕'}

/alerts on — Ativar
/alerts off — Desativar`,
    user
  );
}

async function cmdTest(chatId: number, user: LinkedUser): Promise<void> {
  if (!user.is_enabled) {
    await reply(chatId, '⚠️ Alertas desativados. Use /alerts on primeiro.', user);
    return;
  }
  const timestamp = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
  });
  await reply(
    chatId,
    `✅ <b>Teste de alerta OK!</b>

Seu bot está configurado corretamente.
⏰ ${timestamp}

— <i>Analytic Pulse</i>`,
    user
  );
}

async function cmdPing(chatId: number, args: string): Promise<void> {
  if (!args) {
    await reply(chatId, 'Usage: /ping https://seu-site.com');
    return;
  }
  let url = args.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  await reply(chatId, `⏳ Verificando <code>${url}</code>...`);
  const result = await pingUrl(url);
  const icon = result.is_up ? '✅' : '🔴';
  const status = result.is_up ? 'ONLINE' : 'OFFLINE';
  let msg = `${icon} <b>${status}</b> — ${result.response_time_ms}ms\n`;
  if (result.status_code) msg += `HTTP: <b>${result.status_code}</b>\n`;
  if (result.error_message) msg += `Erro: <code>${result.error_message}</code>`;
  await reply(chatId, msg);
}

async function cmdSettings(chatId: number, user: LinkedUser): Promise<void> {
  await reply(
    chatId,
    `⚙️ <b>Configurações</b>

👤 Conta: ${user.email}
💬 Chat ID: <code>${user.telegram_chat_id}</code>
🔔 Alertas: ${user.is_enabled ? 'ativados ✅' : 'desativados 🔕'}

Altere no <a href="${DASHBOARD_URL}">dashboard</a> → Notificações`,
    user
  );
}

export async function handleTelegramUpdate(update: {
  message?: TelegramMessage;
}): Promise<void> {
  const message = update.message;
  if (!message?.text?.startsWith('/')) return;

  const chatId = message.chat.id;
  const { command, args } = parseCommand(message.text);

  try {
    switch (command) {
      case '/start':
        await cmdStart(chatId);
        break;
      case '/help':
        await cmdHelp(chatId);
        break;
      case '/about':
        await cmdAbout(chatId);
        break;
      case '/dashboard':
        await cmdDashboard(chatId);
        break;
      case '/ping':
        await cmdPing(chatId, args);
        break;
      default: {
        const user = await requireLinked(chatId);
        if (!user) return;
        switch (command) {
          case '/status':
            await cmdStatus(chatId, user);
            break;
          case '/monitors':
            await cmdMonitors(chatId, user);
            break;
          case '/uptime':
            await cmdUptime(chatId, user);
            break;
          case '/alerts':
            await cmdAlerts(chatId, user, args);
            break;
          case '/test':
            await cmdTest(chatId, user);
            break;
          case '/settings':
            await cmdSettings(chatId, user);
            break;
          default:
            await reply(
              chatId,
              `Comando desconhecido. Use /help para ver a lista.`,
              user
            );
        }
      }
    }
  } catch (err) {
    console.error('Telegram command error:', err);
    await reply(chatId, '❌ Erro ao processar comando. Tente novamente.');
  }
}
