import { useState } from 'react';
import { api } from '../lib/api';
import { Terminal } from '../components/Terminal';

export function MonitorPage() {
  const [objective, setObjective] = useState('');
  const [priority, setPriority] = useState('medium');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  const start = async () => {
    if (!objective) return;
    setRunning(true);
    setLogs([`$ monitor --objective "${objective}" --priority ${priority}`]);
    setResult(null);

    try {
      const data = await api.post('/monitor/start', { objective, priority });
      setResult(data);
      setLogs(prev => [
        ...prev,
        `> task ${data.taskId.slice(0, 8)}...`,
        `> ${data.subtasks?.length || 0} subtasks`,
        ...(data.subtasks || []).map((st: any) =>
          `  ${st.status === 'completed' ? '+' : '~'} [${st.agent}] ${st.result || st.status}`
        ),
        `$ status: ${data.status}`,
      ]);
    } catch (err: any) {
      setLogs(prev => [...prev, `// ERRO: ${err.message}`]);
    }
    setRunning(false);
  };

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Monitorar</div>
          <div className="page-subtitle">// execute monitoramentos sob demanda</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-green">
          <div className="section-title">{"> "}Comando</div>
          <div className="form-group">
            <label className="form-label">Objetivo</label>
            <input
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="Ex: Monitorar reputacao da marca X"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Prioridade</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={start} disabled={running || !objective}>
            {running ? '> executando...' : '> Executar'}
          </button>
        </div>

        <div className="card">
          <div className="section-title">$ Log</div>
          <Terminal lines={logs} />
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="section-title">// Resultado</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Agente</th><th>Status</th><th>Resultado</th></tr></thead>
              <tbody>
                {(result.subtasks || []).map((st: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>[{st.agent}]</td>
                    <td><span className={`badge ${st.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>{st.status}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{st.result || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
