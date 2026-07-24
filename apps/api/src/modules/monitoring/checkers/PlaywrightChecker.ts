import type { CheckResult } from '@analytic-pulse/shared';
import { env } from '../../../config/env';
import { logger } from '../../../observability/logger';
import {
  emptyTimings,
  failResult,
  type CheckableMonitor,
  type Checker,
} from './types';

const log = logger.child({ component: 'PlaywrightChecker' });

/**
 * Synthetic monitoring via Playwright:
 * - abre a URL
 * - espera networkidle (ou load)
 * - se keyword preenchido, trata como seletor CSS que deve ficar visível
 */
export class PlaywrightChecker implements Checker {
  readonly type = 'browser' as const;

  async check(monitor: CheckableMonitor): Promise<CheckResult> {
    const started = Date.now();

    if (!env.playwrightEnabled) {
      return failResult(
        'browser',
        Date.now() - started,
        'PLAYWRIGHT_DISABLED'
      );
    }

    let chromium: typeof import('playwright').chromium | null = null;
    try {
      ({ chromium } = await import('playwright'));
    } catch (error) {
      log.warn('Playwright package unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return failResult(
        'browser',
        Date.now() - started,
        'PLAYWRIGHT_NOT_INSTALLED'
      );
    }

    const timeout = Math.max(5_000, Math.min(env.playwrightTimeoutMs || 30_000, 90_000));
    let browser: import('playwright').Browser | null = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent:
          'PingPulseBrowserCheck/1.0 (+https://github.com/VandinDev221/analytic_pulse)',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(timeout);

      const response = await page.goto(monitor.url, {
        waitUntil: 'domcontentloaded',
        timeout,
      });

      const statusCode = response?.status() ?? null;
      const ttfbApprox = Date.now() - started;

      // Espera estabilizar um pouco a página (não bloqueia se falhar)
      try {
        await page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 15_000) });
      } catch {
        // ok — SPA lentas ou long-polling
      }

      const selector = monitor.keyword?.trim() || null;
      if (selector) {
        await page.waitForSelector(selector, {
          state: 'visible',
          timeout,
        });
      }

      // Status HTTP da navegação (se disponível)
      if (statusCode != null && statusCode >= 400) {
        const expected = monitor.expected_status_codes;
        if (!expected || expected.length === 0 || !expected.includes(statusCode)) {
          const totalMs = Date.now() - started;
          return {
            status_code: statusCode,
            response_time_ms: totalMs,
            is_up: false,
            error_message: `HTTP_${statusCode}`.substring(0, 255),
            check_type: 'browser',
            timings: {
              ...emptyTimings(totalMs),
              ttfb_ms: ttfbApprox,
            },
            response_size_bytes: null,
            content_length: null,
            response_headers: null,
            redirect_chain: null,
            meta: {
              final_url: page.url(),
              title: await page.title().catch(() => null),
              selector,
            },
          };
        }
      }

      if (
        monitor.expected_status_codes &&
        monitor.expected_status_codes.length > 0 &&
        statusCode != null &&
        !monitor.expected_status_codes.includes(statusCode)
      ) {
        const totalMs = Date.now() - started;
        return failResult(
          'browser',
          totalMs,
          `UNEXPECTED_STATUS_${statusCode}`,
          { ttfb_ms: ttfbApprox }
        );
      }

      const totalMs = Date.now() - started;
      const title = await page.title().catch(() => null);

      return {
        status_code: statusCode,
        response_time_ms: totalMs,
        is_up: true,
        error_message: null,
        check_type: 'browser',
        timings: {
          ...emptyTimings(totalMs),
          ttfb_ms: ttfbApprox,
        },
        response_size_bytes: null,
        content_length: null,
        response_headers: null,
        redirect_chain: null,
        meta: {
          final_url: page.url(),
          title,
          selector,
          engine: 'playwright',
        },
      };
    } catch (error) {
      const totalMs = Date.now() - started;
      const message =
        error instanceof Error ? error.message : String(error);
      const short = message.includes('Executable doesn')
        ? 'PLAYWRIGHT_BROWSER_MISSING'
        : message.includes('Timeout')
          ? 'BROWSER_TIMEOUT'
          : message.substring(0, 255);

      log.warn('Browser check failed', {
        monitorId: monitor.id,
        url: monitor.url,
        error: short,
      });

      return failResult('browser', totalMs, short);
    } finally {
      if (browser) {
        await browser.close().catch(() => undefined);
      }
    }
  }
}
