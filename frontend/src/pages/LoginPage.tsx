import { useState } from 'react';
import { api } from '../lib/api';

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [lEmail, setLEmail] = useState('');
  const [lPassword, setLPassword] = useState('');

  // Register fields
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/login', { email: lEmail, password: lPassword });
      api.setToken(data.token);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/register', {
        companyName, slug: slug || companyName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        adminName, adminEmail, adminPassword, plan: 'trial',
      });
      api.setToken(data.token);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">M</div>
          <div className="auth-title">Midia Monitor</div>
          <div className="auth-subtitle">Plataforma de monitoramento de reputacao</div>
        </div>

        <div className="auth-card">
          <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', padding: '3px' }}>
            <button
              onClick={() => setTab('login')}
              style={{
                flex: 1, padding: '0.6rem', borderRadius: '4px', border: 'none',
                background: tab === 'login' ? 'var(--accent-green)' : 'transparent',
                color: tab === 'login' ? '#000' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >Entrar</button>
            <button
              onClick={() => setTab('register')}
              style={{
                flex: 1, padding: '0.6rem', borderRadius: '4px', border: 'none',
                background: tab === 'register' ? 'var(--accent-green)' : 'transparent',
                color: tab === 'register' ? '#000' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >Criar Conta</button>
          </div>

          {error && <div className="alert-bar critical">{error}</div>}

          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" value={lEmail} onChange={e => setLEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Senha</label>
                <input type="password" value={lPassword} onChange={e => setLPassword(e.target.value)} placeholder="minimo 6 caracteres" required />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Entrando...' : '> Entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Nome da Empresa</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Agencia Marketing BH" required />
              </div>
              <div className="form-group">
                <label className="form-label">Slug (URL)</label>
                <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="agencia-marketing-bh" />
              </div>
              <div className="form-group">
                <label className="form-label">Seu Nome</label>
                <input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Ex: Joao Silva" required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Senha</label>
                <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="minimo 6 caracteres" required />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Criando...' : '> Criar Conta'}
              </button>
            </form>
          )}
        </div>

        <div className="techlicense-footer">
          <span className="tl-dot">$</span> Midia Monitor <span className="tl-dot">//</span> By Techlicense
        </div>
      </div>
    </div>
  );
}
