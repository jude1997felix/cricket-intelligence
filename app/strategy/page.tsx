'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Venue = { venue_id: string; name: string; city: string; ipl_game_count: number }

type PhaseBenchmark = {
  phase: 'POWERPLAY' | 'MIDDLE' | 'DEATH'
  result: 'won' | 'lost'
  match_count: number
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
  phase: 'POWERPLAY' | 'MIDDLE' | 'DEATH'
  matches: number
  balls: number
  wickets: number
  economy: number
  bowling_sr: number | null
  dot_pct: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PHASES = ['POWERPLAY', 'MIDDLE', 'DEATH'] as const
const PHASE_LABEL: Record<string, string> = { POWERPLAY: 'Powerplay (0-5)', MIDDLE: 'Middle (6-14)', DEATH: 'Death (15-19)' }
const PHASE_COLOR: Record<string, string> = {
  POWERPLAY: 'var(--accent-blue)',
  MIDDLE: 'var(--accent-amber)',
  DEATH: 'var(--accent-red)',
}

const STYLE_SHORT: Record<string, string> = {
  RIGHT_ARM_FAST: 'RAF', RIGHT_ARM_MEDIUM: 'RAM', LEFT_ARM_FAST: 'LAF', LEFT_ARM_MEDIUM: 'LAM',
  RIGHT_ARM_OFFSPIN: 'OS', RIGHT_ARM_LEGSPIN: 'LS', LEFT_ARM_ORTHODOX: 'SLA', LEFT_ARM_WRIST_SPIN: 'LWS',
}

function phaseByResult(data: PhaseBenchmark[], phase: string, result: 'won' | 'lost') {
  return data.find(d => d.phase === phase && d.result === result)
}

function StatCell({ val, label, color }: { val: string | number; label: string; color?: string }) {
  return (
    <div className="text-center rounded-lg p-2" style={{ background: 'var(--bg-surface)' }}>
      <div className="text-base font-bold" style={{ color: color ?? 'var(--text-primary)' }}>{val}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function PhaseRow({ label, won, lost, color }: {
  label: string; won?: PhaseBenchmark; lost?: PhaseBenchmark; color: string
}) {
  if (!won && !lost) return null
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="text-xs font-semibold mb-3" style={{ color }}>{label}</div>
      <div className="grid grid-cols-2 gap-4">
        {/* Won */}
        <div>
          <div className="text-xs mb-2 font-medium" style={{ color: 'var(--accent-green)' }}>
            Winning teams · {won?.match_count ?? 0} matches
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell val={won?.avg_phase_runs ?? '—'} label="Runs" color="var(--accent-green)" />
            <StatCell val={won?.avg_rpo ?? '—'} label="RPO" />
            <StatCell val={won ? `${won.dot_pct}%` : '—'} label="Dots" />
          </div>
        </div>
        {/* Lost */}
        <div>
          <div className="text-xs mb-2 font-medium" style={{ color: 'var(--accent-red)' }}>
            Losing teams · {lost?.match_count ?? 0} matches
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell val={lost?.avg_phase_runs ?? '—'} label="Runs" color="var(--accent-red)" />
            <StatCell val={lost?.avg_rpo ?? '—'} label="RPO" />
            <StatCell val={lost ? `${lost.dot_pct}%` : '—'} label="Dots" />
          </div>
        </div>
      </div>
      {won && lost && (
        <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Gap: <span style={{ color: 'var(--accent-green)' }}>+{(won.avg_phase_runs - lost.avg_phase_runs).toFixed(1)} runs</span>
          {' '}· winning teams take {(won.avg_wickets_lost - lost.avg_wickets_lost).toFixed(1)} {won.avg_wickets_lost > lost.avg_wickets_lost ? 'more' : 'fewer'} risks
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

  const [battingData, setBattingData] = useState<PhaseBenchmark[]>([])
  const [chaseData, setChaseData] = useState<ChaseBenchmark[]>([])
  const [bowlerData, setBowlerData] = useState<BowlerStat[]>([])
  const [targetBracket, setTargetBracket] = useState<number>(160)
  const [loading, setLoading] = useState(false)

  // Load venues
  useEffect(() => {
    if (!supabase) return
    supabase.from('venues').select('venue_id, name, city, ipl_game_count')
      .order('ipl_game_count', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data?.length) { setVenues(data); setVenueId(data[0].venue_id) }
      })
  }, [])

  // Load data when venue changes
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
      // set default bracket to most common in chase data
      if (c.data?.length) {
        const brackets = [...new Set(c.data.map((r: ChaseBenchmark) => r.target_bracket_low))].sort((a, b) => a - b)
        const mid = brackets[Math.floor(brackets.length / 2)]
        setTargetBracket(mid ?? 160)
      }
      setLoading(false)
    })
  }, [venueId])

  const chaseBrackets = [...new Set(chaseData.map(r => r.target_bracket_low))].sort((a, b) => a - b)
  const chaseFiltered = chaseData.filter(r => r.target_bracket_low === targetBracket)
  const bowlerFiltered = bowlerData.filter(b => b.innings === innings)

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Match Strategy</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Phase-wise batting targets, chase blueprints, and bowler effectiveness
        </p>
      </div>

      {/* Venue selector */}
      <div className="flex items-center gap-4 mb-6">
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

      {loading && (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      )}

      {/* ── Batting First ── */}
      {!loading && tab === 'batting' && (
        <div className="space-y-4">
          <div className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Phase-wise targets for batting first — what winning vs losing teams score in each phase
          </div>
          {battingData.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No data for this venue yet.</div>
          ) : (
            PHASES.map(phase => (
              <PhaseRow
                key={phase}
                label={PHASE_LABEL[phase]}
                won={phaseByResult(battingData, phase, 'won')}
                lost={phaseByResult(battingData, phase, 'lost')}
                color={PHASE_COLOR[phase]}
              />
            ))
          )}
        </div>
      )}

      {/* ── Chasing ── */}
      {!loading && tab === 'chasing' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Target bracket</span>
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
            How successful vs failed chases of {targetBracket}–{targetBracket + 9} look phase by phase
          </div>
          {chaseFiltered.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No chase data for this target range.</div>
          ) : (
            PHASES.map(phase => (
              <PhaseRow
                key={phase}
                label={PHASE_LABEL[phase]}
                won={phaseByResult(chaseFiltered, phase, 'won')}
                lost={phaseByResult(chaseFiltered, phase, 'lost')}
                color={PHASE_COLOR[phase]}
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
                        <tr
                          key={b.bowler_name}
                          style={{
                            background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <td className="px-4 py-2 font-medium">{b.bowler_name}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                              {b.bowling_style ? STYLE_SHORT[b.bowling_style] ?? b.bowling_style : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{b.matches}</td>
                          <td className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--accent-green)' }}>{b.wickets}</td>
                          <td className="px-3 py-2 text-center font-semibold" style={{ color: b.economy < 8 ? 'var(--accent-green)' : b.economy < 10 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>{b.economy}</td>
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
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No bowler data for this venue yet.</div>
          )}
        </div>
      )}
    </div>
  )
}
