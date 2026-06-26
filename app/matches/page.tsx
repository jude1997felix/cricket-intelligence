import { supabase } from '@/lib/supabase'
import Link from 'next/link'

async function getMatches() {
  if (!supabase) return []
  const { data } = await supabase
    .from('matches')
    .select('*, venues(name, city)')
    .order('match_date', { ascending: false })
    .limit(50)
  return data ?? []
}

export default async function MatchesPage() {
  const matches = await getMatches()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Match Explorer</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Most recent 50 matches — click any match to see the win analysis
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-xl p-10 border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-4xl mb-4">📋</div>
          <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No match data yet</div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Run the ingestion script to load matches</div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Venue', 'Teams', 'Score', 'Result', 'Comp'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((m: any) => (
                <tr key={m.match_id} style={{ borderBottom: '1px solid var(--border)' }}
                  className="hover:opacity-80 transition-opacity cursor-pointer">
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.match_date}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.venues?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    <Link href={`/analysis/${m.match_id}`} style={{ color: 'inherit' }}>
                      {m.team1} vs {m.team2}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {m.team1_score != null ? `${m.team1_score}/${m.team1_wickets}` : '—'} · {m.team2_score != null ? `${m.team2_score}/${m.team2_wickets}` : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--accent-green)' }}>{m.winner ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: m.competition === 'IPL' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: m.competition === 'IPL' ? 'var(--accent-blue)' : 'var(--accent-amber)' }}>
                      {m.competition}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
