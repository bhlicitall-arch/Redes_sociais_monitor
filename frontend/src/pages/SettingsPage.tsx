import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [connectors, setConnectors] = useState<any[]>([]);

  // Twitter config
  const [twitterToken, setTwitterToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(setUser).catch(() => {});
    api.get('/connectors/status').then(d => setConnectors(d.connectors || [])).catch(() => {});
  }, []);

  const saveTwitterKey = async () => {
    if (!twitterToken) return;
    setSaving(true); setMsg('');
    try {
      await api.post('/connectors/configure', {
        platform: 'twitter',
        credentials: { bearerToken: twitterToken },
      });
      setMsg('Twitter API configurada com sucesso!');
      setTwitterToken('');
      const d = await api.get('/connectors/status');
      setConnectors(d.connectors || []);
    } catch (err: any) {
      setMsg('Erro: ' + err.message);
    }
    setSaving(false);
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

        <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🐦</span>
            <div>
              <div style={{ fontWeight: 600 }}>Twitter / X API v2</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Bearer Token — {connectorStatus('twitter') ? 'CONECTADO' : 'NAO CONECTADO'}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">Bearer Token</label>
            <input
              value={twitterToken}
              onChange={e => setTwitterToken(e.target.value)}
              placeholder="Cole seu Bearer Token (comeca com AAAA...)"
              type="password"
            />
          </div>

          <button className="btn btn-primary btn-sm" onClick={saveTwitterKey} disabled={saving || !twitterToken}>
            {saving ? 'Salvando...' : '> Conectar'}
          </button>

          {msg && <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: msg.includes('sucesso') ? 'var(--accent-green)' : 'var(--accent-red)' }}>{msg}</p>}
        </div>
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
