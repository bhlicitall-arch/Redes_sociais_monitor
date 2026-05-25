import { useState, useEffect, useCallback } from 'react';
import './index.css';

// ============================================================
// Tipos
// ============================================================

type Page = 'dashboard' | 'monitor' | 'reports' | 'alerts' | 'memory' | 'audit' | 'mcp';

interface DashboardData {
  activeTasks: number;
  mcpConnections: number;
  mcpTotal: number;
  auditIntegrity: boolean;
  memoryEntries: number;
  crisisRecords: number;
  timestamp: string;
}

interface TaskInfo {
  id: string;
  objective: string;
  status: string;
  agent?: string;
  result?: { summary?: string } | null;
  error?: string | null;
}

interface MonitorResult {
  taskId: string;
  objective: string;
  status: string;
  subtasks: TaskInfo[];
}

// ============================================================
// API Helper
// ============================================================

const API = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  },
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json();
  },
};

// ============================================================
// Componentes
// ============================================================

function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const items: { id: Page; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'monitor', label: 'Monitorar', icon: '🔍' },
    { id: 'reports', label: 'Relatórios', icon: '📄' },
    { id: 'alerts', label: 'Alertas', icon: '🔔' },
    { id: 'memory', label: 'Memória', icon: '🧠' },
    { id: 'audit', label: 'Auditoria', icon: '🔒' },
    { id: 'mcp', label: 'Conexões MCP', icon: '🔌' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">📡</div>
        <div>
          <div className="sidebar-logo-text">Monitor</div>
          <div className="sidebar-logo-sub">SETUR/CE · Agentic Platform</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        v1.0.0 · Plataforma Agentic de Monitoramento Superior
      </div>
    </aside>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: string;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      </div>
      <div className="card-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {subtitle && <div className="card-label">{subtitle}</div>}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'connected' || status === 'completed' || status === 'ok'
      ? 'var(--accent-green)'
      : status === 'disconnected' || status === 'failed'
      ? 'var(--accent-red)'
      : status === 'medium'
      ? 'var(--accent-yellow)'
      : 'var(--text-muted)';
  return <span className="badge-dot" style={{ background: color }} />;
}

// ============================================================
// Páginas
// ============================================================

