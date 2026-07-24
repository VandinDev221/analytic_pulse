import type { CheckResult, CheckType } from '@analytic-pulse/shared';
import { DnsChecker } from './DnsChecker';
import { HttpChecker } from './HttpChecker';
import { PingChecker } from './PingChecker';
import { PlaywrightChecker } from './PlaywrightChecker';
import { SslChecker } from './SslChecker';
import { TcpChecker } from './TcpChecker';
import { failResult, type CheckableMonitor, type Checker } from './types';
import { runInBatches } from '../../../services/pingService';

const checkers: Checker[] = [
  new HttpChecker(),
  new TcpChecker(),
  new DnsChecker(),
  new SslChecker(),
  new PingChecker(),
  new PlaywrightChecker(),
];

function matchesType(checker: Checker, type: CheckType): boolean {
  return Array.isArray(checker.type)
    ? (checker.type as readonly CheckType[]).includes(type)
    : checker.type === type;
}

export function resolveCheckType(monitor: CheckableMonitor): CheckType {
  if (monitor.check_type) return monitor.check_type;
  if (monitor.url.startsWith('https://')) return 'https';
  return 'http';
}

export async function runCheck(monitor: CheckableMonitor): Promise<CheckResult> {
  const type = resolveCheckType(monitor);
  const checker = checkers.find((c) => matchesType(c, type));
  if (!checker) {
    return failResult(type, 0, `Unsupported check type: ${type}`);
  }
  return checker.check({ ...monitor, check_type: type });
}

export { runInBatches };
export type { CheckableMonitor };
