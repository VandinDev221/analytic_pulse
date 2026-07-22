export class PulseApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body?: unknown;

  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message);
    this.name = 'PulseApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}
