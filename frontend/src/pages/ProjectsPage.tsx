import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Terminal } from '../components/Terminal';

export function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New project form
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [keywords, setKeywords] = useState('');

  // Monitor state
  const [monitoring, setMonitoring] = useState<string | null>(null);
  const [monitorLog, setMonitorLog] = useState<string[]>([]);
  const [monitorProject, setMonitorProject] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const data = await api.get('/projects');
      setProjects(data.projects || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/projects', {
        name,
        objective: objective || name,
        keywords: keywords.split(',').map((k: string) => k.trim()).filter(Boolean),
      });
      setName(''); setObjective(''); setKeywords(''); setShowNew(false);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startMonitor = async (projectId: string, projectName: string) => {
    setMonitorProject(projectName);
    setMonitoring(projectId);
    setMonitorLog([`$ monitor --project "${projectName}"`]);

    try {
      const data = await api.post(`/projects/${projectId}/monitor`, { priority: 'medium' });
      setMonitorLog(prev => [
        ...prev,
        `> task ${data.taskId.slice(0, 8)}...`,
        ...(data.subtasks || []).map((st: any) =>
          `  ${st.status === 'completed' ? '+' : '~'} [${st.agent}] ${st.result || st.status}`
        ),
        `$ monitoring complete (${data.status})`,
      ]);
    } catch (err: any) {
      setMonitorLog(prev => [...prev, `// ERRO: ${err.message}`]);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Projetos</div>
          <div className="page-subtitle">// gerencie seus projetos de monitoramento</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(!showNew)}>
          {showNew ? 'x Cancelar' : '+ Novo Projeto'}
        </button>
      </div>

      {showNew && (
        <div className="card card-green" style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">{"> "}Novo Projeto</div>
          <form onSubmit={createProject}>
            <div className="form-group">
              <label className="form-label">Nome do Projeto</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Monitoramento Prefeitura de BH" required />
            </div>
            <div className="form-group">
              <label className="form-label">Objetivo</label>
              <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Ex: Monitorar reputacao da Prefeitura de Belo Horizonte" />
            </div>
            <div className="form-group">
              <label className="form-label">Palavras-chave (separadas por virgula)</label>
              <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="prefeitura bh, belo horizonte, pbh" />
            </div>
            <button className="btn btn-primary">{'> Criar Projeto'}</button>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.3 }}>#</div>
          <p style={{ color: 'var(--text-muted)' }}>Nenhum projeto ainda.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Clique em "+ Novo Projeto" para comecar.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Objetivo</th>
                  <th>Status</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{p.objective?.slice(0, 50)}</td>
                    <td><span className="badge badge-green">{p.status}</span></td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startMonitor(p.id, p.name)}
                        disabled={monitoring === p.id}
                      >
                        {monitoring === p.id ? '...' : '> Monitorar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {monitorLog.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="section-title">
            $ monitor log
            <span className="techlicense-badge" style={{ fontSize: '0.6rem' }}>
              <span className="dot" /> {monitorProject}
            </span>
          </div>
          <Terminal lines={monitorLog} />
        </div>
      )}
    </>
  );
}
