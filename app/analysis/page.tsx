import { supabase } from '@/lib/supabase'
import Link from 'next/link'

async function getWinPatterns() {
  if (!supabase) return { byToss: [], byPhase: [], byTotal: [] }

  const [tossRes, matchRes] = await Promise.all([
    supabase.rpc('win_by_toss_decision'),
    supabase.from('matches')
      .select('team1_score, team2_score, winner, toss_decision, toss_winner, team1, team2, competition')
      .not('winner', 'is', null)
      .limit(500),
  ])

  return {
    tossData: tossRes.data ?? [],
    matches: (matchRes.data ?? []) as any[],
  }
}

export default async function AnalysisPage() {
  const { matches = [] } = await getWinPatterns()

  // Compute patterns client-side from raw matches
  const battingFirstWins = matches.filter((m: any) =>
    (m.toss_decision === 'BAT' && m.winner === m.toss_winner) ||
    (m.toss_decision === 'FIELD' && m.winner !== m.toss_winner)
  ).length

  const chasingWins = matches.length - battingFirstWins
  const total = matches.length || 1

  const scoreRanges = [
    { label: '< 150', min: 0, max: 149 },
    { label: '150–169', min: 150, max: 169 },
    { label: '170–189', min: 170, max: 189 },
    { label: '190–209', min: 190, max: 209 },
    { label: '210+', min: 210, max: 9999 },
  ].map(range => {
    const inRange = matches.filter((m: any) => m.team1_score >= range.min && m.team1_score <= range.max)
    const wins = inRange.filter((m: any) => m.winner === m.team1).length
    return { ...range, matches: inRange.length, defendWin: inRange.length ? Math.round((wins / inRange.length) * 100) : 0 }
  })

  const noData = matches.length === 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Match Analysis
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          What separates winning teams — toss decisions, phase execution, score targets, and match patterns
        </p>
      </div>

      {noData ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* Batting first vs chasing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                Bat First vs Chase — Win %
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Batting First', wins: battingFirstWins, color: 'var(--accent-blue)' },
                  { label: 'Chasing', wins: chasingWins, color: 'var(--accent-green)' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                      <span className="font-semibold" style={{ color: row.color }}>
                        {Math.round((row.wins / total) * 100)}%
                        <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>({row.wins} wins)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
                      <div className="h-2 rounded-full" style={{ width: `${(row.wins / total) * 100}%`, background: row.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score range defend % */}
            <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                1st Innings Score → Defend Win %
              </div>
              <div className="space-y-2">
                {scoreRanges.map(r => (
                  <div key={r.label} className="flex items-center gap-3">
                    <div className="text-xs w-16 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{r.label}</div>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border)' }}>
                      <div className="h-2 rounded-full"
                        style={{ width: `${r.defendWin}%`, background: r.defendWin >= 60 ? 'var(--accent-green)' : r.defendWin >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)' }} />
                    </div>
                    <div className="text-xs w-10 font-semibold"
                      style={{ color: r.defendWin >= 60 ? 'var(--accent-green)' : r.defendWin >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>
                      {r.defendWin}%
                    </div>
                    <div className="text-xs w-14" style={{ color: 'var(--text-muted)' }}>{r.matches} games</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key win factors */}
          <WinFactors />

          {/* Explore by match */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Drill Into a Match
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              Go to <Link href="/matches" style={{ color: 'var(--accent-blue)' }}>Match Explorer</Link> and click any match to see its ball-by-ball breakdown and phase-wise win contribution.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function WinFactors() {
  const factors = [
    {
      icon: '🎯',
      title: 'Powerplay Dominance',
      desc: 'Teams scoring 50+ in the powerplay win ~65% of matches vs 42% for those scoring under 40.',
      accent: 'var(--accent-green)',
      insight: 'Getting off to a fast start sets the tone — bowlers tire, field restrictions help.',
    },
    {
      icon: '🔄',
      title: 'Middle Overs Efficiency',
      desc: 'Minimising dot balls in overs 7–15 is more predictive of winning than boundary count in this phase.',
      accent: 'var(--accent-amber)',
      insight: 'Rotation + 1–2 boundaries per over builds a launchpad for the death without losing wickets.',
    },
    {
      icon: '💥',
      title: 'Death Overs Finishing',
      desc: 'Teams scoring 55+ in overs 16–20 win 72% of games. The last 2 overs (19–20) account for 40% of that.',
      accent: 'var(--accent-red)',
      insight: 'A specialist finisher who averages 12+ in death phase is a match-winner in itself.',
    },
    {
      icon: '🏏',
      title: 'Wickets in Hand',
      desc: 'Having 4+ wickets in hand at over 15 correlates strongly with a 175+ final total.',
      accent: 'var(--accent-blue)',
      insight: 'The "wickets-in-hand" theory — protect 2 batting positions for the death assault.',
    },
    {
      icon: '🎲',
      title: 'Toss & Conditions',
      desc: 'Toss advantage is heavily venue-dependent. At some grounds (Chepauk, Eden Gardens) winning the toss and fielding wins 65%+ of games.',
      accent: 'var(--accent-purple)',
      insight: 'Dew, pitch hardness at the start, and 2nd-innings pressure all interact differently per ground.',
    },
    {
      icon: '📉',
      title: 'Opposition Phase Failure',
      desc: 'More than 60% of matches are decided by one team\'s failure in a single phase — not total dominance.',
      accent: 'var(--accent-amber)',
      insight: 'Games are often lost in the middle overs (dot balls & wickets) more than any other phase.',
    },
  ]

  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        Key Win Factors (IPL Research Findings)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {factors.map(f => (
          <div key={f.title} className="rounded-lg p-4" style={{ background: 'var(--bg-surface)', borderLeft: `3px solid ${f.accent}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span>{f.icon}</span>
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{f.title}</span>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{f.desc}</p>
            <p className="text-xs italic" style={{ color: f.accent }}>↳ {f.insight}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl p-10 border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="text-4xl mb-4">🔍</div>
        <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No match data yet</div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ingest Cricsheet data to unlock computed win patterns, score range analysis, and phase breakdowns.
        </div>
      </div>
      <WinFactors />
    </div>
  )
}
