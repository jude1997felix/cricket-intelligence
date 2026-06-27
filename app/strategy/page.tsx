'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Venue = { venue_id: string; name: string; city: string; ipl_game_count: number }

type PhaseBenchmark = {
  phase: 'POWERPLAY' | 'MIDDLE' | 'ACCELERATE' | 'DEATH'
  era: 'pre_impact' | 'post_impact'
  result: 'won' | 'lost'
  match_count: number
  avg_winning_score: number | null
  avg_phase_runs: number
  avg_rpo: number
  avg_wickets_lost: number
  dot_pct: number
}

type ChaseBenchmark = PhaseBenchmark & {
  target_bracket_low: number
  target_bracket_high: number
}

type BowlerStat = {
  bowler_name: string
  bowling_style: string | null
  innings: number
  phase: 'POWERPLAY' | 'MIDDLE' | 'ACCELERATE' | 'DEATH'
  era: 'pre_impact' | 'post_impact'
  matches: number
  balls: number
  wickets: number
  economy: number
  bowling_sr: number | null
  dot_pct: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PHASES = ['POWERPLAY', 'MIDDLE', 'ACCELERATE', 'DEATH'] as const

const PHASE_LABEL: Record<string, string> = {
  POWERPLAY: 'Powerplay (1-6)',
  MIDDLE: 'Middle (7-12)',
  ACCELERATE: 'Acceleration (13-16)',
  DEATH: 'Death (17-20)',
}

// Ideal wickets in hand at END of each phase (10 minus cumulative avg wickets lost by winning teams)
// These are derived from data but shown as guidance
const PHASE_COLOR: Record<string, string> = {
  POWERPLAY: 'var(--accent-blue)',
  MIDDLE: 'var(--accent-amber)',
  ACCELERATE: 'var(--accent-purple)',
  DEATH: 'var(--accent-red)',
}

const STYLE_SHORT: Record<string, string> = {
  RIGHT_ARM_FAST: 'RAF', RIGHT_ARM_MEDIUM: 'RAM', LEFT_ARM_FAST: 'LAF', LEFT_ARM_MEDIUM: 'LAM',
  RIGHT_ARM_OFFSPIN: 'OS', RIGHT_ARM_LEGSPIN: 'LS', LEFT_ARM_ORTHODOX: 'SLA', LEFT_ARM_WRIST_SPIN: 'LWS',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function phaseByResult(data: PhaseBenchmark[], phase: string, result: 'won' | 'lost', era: string) {
  return data.find(d => d.phase === phase && d.result === result && d.era === era)
}

function wicketsInHand(data: PhaseBenchmark[], upToPhase: string, result: 'won' | 'lost', era: string): number {
  const order = ['POWERPLAY', 'MIDDLE', 'ACCELERATE', 'DEATH']
  const idx = order.indexOf(upToPhase)
  let lost = 0
  for (let i = 0; i <= idx; i++) {
    const d = phaseByResult(data, order[i], result, era)
    lost += d?.avg_wickets_lost ?? 0
  }
  return Math.max(0, Math.round((10 - lost) * 10) / 10)
}

function StatCell({ val, label, color, sub }: { val: string | number; label: string; color?: string; sub?: string }) {
  return (
    <div className="text-center rounded-lg p-2" style={{ background: 'var(--bg-surface)' }}>
      <div className="text-base font-bold" style={{ color: color ?? 'var(--text-primary)' }}>{val}</div>
      {sub && <div className="text-xs" style={{ color: 'var(--accent-green)' }}>{sub}</div>}
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function PhaseRow({ label, won, lost, color, phase, allData, era }: {
  label: string
  won?: PhaseBenchmark
  lost?: PhaseBenchmark
  color: string
  phase: string
  allData: PhaseBenchmark[]
  era: string
}) {
  if (!won && !lost) return null

  const wonWickets = wicketsInHand(allData, phase, 'won', era)
  const lostWickets = wicketsInHand(allData, phase, 'lost', era)

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="text-xs font-semibold mb-3" style={{ color }}>{label}</div>
      <div className="grid grid-cols-2 gap-4">
        {/* Won */}
        <div>
          <div className="text-xs mb-2 font-medium" style={{ color: 'var(--accent-green)' }}>
            Winning teams · {won?.match_count ?? 0} matches
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <StatCell val={won?.avg_phase_runs ?? '—'} label="Runs" color="var(--accent-green)" />
            <StatCell val={won?.avg_rpo ?? '—'} label="RPO" />
            <StatCell val={won ? `${won.dot_pct}%` : '—'} label="Dots" />
            <StatCell
              val={won ? wonWickets : '—'}
              label="Wkts left"
              color="var(--accent-green)"
            />
          </div>
        </div>
        {/* Lost */}
        <div>
          <div className="text-xs mb-2 font-medium" style={{ color: 'var(--accent-red)' }}>
            Losing teams · {lost?.match_count ?? 0} matches
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <StatCell val={lost?.avg_phase_runs ?? '—'} label="Runs" color="var(--accent-red)" />
            <StatCell val={lost?.avg_rpo ?? '—'} label="RPO" />
            <StatCell val={lost ? `${lost.dot_pct}%` : '—'} label="Dots" />
            <StatCell
              val={lost ? lostWickets : '—'}
              label="Wkts left"
              color="var(--accent-red)"
            />
          </div>
        </div>
      </div>
      {won && lost && (
        <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Gap: <span style={{ color: 'var(--accent-green)' }}>+{(won.avg_phase_runs - lost.avg_phase_runs).toFixed(1)} runs</span>
          {' '}· winners end phase with <span style={{ color: 'var(--accent-green)' }}>{wonWickets}</span> wickets in hand
          vs <span style={{ color: 'var(--accent-red)' }}>{lostWickets}</span> for losers
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [venueId, setVenueId] = useState<string>('')
  const [tab, setTab] = useState<'batting' | 'chasing' | 'bowlers'>('batting')
  const [innings, setInnings] = useState<1 | 2>(1)
  const [era, setEra] = useState<'pre_impact' | 'post_impact'>('post_impact')

  const [battingData, setBattingData] = useState<PhaseBenchmark[]>([])
  const [chaseData, setChaseData] = useState<ChaseBenchmark[]>([])
  const [bowlerData, setBowlerData] = useState<BowlerStat[]>([])
  const [targetBracket, setTargetBracket] = useState<number>(160)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.from('venues').select('venue_id, name, city, ipl_game_count')
      .order('ipl_game_count', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data?.length) { setVenues(data); setVenueId(data[0].venue_id) }
      })
  }, [])

  useEffect(() => {
    if (!supabase || !venueId) return
    setLoading(true)
    Promise.all([
      supabase.from('first_innings_phase_benchmarks').select('*').eq('venue_id', venueId),
      supabase.from('chase_phase_benchmarks').select('*').eq('venue_id', venueId),
      supabase.from('bowler_phase_stats').select('*').eq('venue_id', venueId).order('economy'),
    ]).then(([b, c, bw]) => {
      setBattingData(b.data ?? [])
      setChaseData(c.data ?? [])
      setBowlerData(bw.data ?? [])
      if (c.data?.length) {
        const brackets = [...new Set((c.data as ChaseBenchmark[]).map(r => r.target_bracket_low))].sort((a, b) => a - b)
        setTargetBracket(brackets[Math.floor(brackets.length / 2)] ?? 160)
      }
      setLoading(false)
    })
  }, [venueId])

  const battingFiltered = battingData.filter(d => d.era === era)
  const chaseBrackets = [...new Set(chaseData.filter(d => d.era === era).map(r => r.target_bracket_low))].sort((a, b) => a - b)
  const chaseFiltered = chaseData.filter(r => r.target_bracket_low === targetBracket && r.era === era)
  const bowlerFiltered = bowlerData.filter(b => b.innings === innings && b.era === era)

  // Avg winning score (from won rows, any phase — they all have same match-level avg)
  const avgWinningScore = battingFiltered.find(d => d.result === 'won' && d.avg_winning_score)?.avg_winning_score

  const EraToggle = () => (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-surface)' }}>
      {(['post_impact', 'pre_impact'] as const).map(e => (
        <button
          key={e}
          onClick={() => setEra(e)}
          className="px-3 py-1 rounded-md text-xs transition-colors"
          style={{
            background: era === e ? 'var(--bg-card)' : 'transparent',
            color: era === e ? 'var(--text-primary)' : 'var(--text-muted)',
            border: era === e ? '1px solid var(--border)' : '1px solid transparent',
          }}
        >
          {e === 'post_impact' ? 'Impact Player era (2023+)' : 'Pre-Impact (pre-2023)'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Match Strategy</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Phase-wise batting targets, chase blueprints, and bowler effectiveness
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Venue</label>
          <select
            value={venueId}
            onChange={e => setVenueId(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {venues.map(v => (
              <option key={v.venue_id} value={v.venue_id}>{v.name}, {v.city}</option>
            ))}
          </select>
        </div>
        <EraToggle />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 rounded-xl p-1 w-fit" style={{ background: 'var(--bg-surface)' }}>
        {(['batting', 'chasing', 'bowlers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            {t === 'batting' ? 'Batting First' : t === 'chasing' ? 'Chasing' : 'Bowlers'}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>}

      {/* ── Batting First ── */}
      {!loading && tab === 'batting' && (
        <div className="space-y-4">
          {avgWinningScore && (
            <div className="rounded-xl border p-4 flex items-center gap-6"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Avg winning score</div>
                <div className="text-3xl font-bold" style={{ color: 'var(--accent-green)' }}>
                  {Math.round(avgWinningScore)}
                </div>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Based on {battingFiltered.find(d => d.result === 'won')?.match_count ?? 0} matches where batting first team won
                {era === 'post_impact' ? ' (Impact Player era)' : ' (pre-Impact Player era)'}
              </div>
            </div>
          )}
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Phase-wise targets — runs scored, RPO, dots, and wickets in hand at end of each phase
          </div>
          {battingFiltered.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No data for this venue / era.</div>
          ) : (
            PHASES.map(phase => (
              <PhaseRow
                key={phase}
                label={PHASE_LABEL[phase]}
                won={phaseByResult(battingFiltered, phase, 'won', era)}
                lost={phaseByResult(battingFiltered, phase, 'lost', era)}
                color={PHASE_COLOR[phase]}
                phase={phase}
                allData={battingFiltered}
                era={era}
              />
            ))
          )}
        </div>
      )}

      {/* ── Chasing ── */}
      {!loading && tab === 'chasing' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Target</span>
            <select
              value={targetBracket}
              onChange={e => setTargetBracket(Number(e.target.value))}
              className="rounded-lg px-3 py-1.5 text-sm border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {chaseBrackets.map(b => (
                <option key={b} value={b}>{b}–{b + 9} runs</option>
              ))}
            </select>
          </div>
          <div className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Successful vs failed chases of {targetBracket}–{targetBracket + 9} — phase by phase breakdown
          </div>
          {chaseFiltered.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No data for this target range / era.</div>
          ) : (
            PHASES.map(phase => (
              <PhaseRow
                key={phase}
                label={PHASE_LABEL[phase]}
                won={phaseByResult(chaseFiltered, phase, 'won', era)}
                lost={phaseByResult(chaseFiltered, phase, 'lost', era)}
                color={PHASE_COLOR[phase]}
                phase={phase}
                allData={chaseFiltered}
                era={era}
              />
            ))
          )}
        </div>
      )}

      {/* ── Bowlers ── */}
      {!loading && tab === 'bowlers' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Innings</span>
            <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-surface)' }}>
              {([1, 2] as const).map(i => (
                <button
                  key={i}
                  onClick={() => setInnings(i)}
                  className="px-4 py-1 rounded-md text-sm transition-colors"
                  style={{
                    background: innings === i ? 'var(--bg-card)' : 'transparent',
                    color: innings === i ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {i === 1 ? '1st innings' : '2nd innings'}
                </button>
              ))}
            </div>
          </div>

          {PHASES.map(phase => {
            const rows = bowlerFiltered
              .filter(b => b.phase === phase)
              .sort((a, b) => a.economy - b.economy)
              .slice(0, 8)
            if (!rows.length) return null
            return (
              <div key={phase} className="mb-6">
                <div className="text-xs font-semibold mb-2" style={{ color: PHASE_COLOR[phase] }}>
                  {PHASE_LABEL[phase]}
                </div>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                        <th className="text-left px-4 py-2 font-medium">Bowler</th>
                        <th className="text-center px-3 py-2 font-medium">Style</th>
                        <th className="text-center px-3 py-2 font-medium">M</th>
                        <th className="text-center px-3 py-2 font-medium">Wkts</th>
                        <th className="text-center px-3 py-2 font-medium">Econ</th>
                        <th className="text-center px-3 py-2 font-medium">SR</th>
                        <th className="text-center px-3 py-2 font-medium">Dot%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((b, i) => (
                        <tr key={b.bowler_name}
                          style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                          <td className="px-4 py-2 font-medium">{b.bowler_name}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                              {b.bowling_style ? STYLE_SHORT[b.bowling_style] ?? b.bowling_style : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{b.matches}</td>
                          <td className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--accent-green)' }}>{b.wickets}</td>
                          <td className="px-3 py-2 text-center font-semibold"
                            style={{ color: b.economy < 8 ? 'var(--accent-green)' : b.economy < 10 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>
                            {b.economy}
                          </td>
                          <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{b.bowling_sr ?? '—'}</td>
                          <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{b.dot_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
          {bowlerFiltered.length === 0 && (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No bowler data for this venue / era.</div>
          )}
        </div>
      )}
    </div>
  )
}
