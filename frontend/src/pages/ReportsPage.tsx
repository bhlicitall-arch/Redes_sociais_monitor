import { useState } from 'react';
import { api } from '../lib/api';

function renderMarkdown(md: string): string {
  if (!md) return '';

  // Divide em linhas e processa cada uma
  const lines = md.split('\n');
  const result: string[] = [];
  let inTable = false;

  for (const rawLine of lines) {
    const line = rawLine;

    // Headers
    if (line.startsWith('### ')) {
      result.push('<h3 style="color:var(--accent-green);margin:1.5rem 0 0.5rem;font-size:1.1rem">' + line.slice(4) + '</h3>');
      continue;
    }
    if (line.startsWith('## ')) {
      result.push('<h2 style="color:var(--text-primary);margin:1.5rem 0 0.75rem;font-size:1.2rem;border-bottom:1px solid var(--border);padding-bottom:0.25rem">' + line.slice(3) + '</h2>');
      continue;
    }
    if (line.startsWith('# ')) {
      result.push('<h1 style="color:var(--text-primary);margin:1rem 0;font-size:1.4rem">' + line.slice(2) + '</h1>');
      continue;
    }

    // Tabelas
    if (line.startsWith('|') && line.endsWith('|')) {
      if (line.includes('---')) { inTable = true; continue; }
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.length > 0) {
        if (!inTable) { result.push('<div class="table-wrap"><table style="width:100%;border-collapse:collapse">'); inTable = true; }
        result.push('<tr>' + cells.map(c => '<td style="padding:0.35rem 0.75rem;font-size:0.85rem;border-bottom:1px solid var(--border)">' + c + '</td>').join('') + '</tr>');
      }
      continue;
    } else if (inTable) {
      result.push('</table></div>');
      inTable = false;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      result.push('<blockquote style="border-left:3px solid var(--accent-green);padding:0.5rem 1rem;margin:0.5rem 0;background:rgba(163,230,53,0.05);border-radius:0 4px 4px 0;font-style:italic;color:var(--text-secondary)">' + line.slice(2) + '</blockquote>');
      continue;
    }

    // HR
    if (line.trim() === '---') {
      result.push('<hr style="border-color:var(--border);margin:1rem 0"/>');
      continue;
    }

    // Linha em branco
    if (!line.trim()) { continue; }

    // Paragrafo normal
    let processed = line
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" style="color:var(--accent-green);text-decoration:underline">$1</a>');

    result.push('<p style="margin:0.25rem 0;line-height:1.6;font-size:0.88rem">' + processed + '</p>');
  }

  if (inTable) result.push('</table></div>');
  return result.join('\n');
}

export function ReportsPage() {
  const [objective, setObjective] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportMetrics, setReportMetrics] = useState<any>(null);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!objective) return;
    setLoading(true); setError(''); setReportContent(null);

    try {
      const data = await api.post('/reports/generate', { objective }) as any;
      const content = data.report || '';
      setReportContent(content);
      setReportMetrics(data.metrics || null);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const downloadPDF = async () => {
    if (!objective) return;
    try {
      const token = api.getToken();
      const res = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({ objective }),
      });
      if (!res.ok) throw new Error('Falha ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio-midia-monitor.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Erro ao baixar PDF: ' + err.message);
    }
  };

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Relatorios</div>
          <div className="page-subtitle">// relatorio analitico completo com todas as mencoes</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-green">
          <div className="section-title">{'> '}Gerar Relatorio</div>
          <div className="form-group">
            <label className="form-label">Objetivo do Relatorio</label>
            <input
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="Ex: Relatorio de reputacao da Prefeitura de Belo Horizonte"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={generate} disabled={loading || !objective}>
              {loading ? '> gerando...' : '> Gerar Relatorio'}
            </button>
            {reportContent && (
              <button className="btn btn-secondary" onClick={downloadPDF}>
                {'>'} Baixar PDF
              </button>
            )}
          </div>

          {error && <div className="alert-bar critical" style={{ marginTop: '1rem' }}>{error}</div>}

          {reportMetrics && (
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
              <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>{reportMetrics.totalMentions || 0}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mencoes</div>
              </div>
              <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{reportMetrics.totalAnalyses || 0}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Analises</div>
              </div>
              <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: reportMetrics.highRiskCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                  {reportMetrics.highRiskCount || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Alto Risco</div>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title">// Conteudo do Relatorio</div>
          {reportContent ? (
            <div
              className="terminal"
              style={{
                maxHeight: '700px',
                overflowY: 'auto',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                lineHeight: '1.7',
                background: 'var(--bg-primary)',
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(reportContent) }}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">_</div>
              <p>Clique em "Gerar Relatorio" para ver o conteudo analitico</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                O relatorio inclui: mencoes detalhadas, sentimento, risco, engajamento e recomendacoes
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
