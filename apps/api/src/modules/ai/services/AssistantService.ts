import { ValidationError } from '@analytic-pulse/shared';
import { GroqClient, type GroqChatMessage } from './GroqClient';
import { PRODUCT_KNOWLEDGE } from './productKnowledge';

export type ChatRole = 'user' | 'assistant';

export type ChatMessageInput = {
  role: ChatRole;
  content: string;
};

const MAX_MESSAGES = 12;
const MAX_CONTENT_LENGTH = 2000;

const SYSTEM_PROMPT = `${PRODUCT_KNOWLEDGE}

Você é um guia amigável do painel. Prefira passos curtos e listas quando ajudar a clareza.`;

export class AssistantService {
  constructor(private readonly groq = new GroqClient()) {}

  async chat(messages: unknown): Promise<{ role: 'assistant'; content: string }> {
    const normalized = this.validateMessages(messages);

    const payload: GroqChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...normalized.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const content = await this.groq.chat(payload);
    return { role: 'assistant', content };
  }

  private validateMessages(raw: unknown): ChatMessageInput[] {
    if (!Array.isArray(raw)) {
      throw new ValidationError('messages deve ser um array');
    }
    if (raw.length === 0) {
      throw new ValidationError('Envie pelo menos uma mensagem');
    }
    if (raw.length > MAX_MESSAGES) {
      throw new ValidationError(`Máximo de ${MAX_MESSAGES} mensagens por requisição`);
    }

    const result: ChatMessageInput[] = [];

    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (!item || typeof item !== 'object') {
        throw new ValidationError(`Mensagem inválida no índice ${i}`);
      }
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;

      if (role !== 'user' && role !== 'assistant') {
        throw new ValidationError(`role inválido no índice ${i} (use user ou assistant)`);
      }
      if (typeof content !== 'string' || !content.trim()) {
        throw new ValidationError(`content vazio no índice ${i}`);
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        throw new ValidationError(
          `Mensagem no índice ${i} excede ${MAX_CONTENT_LENGTH} caracteres`
        );
      }

      result.push({ role, content: content.trim() });
    }

    const last = result[result.length - 1];
    if (last.role !== 'user') {
      throw new ValidationError('A última mensagem deve ser do usuário');
    }

    return result;
  }
}
