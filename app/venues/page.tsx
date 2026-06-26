import { supabase } from '@/lib/supabase'
import PhaseBar from '@/components/ui/PhaseBar'

async function getVenues() {
  if (!supabase) return []
  const { data } = await supabase
    .from('venues')
    .select('*')
    .order('ipl_game_count', { ascending: false })
  return data ?? []
}

const pitchBadge: Record<string, { label: string; color: string }> = {
  FLAT: { label: 'Flat', color: 'var(--accent-green)' },
  SPORTING: { label: 'Sporting', color: 'var(--accent-blue)' },
  SPIN_FRIENDLY: { label: 'Spin', color: 'var(--accent-amber)' },
  SEAM_FRIENDLY: { label: 'Seam', color: 'var(--accent-red)' },
  SLOW_LOW: { label: 'Slow & Low', color: 'var(--accent-purple)' },
}

export default async function VenuesPage() {
  const venues = await getVenues()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Venue Intelligence
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Par scores, pitch type, phase RPO, toss impact — IPL-primary, domestic-supplemented
        </p>
      </div>

      {venues.length === 0 ? (
        <div
          className="rounded-xl p-10 border text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="text-4xl mb-4">🏟</div>
          <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            No venue data yet
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Add Supabase credentials to <code>.env.local</code> and run the ingestion script
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {venues.map((venue: any) => {
            const coverage =
              venue.ipl_game_count >= 30
                ? { label: 'Primary', color: 'var(--accent-green)' }
                : venue.ipl_game_count >= 10
                ? { label: 'Supplemented', color: 'var(--accent-amber)' }
                : { label: 'Domestic-Heavy', color: 'var(--accent-red)' }
            const pitch = venue.pitch_type ? pitchBadge[venue.pitch_type] : null

            return (
              <div
                key={venue.venue_id}
                className="rounded-xl border p-5"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{venue.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{venue.city}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {pitch && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'var(--bg-surface)', color: pitch.color, border: `1px solid ${pitch.color}40` }}>
                        {pitch.label}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'var(--bg-surface)', color: coverage.color, border: `1px solid ${coverage.color}40` }}>
                      {coverage.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { val: venue.ipl_game_count, label: 'IPL games', color: 'var(--accent-blue)' },
                    { val: venue.avg_1st_innings_ipl ? Math.round(venue.avg_1st_innings_ipl) : '—', label: 'IPL par score', color: 'var(--accent-amber)' },
                    { val: `${(venue.ipl_weight * 100).toFixed(0)}%`, label: 'IPL weight', color: 'var(--accent-green)' },
                  ].map(s => (
                    <div key={s.label} className="text-center rounded-lg p-2" style={{ background: 'var(--bg-surface)' }}>
                      <div className="text-lg font-bold" style={{ color: s.color }}>{s.val}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Phase RPO (1st innings avg)</div>
                <PhaseBar powerplayRPO={0} middleRPO={0} deathRPO={0} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
