'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Player = {
  player_id: string; name: string; role: string | null
  batting_style: string | null; bowling_style: string | null
  cricbuzz_id: string | null
}

type BatPhase = {
  phase: string; innings: number; matches: number; balls: number
  runs: number; avg: number; sr: number; dot_pct: number; dismissals: number
}

type BowlPhase = {
  phase: string; innings: number; matches: number; balls: number
  runs_conceded: number; wickets: number; economy: number
  bowling_sr: number | null; dot_pct: number
}

const PHASE_ORDER = ['POWERPLAY', 'MIDDLE', 'ACCELERATE', 'DEATH']
const PHASE_LABEL: Record<string, string> = {
  POWERPLAY: 'Powerplay (1-6)', MIDDLE: 'Middle (7-12)',
  ACCELERATE: 'Accel (13-16)', DEATH: 'Death (17-20)',
}
const PHASE_COLOR: Record<string, string> = {
  POWERPLAY: 'var(--accent-blue)', MIDDLE: 'var(--accent-amber)',
  ACCELERATE: 'var(--accent-purple)', DEATH: 'var(--accent-red)',
}
const ROLE_LABEL: Record<string, string> = {
  BATTER: 'Batter', BOWLER: 'Bowler', ALL_ROUNDER: 'All-rounder', WICKET_KEEPER: 'Keeper',
}
const STYLE_SHORT: Record<string, string> = {
  RIGHT_ARM_FAST: 'RAF', RIGHT_ARM_MEDIUM: 'RAM', LEFT_ARM_FAST: 'LAF', LEFT_ARM_MEDIUM: 'LAM',
  RIGHT_ARM_OFFSPIN: 'Off-spin', RIGHT_ARM_LEGSPIN: 'Leg-spin',
  LEFT_ARM_ORTHODOX: 'SLA', LEFT_ARM_WRIST_SPIN: 'Wrist-spin',
}

