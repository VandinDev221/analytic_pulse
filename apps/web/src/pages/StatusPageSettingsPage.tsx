import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, ExternalLink, Save, Trash2 } from 'lucide-react';
import {
  createMaintenance,
  deleteMaintenance,
  getMe,
  getStatusPageSettings,
  listMaintenance,
  updateStatusPageSettings,
} from '../services/api';
import type { MaintenanceWindow, UpdateStatusPageSettingsInput } from '../types';

export const StatusPageSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [slug, setSlug] = useState('');
  const [form, setForm] = useState<UpdateStatusPageSettingsInput>({
    display_name: '',
    page_title: '',
    page_description: '',
    theme: 'system',
    accent_color: '#6366f1',
    logo_url: '',
    custom_domain: '',
    sla_target_pct: 99.9,
    show_uptime_history: true,
    show_incidents: true,
    show_maintenance: true,
    webhook_url: '',
  });
  const [maintenance, setMaintenance] = useState<MaintenanceWindow[]>([]);
  const [maintForm, setMaintForm] = useState({
    title: '',
    description: '',
    starts_at: '',
    ends_at: '',
  });

  const load = useCallback(async () => {
    try {
      const [settings, me, maint] = await Promise.all([
        getStatusPageSettings(),
        getMe(),
        listMaintenance(),
      ]);
      setSlug(settings.slug || me.slug);
      setForm({
        display_name: settings.display_name || '',
        page_title: settings.page_title || '',
        page_description: settings.page_description || '',
        slug: settings.slug || me.slug,
        theme: settings.theme || 'system',
        accent_color: settings.accent_color || '#6366f1',
        logo_url: settings.logo_url || '',
        custom_domain: settings.custom_domain || '',
        sla_target_pct: Number(settings.sla_target_pct ?? 99.9),
        show_uptime_history: settings.show_uptime_history !== false,
        show_incidents: settings.show_incidents !== false,
        show_maintenance: settings.show_maintenance !== false,
        webhook_url: settings.webhook_url || '',
      });
      setMaintenance(maint);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setOk('');
    try {
      const updated = await updateStatusPageSettings(form);
      setSlug(updated.slug);
      setOk('Configurações salvas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateMaint(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createMaintenance({
        title: maintForm.title,
        description: maintForm.description || undefined,
        starts_at: new Date(maintForm.starts_at).toISOString(),
        ends_at: new Date(maintForm.ends_at).toISOString(),
      });
      setMaintForm({ title: '', description: '', starts_at: '', ends_at: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar manutenção');
    }
  }

  if (loading) {
    return <div className="page"><div className="skeleton" style={{ height: 200, borderRadius: 14 }} /></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Status Page</h1>
          <p className="page-subtitle">Tema, SLA, domínio, manutenção e webhook</p>
        </div>
        <div className="page-header__actions">
          <a className="btn btn-ghost" href={`/status/${slug}`} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Ver página
          </a>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {ok && <div className="alert" style={{ marginBottom: 16, borderColor: 'var(--green)' }}>{ok}</div>}

      <form onSubmit={handleSave} className="glass" style={{ padding: 24, marginBottom: 24 }}>
        <div className="modal-form-grid">
          <div className="form-group">
            <label className="form-label">Display name</label>
            <input className="input" value={form.display_name || ''} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Slug</label>
            <input className="input" value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Título da página</label>
          <input className="input" value={form.page_title || ''} onChange={(e) => setForm({ ...form, page_title: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <textarea className="input" rows={3} value={form.page_description || ''} onChange={(e) => setForm({ ...form, page_description: e.target.value })} />
        </div>
        <div className="modal-form-grid">
          <div className="form-group">
            <label className="form-label">Tema</label>
            <select className="input" value={form.theme || 'system'} onChange={(e) => setForm({ ...form, theme: e.target.value as 'system' | 'light' | 'dark' })}>
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cor de destaque</label>
            <input className="input" type="color" value={form.accent_color || '#6366f1'} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} />
          </div>
        </div>
        <div className="modal-form-grid">
          <div className="form-group">
            <label className="form-label">Logo URL</label>
            <input className="input" value={form.logo_url || ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Domínio personalizado</label>
            <input className="input" placeholder="status.empresa.com" value={form.custom_domain || ''} onChange={(e) => setForm({ ...form, custom_domain: e.target.value })} />
          </div>
        </div>
        <div className="modal-form-grid">
          <div className="form-group">
            <label className="form-label">SLA target (%)</label>
            <input className="input" type="number" step="0.01" value={form.sla_target_pct ?? 99.9} onChange={(e) => setForm({ ...form, sla_target_pct: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Webhook URL</label>
            <input className="input" value={form.webhook_url || ''} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {([
            ['show_uptime_history', 'Histórico uptime'],
            ['show_incidents', 'Incidentes'],
            ['show_maintenance', 'Manutenção'],
          ] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      <div className="glass" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} /> Calendário de manutenção
        </h2>
        <form onSubmit={handleCreateMaint} className="modal__form" style={{ marginBottom: 20 }}>
          <div className="form-group">
            <label className="form-label">Título</label>
            <input className="input" value={maintForm.title} onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="input" value={maintForm.description} onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })} />
          </div>
          <div className="modal-form-grid">
            <div className="form-group">
              <label className="form-label">Início</label>
              <input className="input" type="datetime-local" value={maintForm.starts_at} onChange={(e) => setMaintForm({ ...maintForm, starts_at: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Fim</label>
              <input className="input" type="datetime-local" value={maintForm.ends_at} onChange={(e) => setMaintForm({ ...maintForm, ends_at: e.target.value })} required />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Agendar</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {maintenance.map((m) => (
            <div key={m.id} className="maint-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{m.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(m.starts_at).toLocaleString('pt-BR')} → {new Date(m.ends_at).toLocaleString('pt-BR')}
                </div>
              </div>
              <button
                className="btn btn-danger"
                type="button"
                onClick={async () => {
                  await deleteMaintenance(m.id);
                  await load();
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
