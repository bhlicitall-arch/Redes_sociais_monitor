import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { MetricCard } from '../components/MetricCard';

export function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/auth/me'),
    ]).then(([d, u]) => {
      setData(d);
      setUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));

    const iv = setInterval(async () => {
      try { setData(await api.get('/dashboard/summary')); } catch {}
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            {user?.tenant?.name ? `// ${user.tenant.name}` : '// visao geral do sistema'}
          </div>
        </div>
        <div className="techlicense-badge">
          <span className="dot" /> By Techlicense
        </div>
      </div>

      <div className="grid-4">
        <MetricCard title="Tarefas Ativas" value={data?.activeTasks ?? '-'} icon="&gt;" color="var(--accent-green)" />
        <MetricCard title="Conexoes MCP" value={`${data?.mcpConnections ?? 0}/${data?.mcpTotal ?? 0}`} icon="#" color="var(--accent-blue)" />
        <MetricCard title="Auditoria" value={data?.auditIntegrity ? 'INTEGRA' : 'FALHA'} icon="$" color={data?.auditIntegrity ? 'var(--accent-green)' : 'var(--accent-red)'} />
        <MetricCard title="Projetos" value={user?.projects?.length ?? 0} icon="~" color="var(--accent-purple)" />
      </div>

      <div className="grid-2">
        <div className="card card-green">
          <div className="section-title">{"> "}Projetos</div>
          {user?.projects?.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nome</th><th>Status</th><th>Palavras-chave</th></tr></thead>
                <tbody>
                  {user.projects.map((p: any) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td><span className="badge badge-green">{p.status}</span></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {JSON.parse(p.keywords || '[]').join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">#</div>
              <p>Nenhum projeto ainda. Crie um projeto para comecar.</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">$ Sistema</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '2' }}>
            <div><span style={{ color: 'var(--accent-green)' }}>$</span> plataforma {data?.auditIntegrity ? 'OK' : 'FALHA'}</div>
            <div><span style={{ color: 'var(--accent-green)' }}>$</span> mcp {data?.mcpConnections}/{data?.mcpTotal} connected</div>
            <div><span style={{ color: 'var(--accent-green)' }}>$</span> usuario: {user?.user?.email || '—'}</div>
            <div><span style={{ color: 'var(--accent-green)' }}>$</span> plano: {user?.tenant?.plan || 'trial'}</div>
          </div>
        </div>
      </div>
    </>
  );
}
