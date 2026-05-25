import { useState } from 'react';
import { api } from '../lib/api';
import { Terminal } from '../components/Terminal';

export function ReportsPage() {
  const [objective, setObjective] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const generate = async () => {
    if (!objective) return;
    setLoading(true);
    setLogs([`$ generate --report "${objective}"`]);
    setReport(null);

    try {
      const data = await api.post('/reports/generate', { objective });
      setLogs(prev => [...prev, `> task ${(data as any).taskId?.slice(0, 8)}...`, '$ report ready']);

      const content = (data as any).report?.content;
      if (content) {
        setReport(content);
      } else {
        setReport(JSON.stringify((data as any).report, null, 2));
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `// ERRO: ${err.message}`]);
    }
    setLoading(false);
  };

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Relatorios</div>
          <div className="page-subtitle">// gere relatorios de monitoramento</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-green">
          <div className="section-title">{"> "}Novo Relatorio</div>
          <div className="form-group">
            <label className="form-label">Objetivo do Relatorio</label>
            <input
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="Ex: Relatorio de reputacao da marca"
            />
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !objective}>
            {loading ? '> gerando...' : '> Gerar Relatorio'}
          </button>
          <div style={{ marginTop: '1rem' }}>
            <Terminal lines={logs} />
          </div>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title">// Conteudo</div>
          {report ? (
            <div className="terminal" style={{ maxHeight: '500px', color: 'var(--text-primary)' }}>
              {report}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">_</div>
              <p>Clique em "Gerar Relatorio" para ver o conteudo</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
