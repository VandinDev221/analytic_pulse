import { activeTraceFields } from './tracing';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: LogLevel =
  process.env.LOG_LEVEL === 'debug'
    ? 'debug'
    : process.env.NODE_ENV === 'production'
      ? 'info'
      : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    service: 'analytic-pulse-api',
    ...activeTraceFields(),
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
  child(bindings: LogFields) {
    return {
      debug: (message: string, fields?: LogFields) =>
        write('debug', message, { ...bindings, ...fields }),
      info: (message: string, fields?: LogFields) =>
        write('info', message, { ...bindings, ...fields }),
      warn: (message: string, fields?: LogFields) =>
        write('warn', message, { ...bindings, ...fields }),
      error: (message: string, fields?: LogFields) =>
        write('error', message, { ...bindings, ...fields }),
    };
  },
};
