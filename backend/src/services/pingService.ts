import axios from 'axios';

export interface PingResult {
  status_code: number | null;
  response_time_ms: number;
  is_up: boolean;
  error_message: string | null;
}

/**
 * Pings a URL and returns the result.
 * - Enforces a strict 10-second timeout.
 * - Measures precise response time using Date.now().
 * - Treats any status < 400 as "up".
 */
export async function pingUrl(url: string): Promise<PingResult> {
  const start = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: 10_000,
      validateStatus: () => true, // Don't throw on any status code
      headers: {
        'User-Agent': 'PingPulse-Monitor/1.0',
      },
      maxRedirects: 5,
    });

    const response_time_ms = Date.now() - start;
    const status_code = response.status;
    const is_up = status_code >= 200 && status_code < 400;

    return {
      status_code,
      response_time_ms,
      is_up,
      error_message: null,
    };
  } catch (error: unknown) {
    const response_time_ms = Date.now() - start;

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return {
          status_code: null,
          response_time_ms,
          is_up: false,
          error_message: 'TIMEOUT',
        };
      }
      if (error.code === 'ENOTFOUND') {
        return {
          status_code: null,
          response_time_ms,
          is_up: false,
          error_message: 'DNS_FAILURE',
        };
      }
      if (error.code === 'ECONNREFUSED') {
        return {
          status_code: null,
          response_time_ms,
          is_up: false,
          error_message: 'CONNECTION_REFUSED',
        };
      }
    }

    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return {
      status_code: null,
      response_time_ms,
      is_up: false,
      error_message: message.substring(0, 255),
    };
  }
}

/**
 * Runs a list of async tasks in batches to limit concurrency.
 * Prevents overwhelming the server when monitoring many sites.
 */
export async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map(task => task());
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
  }
  return results;
}
