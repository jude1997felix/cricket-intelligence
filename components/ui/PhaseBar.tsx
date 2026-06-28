interface Props {
  powerplayRPO: number
  middleRPO: number
  accelerateRPO: number
  deathRPO: number
}

export default function PhaseBar({ powerplayRPO, middleRPO, accelerateRPO, deathRPO }: Props) {
  const data = [
    { label: 'Powerplay', overs: '1–6',   rpo: powerplayRPO,   color: 'var(--accent-blue)' },
    { label: 'Middle',    overs: '7–12',  rpo: middleRPO,      color: 'var(--accent-amber)' },
    { label: 'Accel',     overs: '13–16', rpo: accelerateRPO,  color: 'var(--accent-purple)' },
    { label: 'Death',     overs: '17–20', rpo: deathRPO,       color: 'var(--accent-red)' },
  ]
  const max = Math.max(...data.map(d => d.rpo), 12)

  return (
    <div className="space-y-2">
      {data.map(phase => (
        <div key={phase.label}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-secondary)' }}>
              {phase.label} <span style={{ color: 'var(--text-muted)' }}>({phase.overs})</span>
            </span>
            <span className="font-semibold" style={{ color: phase.color }}>
              {phase.rpo > 0 ? `${phase.rpo.toFixed(1)} RPO` : '—'}
            </span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
            <div className="h-1.5 rounded-full transition-all"
              style={{ width: phase.rpo > 0 ? `${(phase.rpo / max) * 100}%` : '0%', background: phase.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
