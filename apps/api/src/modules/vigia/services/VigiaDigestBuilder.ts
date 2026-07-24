import type { VigiaDigestSummary, VigiaPrediction } from '@analytic-pulse/shared';
import { VigiaRepository } from '../repositories/VigiaRepository';

export function buildPredictions(input: {
  ssl: Array<{ id: string; name: string; ssl_days_remaining: number }>;
  agents: Array<{ id: string; name: string; status: string }>;
  down: Array<{ id: string; name: string }>;
  rumErrors: number;
}): VigiaPrediction[] {
  const out: VigiaPrediction[] = [];

  for (const m of input.ssl.slice(0, 5)) {
    const days = Number(m.ssl_days_remaining);
    out.push({
      kind: 'ssl_expiry',
      title: `SSL de ${m.name} expira em ${days} dia(s)`,
      explanation:
        days <= 7
          ? 'Risco alto de interrupção HTTPS. Renove o certificado em breve.'
          : 'Certificado dentro do limiar de aviso. Planeje a renovação.',
      severity: days <= 7 ? 'critical' : 'warn',
      target_type: 'monitor',
      target_id: m.id,
    });
  }

  for (const a of input.agents.slice(0, 5)) {
    out.push({
      kind: 'agent_offline',
      title: `Agent ${a.name} sem heartbeat`,
      explanation:
        'Sem métricas recentes. Verifique o processo do collector ou a rede.',
      severity: 'warn',
      target_type: 'agent',
      target_id: a.id,
    });
  }

  if (input.down.length >= 3) {
    out.push({
      kind: 'multi_down',
      title: `${input.down.length} monitores down ao mesmo tempo`,
      explanation:
        'Possível causa comum (DNS, rede, provedor). Correlacionar antes de tratar um a um.',
      severity: 'critical',
    });
  }

  if (input.rumErrors >= 20) {
    out.push({
      kind: 'rum_spike',
      title: `Pico de erros RUM (${input.rumErrors}/24h)`,
      explanation:
        'Taxa elevada de erros no frontend. Revisar releases e Web Vitals.',
      severity: 'warn',
    });
  }

  return out;
}

export function formatDigestHtml(
  summary: VigiaDigestSummary,
  salutation: string
): string {
  const lines = [
    `<b>${salutation}</b>`,
    '',
    '📋 <b>Relatório do Vigia</b>',
    `• Monitores: <b>${summary.monitors_total}</b> (${summary.monitors_down} down)`,
    `• Incidentes abertos: <b>${summary.incidents_open}</b>`,
    `• Resolvidos (24h): <b>${summary.incidents_resolved_24h}</b>`,
    `• SSL em alerta: <b>${summary.ssl_critical}</b>`,
    `• Agents offline: <b>${summary.agents_offline}</b>`,
    `• Erros RUM (24h): <b>${summary.rum_errors_24h}</b>`,
    `• Ações do Vigia (24h): <b>${summary.actions_24h}</b>`,
  ];

  if (summary.predictions.length) {
    lines.push('', '🔮 <b>Antecipações</b>');
    for (const p of summary.predictions.slice(0, 5)) {
      lines.push(`• ${p.title}`);
    }
  }

  return lines.join('\n');
}

export class VigiaDigestBuilder {
  constructor(private readonly repo = new VigiaRepository()) {}

  async buildSummary(userId: string): Promise<VigiaDigestSummary> {
    const summary = await this.repo.collectSummary(userId);
    const [ssl, agents, down] = await Promise.all([
      this.repo.findSslWarnings(userId),
      this.repo.findStaleAgents(userId),
      this.repo.findDownMonitors(userId),
    ]);
    summary.predictions = buildPredictions({
      ssl,
      agents,
      down,
      rumErrors: summary.rum_errors_24h,
    });
    return summary;
  }
}
