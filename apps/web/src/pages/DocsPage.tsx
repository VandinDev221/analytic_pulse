import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Box,
  Cpu,
  ExternalLink,
  Globe,
  KeyRound,
  Lock,
  Map as MapIcon,
  Radio,
  Server,
  ShieldAlert,
  Ship,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { getApiDocsUrl } from '../services/api';

const SECTIONS = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'monitores', label: 'Monitores' },
  { id: 'incidentes', label: 'Incidentes' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'agents', label: 'Agents Linux' },
  { id: 'docker-k8s', label: 'Docker & Kubernetes' },
  { id: 'ssl-dns', label: 'SSL & DNS' },
  { id: 'analytics-mapa', label: 'Analytics & Mapa' },
  { id: 'status-page', label: 'Status Page' },
  { id: 'api', label: 'API pública' },
  { id: 'cli-sdks', label: 'CLI & SDKs' },
  { id: 'ia', label: 'Assistente & IA' },
  { id: 'atualizacao', label: 'Atualização automática' },
] as const;

export const DocsPage: React.FC = () => {
  const [active, setActive] = useState<string>('visao');
  const swaggerUrl = getApiDocsUrl();

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  }

  return (
    <div className="page page--wide docs-page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>Documentação</h1>
            <span className="live-badge">
              <BookOpen size={10} />
              Guia do produto
            </span>
          </div>
          <p className="page-header__desc">
            Como o PingPulse funciona, o que cada módulo faz e como integrar via API, CLI e agents.
          </p>
        </div>
      </div>

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="Índice da documentação">
          <p className="docs-toc__label">Conteúdo</p>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`docs-toc__link ${active === s.id ? 'is-active' : ''}`}
                  onClick={() => scrollTo(s.id)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="docs-body">
          <section id="visao" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Visão geral</h2>
              <p>Plataforma de observabilidade, não só uptime</p>
            </div>
            <p>
              O <strong>PingPulse</strong> (projeto Analytic Pulse) é uma plataforma open source de
              observabilidade: monitoramento sintético de URLs/APIs, incidentes, alertas,
              certificados SSL, DNS, agents Linux, Docker, Kubernetes, analytics, mapa mundial,
              status page pública e API REST com SDKs e CLI.
            </p>
            <p>
              A ideia é oferecer clareza de status (estilo Better Stack), profundidade analítica e
              UX limpa — com arquitetura modular preparada para crescer.
            </p>
            <ul className="docs-list">
              <li>Dashboard operacional com disponibilidade, latência e histórico</li>
              <li>Alertas multi-canal (Telegram, WhatsApp, Slack, Discord, e-mail, webhook…)</li>
              <li>Collectors no host (CPU, RAM, disco, containers, cluster)</li>
              <li>API pública <code>/api/v1</code>, OpenAPI e CLI <code>pulse</code></li>
              <li>IA opcional como assistente — nunca como autoridade</li>
            </ul>
          </section>

          <section id="como-funciona" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Como funciona</h2>
              <p>Fluxo resumido do sistema</p>
            </div>
            <ol className="docs-steps">
              <li>
                <strong>Você cria monitores</strong> (URL/host) e configura intervalos de check no
                dashboard.
              </li>
              <li>
                <strong>A API executa checks</strong> (HTTP e correlatos), grava histórico e
                atualiza status up/down.
              </li>
              <li>
                <strong>Falhas geram incidentes</strong>; recuperação fecha o incidente.
              </li>
              <li>
                <strong>O motor de alertas</strong> avalia regras e dispara nos canais configurados.
              </li>
              <li>
                <strong>Agents Linux</strong> (opcional) enviam métricas do servidor, Docker e
                Kubernetes.
              </li>
              <li>
                <strong>A Status Page</strong> expõe o estado público em <code>/status/:slug</code>.
              </li>
            </ol>
            <p className="docs-note">
              Autenticação do dashboard: JWT em <code>localStorage</code> (
              <code>pingpulse_token</code>). A API pública usa chaves <code>ap_pk_…</code>; agents usam{' '}
              <code>ap_agent_…</code>.
            </p>
          </section>

          <section id="modulos" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Mapa dos módulos</h2>
              <p>Onde encontrar cada coisa no app</p>
            </div>
            <div className="docs-grid">
              <DocCard to="/" icon={<Activity size={16} />} title="Dashboard" text="Visão operacional, KPIs e monitores." />
              <DocCard to="/analytics" icon={<Radio size={16} />} title="Analytics" text="Latência P50/P95/P99, uptime, MTTR/MTBF." />
              <DocCard to="/ssl" icon={<Lock size={16} />} title="SSL" text="Validade, issuer, cipher e renovação." />
              <DocCard to="/dns" icon={<Server size={16} />} title="DNS" text="Registros e scan de domínio." />
              <DocCard to="/agents" icon={<Cpu size={16} />} title="Agents" text="Métricas do host Linux." />
              <DocCard to="/docker" icon={<Box size={16} />} title="Docker" text="Containers, volumes, networks e logs." />
              <DocCard to="/kubernetes" icon={<Ship size={16} />} title="Kubernetes" text="Pods, deploys, services, nodes…" />
              <DocCard to="/map" icon={<MapIcon size={16} />} title="Mapa" text="Nós por região e latência." />
              <DocCard to="/incidents" icon={<ShieldAlert size={16} />} title="Incidentes" text="Histórico e análise com IA." />
              <DocCard to="/alerts" icon={<Zap size={16} />} title="Alertas" text="Regras e canais de notificação." />
              <DocCard to="/status-page" icon={<Globe size={16} />} title="Status Page" text="Página pública e manutenção." />
              <DocCard to="/api-keys" icon={<KeyRound size={16} />} title="API" text="Chaves para /api/v1 e Swagger." />
            </div>
          </section>

          <section id="monitores" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Monitores</h2>
              <p>Monitoramento sintético de disponibilidade</p>
            </div>
            <p>
              Um monitor representa um alvo (URL/serviço) verificado periodicamente. O dashboard
              mostra status atual, latência, uptime e histórico. Detalhes em{' '}
              <Link to="/">Dashboard</Link> → abrir o monitor.
            </p>
            <ul className="docs-list">
              <li>Criação/edição pelo modal “Novo” no dashboard</li>
              <li>Resultados alimentam analytics, mapa, SSL/DNS (quando aplicável) e incidentes</li>
              <li>API: <code>GET/POST/PATCH/DELETE /api/v1/monitors</code></li>
            </ul>
          </section>

          <section id="incidentes" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Incidentes</h2>
              <p>Quando um serviço cai e quando volta</p>
            </div>
            <p>
              Incidentes registram períodos de indisponibilidade. Enquanto o monitor está down, o
              incidente fica ativo; ao recuperar, é resolvido. Em{' '}
              <Link to="/incidents">Incidentes</Link> você vê a lista e o detalhe com timeline.
            </p>
            <p>
              Se a IA estiver habilitada na API, o detalhe do incidente oferece{' '}
              <strong>análise sob demanda</strong> (causas possíveis e ações sugeridas) — somente
              leitura, sem alterar o sistema.
            </p>
          </section>

          <section id="alertas" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Alertas e notificações</h2>
              <p>Regras + canais</p>
            </div>
            <p>
              Em <Link to="/alerts">Alertas</Link> você define:
            </p>
            <ul className="docs-list">
              <li>
                <strong>Canais</strong> — Telegram, WhatsApp, e-mail, Slack, Discord, Teams, webhook
              </li>
              <li>
                <strong>Regras</strong> — métricas como monitor down/up, latência, HTTP status, dias
                de SSL; operador, threshold, cooldown e escalonamento
              </li>
            </ul>
            <p>
              Atalho rápido de Telegram/WhatsApp também fica em <strong>Notificações</strong> no
              menu lateral (configuração simples + teste).
            </p>
          </section>

          <section id="agents" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Agents Linux</h2>
              <p>Collector no servidor</p>
            </div>
            <p>
              O agent (Node.js) coleta métricas do host e faz POST autenticado por token{' '}
              <code>ap_agent_…</code> para a API (<code>/api/agents/ingest</code>).
            </p>
            <ol className="docs-steps">
              <li>
                Em <Link to="/agents">Agents</Link>, crie um agent e copie o token (exibido uma vez).
              </li>
              <li>
                No servidor Linux:
                <pre className="docs-code">{`cd apps/agent && npm install && npm run build
export PULSE_API_URL="https://sua-api"
export PULSE_AGENT_TOKEN="ap_agent_..."
export PULSE_AGENT_INTERVAL=30
npm start`}</pre>
              </li>
              <li>Veja CPU, RAM, disco, rede, temperatura, serviços e logs no dashboard.</li>
            </ol>
            <p className="docs-note">
              Recomenda-se rodar como serviço <code>systemd</code> com restart automático. Detalhes
              no README de <code>apps/agent</code>.
            </p>
          </section>

          <section id="docker-k8s" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Docker & Kubernetes</h2>
              <p>Agregados via agent</p>
            </div>
            <p>
              Com Docker no host, o agent (v0.2+) envia containers, stats, volumes, networks e logs —
              visíveis em <Link to="/docker">Docker</Link>.
            </p>
            <p>
              Com <code>kubectl</code> configurado, o agent (v0.3+) envia snapshot do cluster —
              pods, deployments, services, ingress, nodes, namespaces e PVC em{' '}
              <Link to="/kubernetes">Kubernetes</Link>.
            </p>
          </section>

          <section id="ssl-dns" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>SSL & DNS</h2>
              <p>Saúde de certificados e resolução</p>
            </div>
            <p>
              <Link to="/ssl">SSL</Link> acompanha validade, issuer, cipher, versão TLS e risco de
              expiração. <Link to="/dns">DNS</Link> cobre A/AAAA, MX, TXT, CNAME, NS, SPF, DKIM,
              DMARC, DNSSEC e um scan sob demanda de domínio.
            </p>
          </section>

          <section id="analytics-mapa" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Analytics & Mapa</h2>
              <p>Performance e geografia dos checks</p>
            </div>
            <p>
              <Link to="/analytics">Analytics</Link> mostra disponibilidade, percentis de latência
              e indicadores como MTTR/MTBF em janelas de 7/30/90 dias.
            </p>
            <p>
              <Link to="/map">Mapa</Link> posiciona nós/regiões com latência e pulso dos checks —
              útil para ver saúde global de uma vez.
            </p>
          </section>

          <section id="status-page" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Status Page</h2>
              <p>Página pública para seus usuários</p>
            </div>
            <p>
              Em <Link to="/status-page">Status Page</Link> você configura nome, tema, logo, SLA,
              o que exibir (histórico, incidentes, manutenção) e janelas de manutenção.
            </p>
            <p>
              A página pública fica em <code>/status/:slug</code> (sem login). O link “Página
              Pública” no menu abre a URL do seu slug.
            </p>
          </section>

          <section id="api" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>API pública</h2>
              <p>REST versionada em /api/v1</p>
            </div>
            <p>
              Crie uma chave em <Link to="/api-keys">API Keys</Link> (<code>ap_pk_…</code>, exibida
              uma vez). Envie:
            </p>
            <pre className="docs-code">{`Authorization: Bearer ap_pk_SEU_TOKEN
# ou
X-Api-Key: ap_pk_SEU_TOKEN`}</pre>
            <p>
              Scopes: <code>read</code> e <code>write</code> (<code>write</code> inclui leitura).
              Endpoints cobrem monitores, incidentes, dashboard, analytics, SSL, DNS, mapa, agents,
              Docker e Kubernetes.
            </p>
            <p>
              <a href={swaggerUrl} target="_blank" rel="noopener noreferrer" className="docs-ext">
                Abrir Swagger / OpenAPI <ExternalLink size={13} />
              </a>
            </p>
          </section>

          <section id="cli-sdks" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>CLI & SDKs</h2>
              <p>Integração fora do dashboard</p>
            </div>
            <p>
              <Terminal size={14} className="docs-inline-icon" /> CLI oficial <code>pulse</code>:
            </p>
            <pre className="docs-code">{`npm run build:cli
npx pulse login --api-url https://SUA_API --api-key ap_pk_...
pulse status
pulse monitor create --name "API" --url https://exemplo.com
pulse incidents
pulse ssl`}</pre>
            <p>
              SDKs oficiais: TypeScript (<code>@analytic-pulse/sdk</code>), Python, Go, além de
              PHP, Java, C# e Rust no monorepo. Use a mesma chave da API pública.
            </p>
          </section>

          <section id="ia" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Assistente & IA</h2>
              <p>Ajuda no dashboard, sem mandar no negócio</p>
            </div>
            <p>
              <Sparkles size={14} className="docs-inline-icon" /> O botão flutuante do assistente
              responde dúvidas sobre o produto (como criar monitor, alertas, status page…).
            </p>
            <p>
              A análise de incidentes (quando <code>GROQ_API_KEY</code> está configurada na API)
              sugere causas e ações com explicação e disclaimer. A IA <strong>não</strong> altera
              monitores, regras ou dados — o sistema funciona 100% sem ela.
            </p>
          </section>

          <section id="atualizacao" className="docs-section glass dash-panel">
            <div className="dash-panel__head">
              <h2>Atualização automática</h2>
              <p>Dados sempre frescos</p>
            </div>
            <p>
              As páginas de monitoramento recarregam os dados em segundo plano a cada ~30 segundos
              e também quando você volta para a aba do navegador. Os botões “Atualizar” continuam
              disponíveis para refresh manual imediato.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

function DocCard({
  to,
  icon,
  title,
  text,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link to={to} className="docs-card">
      <span className="docs-card__icon">{icon}</span>
      <span className="docs-card__title">{title}</span>
      <span className="docs-card__text">{text}</span>
    </Link>
  );
}
