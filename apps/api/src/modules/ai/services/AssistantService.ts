import crypto from 'crypto';
import { ValidationError } from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import { GroqClient, type GroqChatMessage } from './GroqClient';
import { PRODUCT_KNOWLEDGE } from './productKnowledge';

export type ChatRole = 'user' | 'assistant';

export type ChatMessageInput = {
  role: ChatRole;
  content: string;
  /** Assinatura HMAC — obrigatória em mensagens assistant geradas pelo servidor. */
  sig?: string;
};

const MAX_MESSAGES = 12;
const MAX_CONTENT_LENGTH = 2000;

const FALLBACK_REPLY =
  'Infelizmente não consigo resolver seu problema, entre em contato com o administrador.';

const SYSTEM_PROMPT = `${PRODUCT_KNOWLEDGE}

Você é um guia amigável do painel. Prefira passos curtos, listas e seções curtas.
Nunca devolva HTML cru — só Markdown simples.`;

function signAssistantContent(content: string): string {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(content, 'utf8')
    .digest('hex');
}

function verifyAssistantContent(content: string, sig: unknown): boolean {
  if (typeof sig !== 'string' || !/^[0-9a-f]{64}$/i.test(sig)) {
    return false;
  }
  const expected = signAssistantContent(content);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(sig, 'hex')
    );
  } catch {
    return false;
  }
}

export class AssistantService {
  constructor(private readonly groq = new GroqClient()) {}

  async chat(
    messages: unknown
  ): Promise<{ role: 'assistant'; content: string; sig: string }> {
    const normalized = this.validateMessages(messages);
    if (!normalized) {
      const content = FALLBACK_REPLY;
      return { role: 'assistant', content, sig: signAssistantContent(content) };
    }

    const payload: GroqChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...normalized.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const content = await this.groq.chat(payload);
    return {
      role: 'assistant',
      content,
      sig: signAssistantContent(content),
    };
  }

  /**
   * Retorna null quando o limite de tamanho/quantidade impede o atendimento
   * (o caller responde com FALLBACK_REPLY no chat).
   * Histórico longo demais é truncado para não quebrar a conversa.
   * Mensagens `assistant` só são aceitas com assinatura HMAC válida do servidor.
   */
  private validateMessages(raw: unknown): ChatMessageInput[] | null {
    if (!Array.isArray(raw)) {
      throw new ValidationError('messages deve ser um array');
    }
    if (raw.length === 0) {
      throw new ValidationError('Envie pelo menos uma mensagem');
    }
    if (raw.length > MAX_MESSAGES) {
      return null;
    }

    const result: ChatMessageInput[] = [];

    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (!item || typeof item !== 'object') {
        throw new ValidationError(`Mensagem inválida no índice ${i}`);
      }
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      const sig = (item as { sig?: unknown }).sig;

      if (role !== 'user' && role !== 'assistant') {
        throw new ValidationError(`role inválido no índice ${i} (use user ou assistant)`);
      }
      if (typeof content !== 'string' || !content.trim()) {
        throw new ValidationError(`content vazio no índice ${i}`);
      }

      const isLast = i === raw.length - 1;

      // Cliente não pode forjar respostas do assistente — valida HMAC no texto exato
      if (role === 'assistant') {
        if (!verifyAssistantContent(content, sig)) {
          return null;
        }
        if (content.length > MAX_CONTENT_LENGTH) {
          // Histórico grande demais → resposta amigável no chat (não erro técnico)
          return null;
        }
        result.push({
          role,
          content,
          sig: typeof sig === 'string' ? sig : undefined,
        });
        continue;
      }

      const trimmed = content.trim();

      // Mensagem atual do usuário acima do limite → resposta amigável no chat
      if (isLast && trimmed.length > MAX_CONTENT_LENGTH) {
        return null;
      }

      // Histórico longo → trunca, não quebra o chat
      result.push({
        role,
        content:
          trimmed.length > MAX_CONTENT_LENGTH
            ? `${trimmed.slice(0, MAX_CONTENT_LENGTH - 1)}…`
            : trimmed,
      });
    }

    const last = result[result.length - 1];
    if (last.role !== 'user') {
      throw new ValidationError('A última mensagem deve ser do usuário');
    }

    return result;
  }
}
