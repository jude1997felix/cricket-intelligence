interface PhaseData {
  label: string
  overs: string
  avgRPO: number
  color: string
}

const phases: PhaseData[] = [
  { label: 'Powerplay', overs: '1–6', avgRPO: 0, color: 'var(--accent-green)' },
  { label: 'Middle', overs: '7–15', avgRPO: 0, color: 'var(--accent-amber)' },
  { label: 'Death', overs: '16–20', avgRPO: 0, color: 'var(--accent-red)' },
]

interface Props {
  powerplayRPO: number
  middleRPO: number
  deathRPO: number
}

export default function PhaseBar({ powerplayRPO, middleRPO, deathRPO }: Props) {
  const data = [
    { ...phases[0], avgRPO: powerplayRPO },
    { ...phases[1], avgRPO: middleRPO },
    { ...phases[2], avgRPO: deathRPO },
  ]

  const max = Math.max(...data.map(d => d.avgRPO), 12)

  return (
    <div className="space-y-3">
      {data.map(phase => (
        <div key={phase.label}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-secondary)' }}>
              {phase.label} <span style={{ color: 'var(--text-muted)' }}>({phase.overs})</span>
            </span>
            <span className="font-semibold" style={{ color: phase.color }}>
              {phase.avgRPO.toFixed(1)} RPO
            </span>
          </div>
          <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${(phase.avgRPO / max) * 100}%`,
                background: phase.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