function StatBox({ val, label, color }: { val: string | number; label: string; color?: string }) {
  return (
    <div className="text-center rounded-lg p-3" style={{ background: 'var(--bg-surface)' }}>
      <div className="text-lg font-bold" style={{ color: color ?? 'var(--text-primary)' }}>{val}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [player, setPlayer] = useState<Player | null>(null)
  const [batStats, setBatStats] = useState<BatPhase[]>([])
  const [bowlStats, setBowlStats] = useState<BowlPhase[]>([])
  const [inningsTab, setInningsTab] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !id) return

    Promise.all([
      supabase.from('players').select('*').eq('player_id', id).single(),
      // Batting stats per phase per innings
      supabase.rpc('get_player_batting_stats', { p_player_id: id }),
      // Bowling stats per phase per innings
      supabase.rpc('get_player_bowling_stats', { p_player_id: id }),
    ]).then(([p, bat, bowl]) => {
      setPlayer(p.data)
      setBatStats(bat.data ?? [])
      setBowlStats(bowl.data ?? [])
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
  if (!player) return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>Player not found.</div>

  const batFiltered = batStats.filter(s => s.innings === inningsTab).sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase))
  const bowlFiltered = bowlStats.filter(s => s.innings === inningsTab).sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase))

  const isBatter = player.role === 'BATTER' || player.role === 'WICKET_KEEPER' || player.role === 'ALL_ROUNDER'
  const isBowler = player.role === 'BOWLER' || player.role === 'ALL_ROUNDER'

  // Overall batting
  const totalBat = batStats.reduce((acc, s) => ({
    runs: acc.runs + s.runs, balls: acc.balls + s.balls, dismissals: acc.dismissals + s.dismissals,
  }), { runs: 0, balls: 0, dismissals: 0 })
  const overallAvg = totalBat.dismissals > 0 ? (totalBat.runs / totalBat.dismissals).toFixed(1) : '—'
  const overallSR = totalBat.balls > 0 ? ((totalBat.runs / totalBat.balls) * 100).toFixed(1) : '—'

  const totalBowl = bowlStats.reduce((acc, s) => ({
    balls: acc.balls + s.balls, runs: acc.runs + s.runs_conceded, wickets: acc.wickets + s.wickets,
  }), { balls: 0, runs: 0, wickets: 0 })
  const overallEcon = totalBowl.balls > 0 ? ((totalBowl.runs / totalBowl.balls) * 6).toFixed(2) : '—'
  const overallBowlSR = totalBowl.wickets > 0 ? (totalBowl.balls / totalBowl.wickets).toFixed(1) : '—'

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <Link href="/players" className="text-xs mb-5 inline-block hover:underline" style={{ color: 'var(--text-muted)' }}>
        ← All players
      </Link>

      {/* Player header */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{player.name}</h1>
            <div className="flex gap-3 text-sm flex-wrap">
              {player.role && <span style={{ color: 'var(--accent-blue)' }}>{ROLE_LABEL[player.role] ?? player.role}</span>}
              {player.batting_style && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {player.batting_style === 'RIGHT_HAND' ? 'Right-hand bat' : 'Left-hand bat'}
                </span>
              )}
              {player.bowling_style && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {STYLE_SHORT[player.bowling_style] ?? player.bowling_style}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Overall stats */}
        {(batStats.length > 0 || bowlStats.length > 0) && (
          <div className="grid grid-cols-2 gap-6 mt-4">
            {batStats.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>BATTING OVERALL</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatBox val={totalBat.runs} label="Runs" color="var(--accent-blue)" />
                  <StatBox val={overallAvg} label="Average" />
                  <StatBox val={overallSR} label="Strike Rate" />
                </div>
              </div>
            )}
            {bowlStats.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>BOWLING OVERALL</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatBox val={totalBowl.wickets} label="Wickets" color="var(--accent-red)" />
                  <StatBox val={overallEcon} label="Economy" />
                  <StatBox val={overallBowlSR} label="Strike Rate" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Innings toggle */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Innings</span>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-surface)' }}>
          {([1, 2] as const).map(i => (
            <button key={i} onClick={() => setInningsTab(i)}
              className="px-4 py-1 rounded-md text-sm transition-colors"
              style={{
                background: inningsTab === i ? 'var(--bg-card)' : 'transparent',
                color: inningsTab === i ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
              {i === 1 ? '1st innings' : '2nd innings'}
            </button>
          ))}
        </div>
      </div>

      {/* Batting phase breakdown */}
      {batFiltered.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Batting by Phase</div>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                  <th className="text-left px-4 py-2 font-medium">Phase</th>
                  <th className="text-center px-3 py-2 font-medium">M</th>
                  <th className="text-center px-3 py-2 font-medium">Runs</th>
                  <th className="text-center px-3 py-2 font-medium">Avg</th>
                  <th className="text-center px-3 py-2 font-medium">SR</th>
                  <th className="text-center px-3 py-2 font-medium">Dot%</th>
                </tr>
              </thead>
              <tbody>
                {batFiltered.map((s, i) => (
                  <tr key={s.phase} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-surface)' }}>
                    <td className="px-4 py-2 font-medium text-xs" style={{ color: PHASE_COLOR[s.phase] }}>
                      {PHASE_LABEL[s.phase]}
                    </td>
                    <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{s.matches}</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--accent-blue)' }}>{s.runs}</td>
                    <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>
                      {s.dismissals > 0 ? (s.runs / s.dismissals).toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold"
                      style={{ color: s.sr >= 150 ? 'var(--accent-green)' : s.sr >= 120 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>
                      {s.sr.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{s.dot_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bowling phase breakdown */}
      {bowlFiltered.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Bowling by Phase</div>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                  <th className="text-left px-4 py-2 font-medium">Phase</th>
                  <th className="text-center px-3 py-2 font-medium">M</th>
                  <th className="text-center px-3 py-2 font-medium">Wkts</th>
                  <th className="text-center px-3 py-2 font-medium">Econ</th>
                  <th className="text-center px-3 py-2 font-medium">SR</th>
                  <th className="text-center px-3 py-2 font-medium">Dot%</th>
                </tr>
              </thead>
              <tbody>
                {bowlFiltered.map((s, i) => (
                  <tr key={s.phase} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-surface)' }}>
                    <td className="px-4 py-2 font-medium text-xs" style={{ color: PHASE_COLOR[s.phase] }}>
                      {PHASE_LABEL[s.phase]}
                    </td>
                    <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{s.matches}</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: 'var(--accent-green)' }}>{s.wickets}</td>
                    <td className="px-3 py-2 text-center font-semibold"
                      style={{ color: s.economy < 8 ? 'var(--accent-green)' : s.economy < 10 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>
                      {s.economy.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{s.bowling_sr ?? '—'}</td>
                    <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{s.dot_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {batFiltered.length === 0 && bowlFiltered.length === 0 && (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No phase data available for this innings.</div>
      )}
    </div>
  )
}
