import { useState, useEffect } from 'react';
import { api } from './lib/api';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { MonitorPage } from './pages/MonitorPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import './index.css';

type Page = 'dashboard' | 'projects' | 'monitor' | 'reports' | 'settings';

function App() {
  const [authed, setAuthed] = useState(api.isLoggedIn());
  const [page, setPage] = useState<Page>('dashboard');

  // Verifica se token ainda é válido ao montar
  useEffect(() => {
    if (authed) {
      api.get('/auth/me').catch(() => {
        api.clearToken();
        setAuthed(false);
      });
    }
  }, [authed]);

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'projects': return <ProjectsPage />;
      case 'monitor': return <MonitorPage />;
      case 'reports': return <ReportsPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  const handleLogout = () => {
    api.clearToken();
    setAuthed(false);
  };

  return (
    <div className="app-layout">
      <Sidebar page={page} setPage={setPage} onLogout={handleLogout} />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
