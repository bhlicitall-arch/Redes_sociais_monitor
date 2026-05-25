import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [connectors, setConnectors] = useState<any[]>([]);

  // Platform configs
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(setUser).catch(() => {});
    api.get('/connectors/status').then(d => setConnectors(d.connectors || [])).catch(() => {});
  }, []);

  const platformInfo: Record<string, { icon: string; label: string; field: string; fieldLabel: string; placeholder: string }> = {
    twitter: { icon: '🐦', label: 'Twitter / X API v2', field: 'bearerToken', fieldLabel: 'Bearer Token', placeholder: 'AAAA...' },
    instagram: { icon: '📸', label: 'Instagram Graph API', field: 'accessToken', fieldLabel: 'Access Token', placeholder: 'EAA...' },
    facebook: { icon: '👍', label: 'Facebook Graph API', field: 'accessToken', fieldLabel: 'Access Token', placeholder: 'EAA...' },
    youtube: { icon: '▶️', label: 'YouTube Data API', field: 'apiKey', fieldLabel: 'API Key', placeholder: 'AIza...' },
    news_portal: { icon: '📰', label: 'RSS News (G1, UOL)', field: '', fieldLabel: '', placeholder: '' },
  };

  const saveKey = async (platform: string) => {
    const val = keys[platform];
    if (!val) return;
    setSaving(platform); setMsg('');
    try {
      const info = platformInfo[platform];
      await api.post('/connectors/configure', {
        platform,
        credentials: { [info.field]: val },
      });
      setMsg(platform + ' configurada com sucesso!');
      setKeys(prev => ({ ...prev, [platform]: '' }));
      const d = await api.get('/connectors/status');
      setConnectors(d.connectors || []);
    } catch (err: any) {
      setMsg('Erro: ' + err.message);
    }
    setSaving(null);
  };

  const connectorStatus = (platform: string) => {
    const c = connectors.find((x: any) => x.platform === platform);
    return c?.connected || false;
  };

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Configuracoes</div>
          <div className="page-subtitle">// API Keys, conta e planos</div>
        </div>
      </div>

      {/* API KEYS */}
      <div className="card card-green" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">{'> '}Conexao com APIs Reais</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Configure as chaves de API para buscar dados reais das plataformas.
          Sem chaves, os dados sao simulados para demonstracao.
        </p>

        <table style={{ marginBottom: '1.5rem' }}>
          <thead><tr><th>Plataforma</th><th>Conexao</th><th>Tipo</th></tr></thead>
          <tbody>
            {connectors.map((c: any) => (
              <tr key={c.platform}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>
                  <span className={`badge ${c.connected ? 'badge-green' : 'badge-yellow'}`}>
                    <span className="badge-dot" style={{ background: c.connected ? 'var(--accent-green)' : 'var(--accent-yellow)' }} />
                    {c.connected ? 'Conectado' : 'Simulado'}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {c.hasApi ? 'API oficial' : 'RSS / scraping'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {Object.entries(platformInfo).map(([platform, info]) => (
          <div key={platform} style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>{info.icon}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{info.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {connectorStatus(platform) ? 'CONECTADO' : info.field ? 'NAO CONECTADO - Configurar chave' : 'Sempre ativo (RSS)'}
                </div>
              </div>
            </div>

            {info.field && (
              <>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">{info.fieldLabel}</label>
                  <input
                    value={keys[platform] || ''}
                    onChange={e => setKeys(prev => ({ ...prev, [platform]: e.target.value }))}
                    placeholder={info.placeholder}
                    type="password"
                  />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => saveKey(platform)} disabled={saving === platform || !keys[platform]}>
                  {saving === platform ? 'Salvando...' : '> Conectar'}
                </button>
              </>
            )}
          </div>
        ))}

        {msg && <p style={{ fontSize: '0.85rem', color: msg.includes('sucesso') ? 'var(--accent-green)' : 'var(--accent-red)' }}>{msg}</p>}
      </div>

      {/* CONTA */}
      <div className="grid-2">
        <div className="card">
          <div className="section-title">{'$ '}Conta</div>
          {user && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: '2.2', color: 'var(--text-secondary)' }}>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> usuario: {user.user?.name || '---'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> email: {user.user?.email || '---'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> empresa: {user.tenant?.name || '---'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> plano: {user.tenant?.plan || '---'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> projetos: {user.projects?.length || 0}</div>
            </div>
          )}
        </div>

        {/* PLANOS */}
        <div className="card">
          <div className="section-title">{'// '}Planos</div>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="plan-card">
              <div className="plan-name">Starter</div>
              <div className="plan-price">R$ 97<span>/mes</span></div>
              <ul className="plan-features">
                <li>3 projetos</li>
                <li>5 plataformas</li>
                <li>Relatorios semanais</li>
              </ul>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Contratar</button>
            </div>
            <div className="plan-card featured">
              <div className="plan-name">Professional</div>
              <div className="plan-price">R$ 297<span>/mes</span></div>
              <ul className="plan-features">
                <li>15 projetos</li>
                <li>Todas as plataformas</li>
                <li>Relatorios diarios</li>
                <li>API Keys reais</li>
              </ul>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Contratar</button>
            </div>
            <div className="plan-card">
              <div className="plan-name">Enterprise</div>
              <div className="plan-price">R$ 997<span>/mes</span></div>
              <ul className="plan-features">
                <li>Projetos ilimitados</li>
                <li>Crisis bot + alertas</li>
                <li>Relatorios em tempo real</li>
                <li>Suporte prioritario</li>
              </ul>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Falar conosco</button>
            </div>
          </div>
        </div>
      </div>

      <div className="techlicense-footer" style={{ marginTop: '2rem' }}>
        <span className="tl-dot">$</span> Midia Monitor <span className="tl-dot">//</span> By Techlicense v1.0.0
      </div>
    </>
  );
}
