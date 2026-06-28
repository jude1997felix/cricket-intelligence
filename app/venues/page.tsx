import { supabase } from '@/lib/supabase'
import PhaseBar from '@/components/ui/PhaseBar'

async function getVenuesWithPhaseStats() {
  if (!supabase) return []

  const [venuesRes, phaseRes] = await Promise.all([
    supabase.from('venues').select('*').order('ipl_game_count', { ascending: false }),
    supabase.from('venue_phase_stats').select('venue_id, phase, innings, avg_rpo').eq('innings', 1),
  ])

  const venues = venuesRes.data ?? []
  const phaseStats = phaseRes.data ?? []

  return venues.map((v: any) => {
    const vStats = phaseStats.filter((s: any) => s.venue_id === v.venue_id)
    const rpo = (phase: string) => vStats.find((s: any) => s.phase === phase)?.avg_rpo ?? 0
    return {
      ...v,
      powerplayRPO: rpo('POWERPLAY'),
      middleRPO: rpo('MIDDLE'),
      accelerateRPO: rpo('ACCELERATE'),
      deathRPO: rpo('DEATH'),
    }
  })
}

const pitchBadge: Record<string, { label: string; color: string }> = {
  FLAT:          { label: 'Flat',       color: 'var(--accent-green)' },
  SPORTING:      { label: 'Sporting',   color: 'var(--accent-blue)' },
  SPIN_FRIENDLY: { label: 'Spin',       color: 'var(--accent-amber)' },
  SEAM_FRIENDLY: { label: 'Seam',       color: 'var(--accent-red)' },
  SLOW_LOW:      { label: 'Slow & Low', color: 'var(--accent-purple)' },
}

export default async function VenuesPage() {
  const venues = await getVenuesWithPhaseStats()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Venue Intelligence</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Par scores, pitch type, phase RPO, toss impact — IPL-primary, domestic-supplemented
        </p>
      </div>

      {venues.length === 0 ? (
        <div className="rounded-xl p-10 border text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-4xl mb-4">🏟</div>
          <div className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No venue data yet</div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Run the ingestion script to populate venue data
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {venues.map((venue: any) => {
            const coverage = venue.ipl_game_count >= 30
              ? { label: 'IPL Primary',       color: 'var(--accent-green)' }
              : venue.ipl_game_count >= 10
              ? { label: 'Supplemented',      color: 'var(--accent-amber)' }
              : { label: 'Domestic-Heavy',    color: 'var(--accent-red)' }
            const pitch = venue.pitch_type ? pitchBadge[venue.pitch_type] : null
            const totalGames = venue.ipl_game_count + venue.domestic_game_count

            return (
              <div key={venue.venue_id} className="rounded-xl border p-5"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{venue.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{venue.city}{venue.state ? `, ${venue.state}` : ''}</div>
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

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { val: venue.ipl_game_count,                                                   label: 'IPL',        color: 'var(--accent-blue)' },
                    { val: totalGames,                                                             label: 'Total games', color: 'var(--text-secondary)' },
                    { val: venue.avg_1st_innings_ipl ? Math.round(venue.avg_1st_innings_ipl) : '—', label: 'IPL par',   color: 'var(--accent-amber)' },
                    { val: `${(venue.ipl_weight * 100).toFixed(0)}%`,                             label: 'IPL weight',  color: 'var(--accent-green)' },
                  ].map(s => (
                    <div key={s.label} className="text-center rounded-lg p-2" style={{ background: 'var(--bg-surface)' }}>
                      <div className="text-base font-bold" style={{ color: s.color }}>{s.val}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Phase RPO bars */}
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Phase RPO — 1st innings avg</div>
                <PhaseBar
                  powerplayRPO={Number(venue.powerplayRPO)}
                  middleRPO={Number(venue.middleRPO)}
                  accelerateRPO={Number(venue.accelerateRPO)}
                  deathRPO={Number(venue.deathRPO)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
