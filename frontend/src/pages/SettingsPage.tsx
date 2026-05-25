import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    api.get('/auth/me').then(setUser).catch(() => {});
  }, []);

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Config</div>
          <div className="page-subtitle">// informacoes da conta e do sistema</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">$ Conta</div>
          {user && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: '2.2', color: 'var(--text-secondary)' }}>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> usuario: {user.user?.name || '—'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> email: {user.user?.email || '—'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> empresa: {user.tenant?.name || '—'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> plano: {user.tenant?.plan || '—'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> slug: {user.tenant?.slug || '—'}</div>
              <div><span style={{ color: 'var(--accent-green)' }}>$</span> projetos: {user.projects?.length || 0}</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">// Planos</div>
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
                <li>API e webhooks</li>
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
                <li>SLA 99.9%</li>
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
