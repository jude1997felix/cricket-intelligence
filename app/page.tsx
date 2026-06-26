import StatCard from '@/components/ui/StatCard'

export default function OverviewPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Cricket Intelligence
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          IPL T20 analytics — pitch, players, phases, strategy
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Venues Tracked" value="17" sub="IPL + supplemented" accent="blue" />
        <StatCard label="Seasons" value="2008–2024" sub="IPL data" accent="green" />
        <StatCard label="Matches" value="—" sub="Ingest data to populate" accent="amber" />
        <StatCard label="Deliveries" value="—" sub="Ball-by-ball" accent="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            href: '/venues',
            icon: '🏟',
            title: 'Venue Intelligence',
            desc: 'Par scores, pitch type, phase averages, toss win % by ground',
            accent: 'var(--accent-blue)',
          },
          {
            href: '/players',
            icon: '👤',
            title: 'Player Intelligence',
            desc: 'Form index, phase-wise averages, matchup matrix vs pace/spin',
            accent: 'var(--accent-purple)',
          },
          {
            href: '/phases',
            icon: '📊',
            title: 'Phase Analysis',
            desc: 'Powerplay, middle overs & death — benchmarks and batter roles',
            accent: 'var(--accent-green)',
          },
          {
            href: '/matches',
            icon: '📋',
            title: 'Match Explorer',
            desc: 'Browse matches, filter by venue, season, result',
            accent: 'var(--accent-amber)',
          },
          {
            href: '/analysis',
            icon: '🔍',
            title: 'Match Analysis',
            desc: 'Win patterns — toss impact, phase execution, score targets, key differentiators',
            accent: 'var(--accent-red)',
          },
        ].map(card => (
          <a
            key={card.href}
            href={card.href}
            className="block rounded-xl p-5 border transition-colors"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              borderLeft: `3px solid ${card.accent}`,
            }}
          >
            <div className="text-2xl mb-3">{card.icon}</div>
            <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {card.title}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {card.desc}
            </div>
          </a>
        ))}
      </div>

      <div
        className="mt-8 rounded-xl p-6 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Getting Started — Data Ingestion
        </h2>
        <ol className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li>
            <span className="font-mono text-xs px-2 py-0.5 rounded mr-2" style={{ background: 'var(--bg-surface)', color: 'var(--accent-blue)' }}>1</span>
            Download IPL YAML files from{' '}
            <span className="font-mono" style={{ color: 'var(--accent-amber)' }}>cricsheet.org/downloads/</span>
          </li>
          <li>
            <span className="font-mono text-xs px-2 py-0.5 rounded mr-2" style={{ background: 'var(--bg-surface)', color: 'var(--accent-blue)' }}>2</span>
            Run the migration:{' '}
            <span className="font-mono" style={{ color: 'var(--accent-amber)' }}>supabase/migrations/001_initial_schema.sql</span>
          </li>
          <li>
            <span className="font-mono text-xs px-2 py-0.5 rounded mr-2" style={{ background: 'var(--bg-surface)', color: 'var(--accent-blue)' }}>3</span>
            Fill in{' '}
            <span className="font-mono" style={{ color: 'var(--accent-amber)' }}>.env.local</span>{' '}
            with your Supabase credentials
          </li>
          <li>
            <span className="font-mono text-xs px-2 py-0.5 rounded mr-2" style={{ background: 'var(--bg-surface)', color: 'var(--accent-blue)' }}>4</span>
            <span className="font-mono text-xs" style={{ color: 'var(--accent-amber)' }}>
              python scripts/ingestion/ingest.py --dir ./ipl_data --competition IPL
            </span>
          </li>
        </ol>
      </div>
    </div>
  )
}