function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get<DashboardData>('/api/dashboard/summary')
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    const interval = setInterval(async () => {
      try {
        const d = await API.get<DashboardData>('/api/dashboard/summary');
        setData(d);
      } catch { /* ignore */ }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Visão geral da plataforma de monitoramento</div>
        </div>
        <div className="badge badge-blue">
          <StatusDot status="ok" /> Online
        </div>
      </div>

      <div className="grid-4">
        <MetricCard title="Tarefas Ativas" value={data?.activeTasks ?? '-'} icon="⚡" color="var(--accent-blue)" />
        <MetricCard title="Conexões MCP" value={`${data?.mcpConnections ?? 0}/${data?.mcpTotal ?? 0}`} icon="🔌" color="var(--accent-green)" />
        <MetricCard title="Memória" value={`${data?.memoryEntries ?? 0}`} subtitle="Entradas semânticas" icon="🧠" color="var(--accent-purple)" />
        <MetricCard title="Auditoria" value={data?.auditIntegrity ? 'Íntegra' : '⚠️'} subtitle="Cadeia imutável" icon="🔒" color={data?.auditIntegrity ? 'var(--accent-green)' : 'var(--accent-red)'} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">🔍 Iniciar Monitoramento</div>
          <MonitorForm />
        </div>
        <div className="card">
          <div className="section-title">📋 Últimas Atividades</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <p>Último heartbeat: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('pt-BR') : '—'}</p>
            <p style={{ marginTop: '0.5rem' }}>Registros de crise: {data?.crisisRecords ?? 0}</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
              A plataforma executa um ciclo completo de monitoramento: Coleta → Análise → Risco → Relatório.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Monitor Form
// ============================================================

function MonitorForm() {
  const [objective, setObjective] = useState('Monitore a reputação da SETUR/CE');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonitorResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);
  }, []);

  const handleSubmit = async () => {
    setRunning(true);
    setResult(null);
    setLogs([]);
    addLog(`🚀 Iniciando monitoramento: "${objective}"`);
    addLog(`📌 Prioridade: ${priority}`);

    try {
      const res = await API.post<MonitorResult>('/api/monitor/start', {
        objective,
        priority,
      });
      setResult(res);
      addLog(`✅ Tarefa criada: ${res.taskId.slice(0, 8)}...`);
      addLog(`📋 ${res.subtasks.length} subtarefas geradas`);

      for (const st of res.subtasks) {
        addLog(`   🤖 [${st.agent}] ${st.status === 'completed' ? '✅' : '⏳'} ${st.result?.summary || st.status}`);
      }

      // Polling para atualizar status
      const poll = setInterval(async () => {
        try {
          const updated = await API.get<MonitorResult>(`/api/monitor/status/${res.taskId}`);
          if (updated.status === 'completed' || updated.status === 'failed') {
            clearInterval(poll);
            setResult(updated);
            addLog(`🏁 Monitoramento ${updated.status === 'completed' ? 'concluído ✅' : 'falhou ❌'}`);
            setRunning(false);
          }
        } catch { /* ignore */ }
      }, 1000);

      setTimeout(() => {
        clearInterval(poll);
        setRunning(false);
      }, 30000);
    } catch (err) {
      addLog(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="form-group">
        <label>Objetivo do Monitoramento</label>
        <input
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Ex: Monitore a reputação da SETUR/CE..."
        />
      </div>
      <div className="form-group">
        <label>Prioridade</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
        </select>
      </div>
      <button className="btn btn-primary" onClick={handleSubmit} disabled={running}>
        {running ? '⏳ Monitorando...' : '🚀 Iniciar Monitoramento'}
      </button>

      {logs.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>Logs</div>
          <div className="monitor-output">{logs.join('\n')}</div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>Resultado</div>
          <div className="monitor-output" style={{ color: 'var(--text-primary)' }}>
            {JSON.stringify(result, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Monitor Page
// ============================================================

function MonitorPage() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await API.get<{ tasks: TaskInfo[] }>('/api/monitor/tasks');
      setTasks(data.tasks);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">🔍 Monitoramento</div>
          <div className="page-subtitle">Inicie e acompanhe monitoramentos em tempo real</div>
        </div>
        <button className="btn btn-secondary" onClick={fetchTasks}>🔄 Atualizar</button>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">🎯 Novo Monitoramento</div>
          <MonitorForm />
        </div>
        <div className="card">
          <div className="section-title">📋 Tarefas Ativas ({tasks.length})</div>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p>Nenhuma tarefa ativa no momento</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Objetivo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {t.id.slice(0, 8)}...
                      </td>
                      <td>{t.objective.slice(0, 50)}...</td>
                      <td>
                        <span className={`badge ${t.status === 'completed' ? 'badge-green' : t.status === 'failed' ? 'badge-red' : 'badge-yellow'}`}>
                          <StatusDot status={t.status} /> {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Reports Page
// ============================================================

function ReportsPage() {
  const [objective, setObjective] = useState('Reputação SETUR/CE');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await API.post<{ report: { content?: string } | null }>('/api/reports/generate', {
        objective,
      });
      setReport(res.report?.content ?? 'Relatório vazio');
    } catch (err) {
      setReport(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
    setGenerating(false);
  };

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">📄 Relatórios</div>
          <div className="page-subtitle">Gere relatórios de monitoramento</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">📝 Gerar Relatório</div>
          <div className="form-group">
            <label>Objetivo do Relatório</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? '⏳ Gerando...' : '📄 Gerar Relatório'}
          </button>
        </div>
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title">📋 Conteúdo do Relatório</div>
          {report ? (
            <div className="monitor-output" style={{ color: 'var(--text-primary)', maxHeight: '600px' }}>
              {report}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <p>Clique em "Gerar Relatório" para ver o conteúdo</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Memory Page
// ============================================================

function MemoryPage() {
  const [crises, setCrises] = useState<{ crises: unknown[]; count: number } | null>(null);

  useEffect(() => {
    API.get<{ crises: unknown[]; count: number }>('/api/memory/crises')
      .then(setCrises)
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">🧠 Memória</div>
          <div className="page-subtitle">Registros históricos e contexto semântico</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">📚 Registros de Crise</div>
          <MetricCard title="Total" value={crises?.count ?? 0} icon="📚" color="var(--accent-purple)" />
          {crises && crises.crises.length > 0 ? (
            <div className="table-container" style={{ marginTop: '1rem' }}>
              <table>
                <thead><tr><th>Título</th><th>Nível</th></tr></thead>
                <tbody>
                  {(crises.crises as Array<{ title: string; riskLevel: string }>).map((c, i) => (
                    <tr key={i}><td>{c.title}</td><td>{c.riskLevel}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><p>Nenhum registro histórico de crise</p></div>
          )}
        </div>
        <div className="card">
          <div className="section-title">🔍 Busca Semântica</div>
          <div className="form-group">
            <label>Consulta</label>
            <input placeholder="Ex: crise reputacional SETUR..." />
          </div>
          <button className="btn btn-primary btn-sm">Buscar</button>
          <div className="empty-state" style={{ marginTop: '1rem' }}>
            <div className="empty-state-icon">🔍</div>
            <p>Resultados aparecerão aqui</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Audit Page
// ============================================================

function AuditPage() {
  const [integrity, setIntegrity] = useState<{ valid: boolean; brokenEntries: number } | null>(null);

  useEffect(() => {
    API.get<{ valid: boolean; brokenEntries: number }>('/api/audit/integrity')
      .then(setIntegrity)
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">🔒 Auditoria</div>
          <div className="page-subtitle">Logs imutáveis e integridade da cadeia</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">🛡️ Integridade</div>
          {integrity ? (
            <>
              <MetricCard
                title="Status da Cadeia"
                value={integrity.valid ? '✅ Íntegra' : '❌ Comprometida'}
                icon="🔗"
                color={integrity.valid ? 'var(--accent-green)' : 'var(--accent-red)'}
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Entradas quebradas: {integrity.brokenEntries}
              </p>
            </>
          ) : (
            <div className="loading-spinner"><div className="spinner" /></div>
          )}
        </div>
        <div className="card">
          <div className="section-title">📋 Logs Recentes</div>
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>Logs de auditoria aparecerão aqui</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// MCP Page
// ============================================================

function MCPPage() {
  const [connections, setConnections] = useState<Array<{ name: string; status: string; connected: boolean }> | null>(null);

  useEffect(() => {
    API.get<{ connections: Array<{ name: string; status: string; connected: boolean }> }>('/api/dashboard/mcp-status')
      .then((d) => setConnections(d.connections))
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">🔌 Conexões MCP</div>
          <div className="page-subtitle">Status das integrações com plataformas externas</div>
        </div>
      </div>
      <div className="card">
        <div className="section-title">📡 Endpoints</div>
        {connections ? (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Endpoint</th><th>Status</th><th>Conectado</th></tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>
                      <span className={`badge ${c.connected ? 'badge-green' : 'badge-red'}`}>
                        <StatusDot status={c.status} /> {c.status}
                      </span>
                    </td>
                    <td>{c.connected ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="loading-spinner"><div className="spinner" /></div>
        )}
      </div>
    </>
  );
}

// ============================================================
// Alerts Page (placeholder)
// ============================================================

function AlertsPage() {
  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">🔔 Alertas</div>
          <div className="page-subtitle">Notificações de eventos e crises</div>
        </div>
      </div>
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <p>Nenhum alerta ativo no momento</p>
        </div>
      </div>
    </>
  );
}

// ============================================================
// App Principal
// ============================================================

function App() {
  const [page, setPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'monitor': return <MonitorPage />;
      case 'reports': return <ReportsPage />;
      case 'alerts': return <AlertsPage />;
      case 'memory': return <MemoryPage />;
      case 'audit': return <AuditPage />;
      case 'mcp': return <MCPPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar page={page} setPage={setPage} />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
