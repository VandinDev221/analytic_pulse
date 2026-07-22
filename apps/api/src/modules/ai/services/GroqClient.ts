import { AppError } from '@analytic-pulse/shared';
import { env } from '../../../config/env';

export type GroqChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string | null };
  }>;
  error?: { message?: string };
};

/** OpenAI-compatible — https://console.groq.com/docs/openai */
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 45_000;

export class GroqClient {
  async chat(
    messages: GroqChatMessage[],
    options?: { temperature?: number; maxTokens?: number; json?: boolean }
  ): Promise<string> {
    const apiKey = env.groqApiKey;
    if (!apiKey) {
      throw new AppError(
        'INTERNAL_ERROR',
        'Assistente de IA não configurado. Defina GROQ_API_KEY no servidor (console.groq.com).',
        503
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const body: Record<string, unknown> = {
        model: env.groqModel,
        messages,
        temperature: options?.temperature ?? 0.4,
        max_tokens: options?.maxTokens ?? 1024,
      };
      if (options?.json) {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as GroqChatCompletionResponse;

      if (!res.ok) {
        const detail = data.error?.message || `Groq HTTP ${res.status}`;
        throw new AppError(
          'INTERNAL_ERROR',
          `Falha ao consultar o Groq: ${detail}`,
          res.status >= 500 ? 502 : 400
        );
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new AppError(
          'INTERNAL_ERROR',
          'O Groq retornou uma resposta vazia.',
          502
        );
      }

      return content;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(
          'INTERNAL_ERROR',
          'Tempo esgotado ao consultar o Groq. Tente novamente.',
          504
        );
      }
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new AppError('INTERNAL_ERROR', `Erro ao chamar Groq: ${message}`, 502);
    } finally {
      clearTimeout(timer);
    }
  }

  isEnabled(): boolean {
    return Boolean(env.groqApiKey);
  }

  modelName(): string {
    return env.groqModel;
  }
}
