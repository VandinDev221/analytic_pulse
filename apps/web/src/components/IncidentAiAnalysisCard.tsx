import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import {
  analyzeIncidentWithAi,
  getAiStatus,
} from '../services/api';
import type { IncidentAiAnalysis } from '../types';

type Props = {
  incidentId: string;
};

export const IncidentAiAnalysisCard: React.FC<Props> = ({ incidentId }) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<IncidentAiAnalysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((s) => {
        if (!cancelled) setEnabled(s.enabled);
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
    try {
      setAnalysis(await analyzeIncidentWithAi(incidentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na análise');
    } finally {
      setLoading(false);
    }
  }

  if (!enabled && !analysis) {
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
        <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Sparkles size={16} /> Análise com IA
        </h2>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={loading || !enabled}
          onClick={runAnalysis}
        >
          {loading ? 'Analisando…' : analysis ? 'Reanalisar' : 'Analisar incidente'}
        </button>
      </div>

      {!enabled && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          IA desabilitada no servidor (GROQ_API_KEY).
        </p>
      )}

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {analysis && (
        <>
          <p style={{ fontSize: 14, marginBottom: 12 }}>{analysis.summary}</p>

          <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
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

          <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Ações sugeridas
          </h3>
          <ul className="dash-top-list" style={{ marginBottom: 16 }}>
            {analysis.suggested_actions.map((a, i) => (
              <li key={i}>
                <div className="dash-top-list__main">
                  <div className="dash-top-list__name">
                    {a.text}{' '}
                    <span className="badge badge-unknown" style={{ marginLeft: 6 }}>
                      {a.risk}
                    </span>
                  </div>
                  <div className="dash-top-list__meta">{a.explanation}</div>
                </div>
              </li>
            ))}
          </ul>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
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
    </div>
  );
};
