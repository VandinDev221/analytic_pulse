import http from 'http';
import https from 'https';
import dns from 'dns/promises';
import { URL } from 'url';
import type { CheckResult, CheckType } from '@analytic-pulse/shared';
import {
  failResult,
  type CheckableMonitor,
  type Checker,
} from './types';

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;

function normalizeHeaders(
  headers: http.IncomingHttpHeaders
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function applyValidations(
  monitor: CheckableMonitor,
  statusCode: number,
  headers: Record<string, string>,
  body: string
): string | null {
  const expectedCodes =
    monitor.expected_status_codes && monitor.expected_status_codes.length > 0
      ? monitor.expected_status_codes
      : null;

  if (expectedCodes) {
    if (!expectedCodes.includes(statusCode)) {
      return `UNEXPECTED_STATUS_${statusCode}`;
    }
  } else if (statusCode >= 400) {
    return `HTTP_${statusCode}`;
  }

  if (monitor.keyword) {
    if (!body.includes(monitor.keyword)) {
      return 'KEYWORD_NOT_FOUND';
    }
  }

  if (monitor.expected_header_name) {
    const name = monitor.expected_header_name.toLowerCase();
    const actual = headers[name];
    if (actual === undefined) {
      return `HEADER_MISSING_${monitor.expected_header_name}`;
    }
    if (
      monitor.expected_header_value &&
      actual.toLowerCase() !== monitor.expected_header_value.toLowerCase()
    ) {
      return `HEADER_MISMATCH_${monitor.expected_header_name}`;
    }
  }

  if (monitor.json_path) {
    try {
      const parsed = JSON.parse(body);
      const value = getByPath(parsed, monitor.json_path);
      if (value === undefined) {
        return 'JSON_PATH_NOT_FOUND';
      }
      if (
        monitor.json_expected !== undefined &&
        monitor.json_expected !== null &&
        monitor.json_expected !== '' &&
        String(value) !== monitor.json_expected
      ) {
        return 'JSON_VALUE_MISMATCH';
      }
    } catch {
      return 'INVALID_JSON_BODY';
    }
  }

  return null;
}

interface HttpExchange {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  redirectChain: string[];
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  downloadMs: number | null;
  totalMs: number;
}

async function performRequest(
  targetUrl: string,
  method: string,
  requestHeaders: Record<string, string>,
  requestBody: string | null | undefined,
  redirectChain: string[],
  depth: number
): Promise<HttpExchange> {
  if (depth > MAX_REDIRECTS) {
    throw new Error('TOO_MANY_REDIRECTS');
  }

  const parsed = new URL(targetUrl);
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;
  const totalStart = Date.now();

  let dnsMs: number | null = null;
  try {
    const dnsStart = Date.now();
    await dns.lookup(parsed.hostname);
    dnsMs = Date.now() - dnsStart;
  } catch {
    // continua — o request falhará com erro mais claro
  }

  return new Promise((resolve, reject) => {
    let tcpMs: number | null = null;
    let tlsMs: number | null = null;
    let ttfbMs: number | null = null;
    let downloadMs: number | null = null;
    let connectStart = 0;
    let tlsStart = 0;
    let firstByteAt = 0;

    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: {
          'User-Agent': 'AnalyticPulse-Monitor/1.0',
          Accept: '*/*',
          ...requestHeaders,
          ...(requestBody
            ? { 'Content-Length': Buffer.byteLength(requestBody) }
            : {}),
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        firstByteAt = Date.now();
        ttfbMs = firstByteAt - totalStart;

        const location = res.headers.location;
        if (
          location &&
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400
        ) {
          res.resume();
          const nextUrl = new URL(location, targetUrl).toString();
          const chain = [...redirectChain, targetUrl];
          performRequest(
            nextUrl,
            method === 'POST' ? 'GET' : method,
            requestHeaders,
            undefined,
            chain,
            depth + 1
          )
            .then(resolve)
            .catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const end = Date.now();
          downloadMs = end - firstByteAt;
          const body = Buffer.concat(chunks).toString('utf8');
          const headers = normalizeHeaders(res.headers);
          resolve({
            statusCode: res.statusCode || 0,
            headers,
            body,
            redirectChain: [...redirectChain, targetUrl],
            dnsMs,
            tcpMs,
            tlsMs,
            ttfbMs,
            downloadMs,
            totalMs: end - totalStart,
          });
        });
      }
    );

    req.on('socket', (socket) => {
      connectStart = Date.now();
      socket.on('connect', () => {
        tcpMs = Date.now() - connectStart;
      });
      socket.on('secureConnect', () => {
        tlsMs = Date.now() - (tlsStart || connectStart);
      });
      if (isHttps) {
        tlsStart = Date.now();
      }
    });

    req.on('timeout', () => {
      req.destroy(new Error('TIMEOUT'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (requestBody) {
      req.write(requestBody);
    }
    req.end();
  });
}

export class HttpChecker implements Checker {
  readonly type = ['http', 'https'] as const;

  async check(monitor: CheckableMonitor): Promise<CheckResult> {
    const checkType: CheckType =
      monitor.check_type === 'https' || monitor.url.startsWith('https://')
        ? 'https'
        : 'http';

    let target = monitor.url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = `${checkType}://${target}`;
    }

    try {
      // eslint validation of URL
      new URL(target);
    } catch {
      return failResult(checkType, 0, 'Invalid URL format');
    }

    const method = (monitor.method || 'GET').toUpperCase();
    const headers = monitor.request_headers || {};

    try {
      const exchange = await performRequest(
        target,
        method,
        headers,
        monitor.request_body,
        [],
        0
      );

      const validationError = applyValidations(
        monitor,
        exchange.statusCode,
        exchange.headers,
        exchange.body
      );

      const contentLengthHeader = exchange.headers['content-length'];
      const contentLength = contentLengthHeader
        ? Number(contentLengthHeader)
        : null;
      const responseSize = Buffer.byteLength(exchange.body, 'utf8');

      return {
        status_code: exchange.statusCode,
        response_time_ms: exchange.totalMs,
        is_up: validationError === null,
        error_message: validationError,
        check_type: checkType,
        timings: {
          dns_ms: exchange.dnsMs,
          tcp_ms: exchange.tcpMs,
          tls_ms: exchange.tlsMs,
          ttfb_ms: exchange.ttfbMs,
          download_ms: exchange.downloadMs,
          total_ms: exchange.totalMs,
        },
        response_size_bytes: responseSize,
        content_length: Number.isFinite(contentLength) ? contentLength : null,
        response_headers: exchange.headers,
        redirect_chain: exchange.redirectChain,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'HTTP_REQUEST_FAILED';
      let mapped = message;
      if (message.includes('ENOTFOUND')) mapped = 'DNS_FAILURE';
      if (message.includes('ECONNREFUSED')) mapped = 'CONNECTION_REFUSED';
      if (message.includes('TIMEOUT') || message.includes('timeout'))
        mapped = 'TIMEOUT';
      return failResult(checkType, 0, mapped);
    }
  }
}
