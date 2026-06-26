import { clsx } from 'clsx'

type Trend = 'up' | 'down' | 'neutral'

interface Props {
  label: string
  value: string | number
  sub?: string
  trend?: Trend
  accent?: 'green' | 'blue' | 'amber' | 'red' | 'purple'
}

const accentColor: Record<string, string> = {
  green: 'var(--accent-green)',
  blue: 'var(--accent-blue)',
  amber: 'var(--accent-amber)',
  red: 'var(--accent-red)',
  purple: 'var(--accent-purple)',
}

export default function StatCard({ label, value, sub, trend, accent = 'blue' }: Props) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: accentColor[accent] }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
