import { trace, SpanStatusCode, type Span, type Attributes } from '@opentelemetry/api';

const TRACER_NAME = 'analytic-pulse.monitoring';

export function getTracer(name = TRACER_NAME) {
  return trace.getTracer(name);
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function activeTraceFields(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  if (!ctx.traceId || ctx.traceId === '00000000000000000000000000000000') return {};
  return {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
  };
}
