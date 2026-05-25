export function MetricCard({ title, value, subtitle, icon, color }: { title: string; value: string | number; subtitle?: string; icon: string; color?: string }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{icon}</span>
      </div>
      <div className="card-value" style={color ? { color } : undefined}>{value}</div>
      {subtitle && <div className="card-label">{subtitle}</div>}
    </div>
  );
}
