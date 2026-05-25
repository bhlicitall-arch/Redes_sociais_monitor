type Page = 'dashboard' | 'projects' | 'monitor' | 'reports' | 'settings';

export function Sidebar({ page, setPage, onLogout }: { page: Page; setPage: (p: Page) => void; onLogout: () => void }) {
  const items: { id: Page; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '~' },
    { id: 'projects', label: 'Projetos', icon: '#' },
    { id: 'monitor', label: 'Monitorar', icon: '>' },
    { id: 'reports', label: 'Relatorios', icon: '_' },
    { id: 'settings', label: 'Config', icon: '$' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">M</div>
        <div>
          <div className="sidebar-logo-text">Midia Monitor</div>
          <div className="sidebar-logo-sub">// By Techlicense</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">// Navegacao</div>
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
        <button className="sidebar-item" onClick={onLogout}>
          <span className="sidebar-item-icon">x</span>
          Sair
        </button>
        <div style={{ padding: '0.75rem', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--accent-green)' }}>$</span> v1.0.0 // Midia Monitor
        </div>
      </div>
    </aside>
  );
}
