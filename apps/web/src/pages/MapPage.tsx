import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  RefreshCw,
  Map as MapIcon,
  Activity,
  Gauge,
  Globe2,
} from 'lucide-react';
import { getMapOverview } from '../services/api';
import type { MapOverview, MapServiceNode } from '../types';
import { WorldMapCanvas } from '../components/map/WorldMapCanvas';
import { usePolling, POLL_INTERVAL_MS } from '../hooks/usePolling';

function formatAgo(iso: string | null): string {
  if (!iso) return 'nunca';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s atrás`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m atrás`;
  return `${Math.floor(min / 60)}h atrás`;
}

export const MapPage: React.FC = () => {
  const [data, setData] = useState<MapOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MapServiceNode | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const overview = await getMapOverview();
      setData(overview);
      setLastUpdated(new Date());
      setError('');
      setSelected((prev) => {
        if (!prev) return null;
        return overview.nodes.find((n) => n.id === prev.id) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar mapa');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(() => load(true), POLL_INTERVAL_MS, !loading);

  const s = data?.summary;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__title-row">
            <h1>Mapa Mundial</h1>
            {!loading && (
              <span className="live-badge">
                <Radio size={10} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                Heartbeat
              </span>
            )}
          </div>
          <p className="page-header__desc">
            Nós por região, latência e pulso dos checks.
            {lastUpdated && (
              <span className="page-header__updated">
                Atualizado {lastUpdated.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-ghost" onClick={() => load()} disabled={refreshing}>
            <RefreshCw
              size={14}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
            />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-sm" style={{ padding: 12, marginBottom: 16, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading || !data ? (
        <div className="glass world-map-skeleton" />
      ) : (
        <>
          <div className="map-kpi-row">
            <div className="glass-sm map-kpi">
              <Activity size={14} />
              <div>
                <div className="map-kpi__value">{s?.monitors_total ?? 0}</div>
                <div className="map-kpi__label">Serviços</div>
              </div>
            </div>
            <div className="glass-sm map-kpi">
              <Globe2 size={14} />
              <div>
                <div className="map-kpi__value">{s?.regions_active ?? 0}</div>
                <div className="map-kpi__label">Regiões</div>
              </div>
            </div>
            <div className="glass-sm map-kpi">
              <span className="pulse-dot pulse-dot-green" />
              <div>
                <div className="map-kpi__value" style={{ color: 'var(--green)' }}>
                  {s?.monitors_up ?? 0}
                </div>
                <div className="map-kpi__label">Online</div>
              </div>
            </div>
            <div className="glass-sm map-kpi">
              <span className={`pulse-dot ${(s?.monitors_down ?? 0) > 0 ? 'pulse-dot-red' : ''}`} />
              <div>
                <div
                  className="map-kpi__value"
                  style={{ color: (s?.monitors_down ?? 0) > 0 ? 'var(--red)' : 'var(--text-muted)' }}
                >
                  {s?.monitors_down ?? 0}
                </div>
                <div className="map-kpi__label">Offline</div>
              </div>
            </div>
            <div className="glass-sm map-kpi">
              <Gauge size={14} />
              <div>
                <div className="map-kpi__value">
                  {s?.avg_latency_ms != null ? `${s.avg_latency_ms} ms` : '—'}
                </div>
                <div className="map-kpi__label">Latência média</div>
              </div>
            </div>
          </div>

          <div className="map-layout">
            <div className="glass map-stage">
              {data.nodes.length === 0 ? (
                <div className="dash-empty" style={{ padding: 80 }}>
                  <MapIcon size={28} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div>Nenhum monitor ativo para exibir no mapa.</div>
                  <p style={{ marginTop: 8, fontSize: 13 }}>
                    Crie monitores e defina a região geográfica.
                  </p>
                </div>
              ) : (
                <WorldMapCanvas
                  data={data}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelected}
                />
              )}
            </div>

            <aside className="glass map-side">
              <h2>Detalhe</h2>
              {selected ? (
                <div className="map-side__detail">
                  <div className="map-side__name">{selected.name}</div>
                  <div className="map-side__row">
                    <span>Status</span>
                    <strong style={{ color: selected.status === 'up' ? 'var(--green)' : selected.status === 'down' ? 'var(--red)' : undefined }}>
                      {selected.status}
                    </strong>
                  </div>
                  <div className="map-side__row">
                    <span>Latência</span>
                    <strong>
                      {selected.last_response_time_ms != null
                        ? `${selected.last_response_time_ms} ms`
                        : '—'}
                    </strong>
                  </div>
                  <div className="map-side__row">
                    <span>Região</span>
                    <strong>{selected.region_code.toUpperCase()}</strong>
                  </div>
                  <div className="map-side__row">
                    <span>Heartbeat</span>
                    <strong style={{ color: selected.heartbeat_alive ? 'var(--green)' : 'var(--text-muted)' }}>
                      {selected.heartbeat_alive ? 'vivo' : 'atrasado'} · {formatAgo(selected.last_checked_at)}
                    </strong>
                  </div>
                  <div className="map-side__row">
                    <span>Tipo</span>
                    <strong>{selected.check_type.toUpperCase()}</strong>
                  </div>
                  <Link className="btn btn-ghost" to={`/monitors/${selected.id}`} style={{ marginTop: 12 }}>
                    Abrir monitor
                  </Link>
                </div>
              ) : (
                <p className="map-side__hint">Selecione um nó no mapa para ver latência e heartbeat.</p>
              )}

              <h2 style={{ marginTop: 24 }}>Regiões</h2>
              <ul className="map-region-list">
                {data.regions.length === 0 && (
                  <li className="dash-empty" style={{ padding: 12 }}>Sem regiões ativas</li>
                )}
                {data.regions.map((r) => (
                  <li key={r.region.code}>
                    <div className="map-region-list__title">
                      {r.region.city || r.region.name}
                      <span>{r.region.code.toUpperCase()}</span>
                    </div>
                    <div className="map-region-list__meta">
                      {r.monitors_up}/{r.monitors_total} up
                      {r.avg_latency_ms != null && ` · ${r.avg_latency_ms} ms`}
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};
