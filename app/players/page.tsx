import { supabase } from '@/lib/supabase'

async function getPlayers() {
  if (!supabase) return []
  const { data } = await supabase.from('players').select('*').order('name')
  return data ?? []
}

export default async function PlayersPage() {
  const players = await getPlayers()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Player Intelligence</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Form index, phase-wise averages, matchup matrix vs pace & spin
        </p>
      </div>

      {players.length === 0 ? (
        <div className="rounded-xl p-10 border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-4xl mb-4">👤</div>
          <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No player data yet</div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Players are created automatically during data ingestion</div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Player', 'Role', 'Batting', 'Bowling'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p: any) => (
                <tr key={p.player_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.role?.replace('_', ' ') ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.batting_style?.replace('_', ' ') ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.bowling_style?.replace(/_/g, ' ') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
