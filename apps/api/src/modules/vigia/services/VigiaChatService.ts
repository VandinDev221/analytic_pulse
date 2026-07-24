import crypto from 'crypto';
import { ValidationError } from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import { GroqClient, type GroqChatMessage } from '../../ai/services/GroqClient';
import { VigiaService } from './VigiaService';
import { VigiaRepository } from '../repositories/VigiaRepository';

export type VigiaChatRole = 'user' | 'assistant';

export type VigiaChatMessageInput = {
  role: VigiaChatRole;
  content: string;
  sig?: string;
};

const MAX_MESSAGES = 12;
const MAX_CONTENT_LENGTH = 2000;

function sign(content: string): string {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(content, 'utf8')
    .digest('hex');
}

function verify(content: string, sig: unknown): boolean {
  if (typeof sig !== 'string' || !/^[0-9a-f]{64}$/i.test(sig)) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sign(content), 'hex'),
      Buffer.from(sig, 'hex')
    );
  } catch {
    return false;
  }
}

export class VigiaChatService {
  constructor(
    private readonly groq = new GroqClient(),
    private readonly vigia = new VigiaService(),
    private readonly repo = new VigiaRepository()
  ) {}

  async chat(
    userId: string,
    messages: unknown
  ): Promise<{ role: 'assistant'; content: string; sig: string }> {
    const normalized = this.validate(messages);
    const overview = await this.vigia.overview(userId);
    const proposed = await this.repo.listProposed(userId, 8);

    const context = [
      `Status: enabled=${overview.status.enabled} mode=${overview.status.mode} online=${overview.status.online}`,
      `Monitores: ${overview.greeting.summary.monitors_total} (${overview.greeting.summary.monitors_down} down)`,
      `Incidentes abertos: ${overview.greeting.summary.incidents_open}`,
      `SSL alerta: ${overview.greeting.summary.ssl_critical}`,
      `Agents offline: ${overview.greeting.summary.agents_offline}`,
      `RUM erros 24h: ${overview.greeting.summary.rum_errors_24h}`,
      `Ações recentes: ${overview.recent_actions
        .slice(0, 5)
        .map((a) => `${a.status}:${a.title}`)
        .join(' | ') || 'nenhuma'}`,
      `Propostas: ${proposed.map((p) => p.title).join(' | ') || 'nenhuma'}`,
      `Predições: ${overview.predictions
        .slice(0, 5)
        .map((p) => p.title)
        .join(' | ') || 'nenhuma'}`,
    ].join('\n');

    const system = `Você é o Vigia do Analytic Pulse — plantão 24/7.
Tom: profissional, direto, cumprimenta conforme o horário se fizer sentido.
Use apenas o contexto operacional abaixo. Não invente métricas.
Não execute ações: descreva o que já foi proposto/executado.
Respostas em português, Markdown simples.

CONTEXTO:
${context}`;

    if (!normalized) {
      const content =
        'Não consegui processar a mensagem. Reformule em poucas frases.';
      return { role: 'assistant', content, sig: sign(content) };
    }

    if (!this.groq.isEnabled()) {
      const g = overview.greeting;
      const content = [
        `${g.salutation}. Estou online em modo **${overview.status.mode}**.`,
        ...g.lines.slice(1),
        '',
        '_Assistente Groq não configurado — use o relatório acima._',
      ].join('\n');
      return { role: 'assistant', content, sig: sign(content) };
    }

    const payload: GroqChatMessage[] = [
      { role: 'system', content: system },
      ...normalized.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const content = await this.groq.chat(payload, {
      temperature: 0.3,
      maxTokens: 900,
    });
    return { role: 'assistant', content, sig: sign(content) };
  }

  private validate(messages: unknown): VigiaChatMessageInput[] | null {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new ValidationError('messages é obrigatório');
    }
    const sliced = messages.slice(-MAX_MESSAGES);
    const out: VigiaChatMessageInput[] = [];
    for (const raw of sliced) {
      if (!raw || typeof raw !== 'object') return null;
      const m = raw as Record<string, unknown>;
      if (m.role !== 'user' && m.role !== 'assistant') return null;
      if (typeof m.content !== 'string' || !m.content.trim()) return null;
      if (m.content.length > MAX_CONTENT_LENGTH) return null;
      if (m.role === 'assistant' && !verify(m.content, m.sig)) {
        throw new ValidationError('Assinatura de mensagem inválida');
      }
      out.push({
        role: m.role,
        content: m.content.trim(),
        sig: typeof m.sig === 'string' ? m.sig : undefined,
      });
    }
    return out;
  }
}
