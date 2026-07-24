import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import {
  analyzeIncidentWithAi,
  getAiStatus,
} from '../services/api';
import type {
  AiAnalysisStatus,
  IncidentAiAnalysis,
} from '../types';

type Props = {
  incidentId: string;
  initialAnalysis?: IncidentAiAnalysis | null;
  initialStatus?: AiAnalysisStatus | null;
  /** Recarrega o incidente (ex.: após SSE) */
  onRefresh?: () => void;
};

export const IncidentAiAnalysisCard: React.FC<Props> = ({
  incidentId,
  initialAnalysis = null,
  initialStatus = null,
  onRefresh,
}) => {
  const [enabled, setEnabled] = useState(false);
  const [autoRca, setAutoRca] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<IncidentAiAnalysis | null>(
    initialAnalysis
  );
  const [status, setStatus] = useState<AiAnalysisStatus | null>(initialStatus);

  useEffect(() => {
    setAnalysis(initialAnalysis ?? null);
    setStatus(initialStatus ?? null);
  }, [initialAnalysis, initialStatus, incidentId]);

  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((s) => {
        if (!cancelled) {
          setEnabled(s.enabled);
          setAutoRca(Boolean(s.auto_rca));
        }
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setError('');
    setStatus('pending');
    try {
      const result = await analyzeIncidentWithAi(incidentId);
      setAnalysis(result);
      setStatus('ready');
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na análise');
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  }

  const pending = status === 'pending' || loading;
  const showCard = enabled || analysis || status === 'pending' || status === 'failed';

  if (!showCard) {
    return null;
  }

  return (
    <div className="glass" style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <Sparkles size={16} /> Análise com IA
          {analysis?.trigger === 'auto' && (
            <span className="badge badge-unknown" style={{ fontSize: 10 }}>
              automática
            </span>
          )}
        </h2>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={loading || !enabled}
          onClick={runAnalysis}
        >
          {loading
            ? 'Analisando…'
            : analysis
              ? 'Reanalisar'
              : 'Analisar incidente'}
        </button>
      </div>

      {!enabled && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          IA desabilitada no servidor (GROQ_API_KEY).
        </p>
      )}

      {enabled && autoRca && !analysis && pending && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Análise automática em andamento…
        </p>
      )}

      {enabled && autoRca && !analysis && !pending && status !== 'failed' && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Novos incidentes disparam análise automática. Você também pode rodar
          manualmente.
        </p>
      )}

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {analysis && analysis.summary !== 'Falha ao gerar análise automática' && (
        <>
          <p style={{ fontSize: 14, marginBottom: 12 }}>{analysis.summary}</p>

          <h3
            style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}
          >
            Possíveis causas
          </h3>
          <ul className="dash-top-list" style={{ marginBottom: 16 }}>
            {analysis.possible_causes.map((c, i) => (
              <li key={i}>
                <div className="dash-top-list__main">
                  <div className="dash-top-list__name">{c.text}</div>
                  <div className="dash-top-list__meta">{c.explanation}</div>
                </div>
              </li>
            ))}
          </ul>

          <h3
            style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}
          >
            Ações sugeridas
          </h3>
          <ul className="dash-top-list" style={{ marginBottom: 16 }}>
            {analysis.suggested_actions.map((a, i) => (
              <li key={i}>
                <div className="dash-top-list__main">
                  <div className="dash-top-list__name">
                    {a.text}{' '}
                    <span
                      className="badge badge-unknown"
                      style={{ marginLeft: 6 }}
                    >
                      {a.risk}
                    </span>
                  </div>
                  <div className="dash-top-list__meta">{a.explanation}</div>
                </div>
              </li>
            ))}
          </ul>

          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              marginBottom: 8,
            }}
          >
            <strong>Por quê:</strong> {analysis.explanation}
          </p>

          <p
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'flex',
              gap: 6,
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            {analysis.disclaimer} · modelo {analysis.model}
          </p>
        </>
      )}

      {status === 'failed' && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          A análise automática falhou. Use “Reanalisar” para tentar de novo.
        </p>
      )}
    </div>
  );
};
