export function Terminal({ lines, error }: { lines: string[]; error?: string }) {
  return (
    <div className="terminal">
      {error && <div className="terminal-line error">// ERRO: {error}</div>}
      {lines.map((line, i) => (
        <div key={i} className={line.includes('ERRO') || line.includes('FAIL') ? 'terminal-line error' : line.startsWith('$') ? 'terminal-line' : 'terminal-line info'}>
          {line}
        </div>
      ))}
      {lines.length === 0 && !error && <div className="terminal-line info">// aguardando comando...</div>}
    </div>
  );
}
