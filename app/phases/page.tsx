export default function PhasesPage() {
  const phases = [
    {
      name: 'Powerplay',
      overs: 'Overs 1–6',
      color: 'var(--accent-green)',
      target: '45–55 runs',
      keyGoal: 'Set platform or go aggressive depending on pitch',
      batterRole: 'Opener: anchor + striker pairing',
      bowlingFocus: 'Attack vs pace — drive, pull, cut',
      keyMetrics: ['RPO target: 7.5–9.2', 'Wickets budget: ≤ 2', 'Boundary %: 55–65%'],
    },
    {
      name: 'Middle Overs',
      overs: 'Overs 7–15',
      color: 'var(--accent-amber)',
      target: '60–75 runs',
      keyGoal: 'Build run rate to 8+ RPO, keep wickets in hand',
      batterRole: 'No. 3 / 4: rotate + accelerate, set up finishers',
      bowlingFocus: 'Spin matchups critical — sweep, slog-sweep',
      keyMetrics: ['RPO target: 7.5–8.5', 'Wickets budget: ≤ 2 more', 'Dot ball tolerance: < 30%'],
    },
    {
      name: 'Death Overs',
      overs: 'Overs 16–20',
      color: 'var(--accent-red)',
      target: '50–65 runs',
      keyGoal: 'Maximum acceleration — finisher must be set',
      batterRole: 'No. 6/7 finisher: power hitter + last-over specialist',
      bowlingFocus: 'Ramp, slog, scoop over fine leg',
      keyMetrics: ['RPO target: 10–13', 'Boundary per over: 2+', 'Wickets-in-hand rule'],
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Phase Analysis
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          T20 batting blueprint — targets, roles, and strategy per phase
        </p>
      </div>

      <div className="space-y-5 mb-8">
        {phases.map(phase => (
          <div
            key={phase.name}
            className="rounded-xl border p-6"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              borderLeft: `4px solid ${phase.color}`,
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div>
                <div className="font-bold text-lg" style={{ color: phase.color }}>
                  {phase.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {phase.overs}
                </div>
              </div>
              <div
                className="ml-auto text-sm font-semibold px-3 py-1 rounded-full"
                style={{ background: `${phase.color}20`, color: phase.color }}
              >
                Target: {phase.target}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Phase Goal
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {phase.keyGoal}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Batter Role
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {phase.batterRole}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Shot Focus
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {phase.bowlingFocus}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {phase.keyMetrics.map(m => (
                <span
                  key={m}
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: `${phase.color}15`, color: phase.color, border: `1px solid ${phase.color}30` }}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* "Good total" guide */}
      <div
        className="rounded-xl border p-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          What Is a Good Total? (T20 IPL)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Below par', range: '< 150', desc: 'Chaseable on most pitches', color: 'var(--accent-red)' },
            { label: 'Par score', range: '150–170', desc: 'Even contest, pitch decides', color: 'var(--accent-amber)' },
            { label: 'Good total', range: '170–195', desc: 'Batting side has edge', color: 'var(--accent-green)' },
            { label: 'Dominant', range: '195+', desc: 'Very hard to chase', color: 'var(--accent-blue)' },
          ].map(t => (
            <div
              key={t.label}
              className="rounded-lg p-4 text-center"
              style={{ background: 'var(--bg-surface)', border: `1px solid ${t.color}30` }}
            >
              <div className="text-xl font-bold mb-1" style={{ color: t.color }}>
                {t.range}
              </div>
              <div className="text-xs font-semibold mb-1" style={{ color: t.color }}>
                {t.label}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t.desc}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          ⚠️ These are general IPL averages. Venue-specific par scores will override once data is ingested.
        </p>
      </div>
    </div>
  )
}
