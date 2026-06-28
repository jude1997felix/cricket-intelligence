'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Player = {
  player_id: string
  name: string
  role: string | null
  batting_style: string | null
  bowling_style: string | null
}

const ROLE_LABEL: Record<string, string> = {
  BATTER: 'Batter', BOWLER: 'Bowler', ALL_ROUNDER: 'All-rounder', WICKET_KEEPER: 'Keeper',
}
const STYLE_SHORT: Record<string, string> = {
  RIGHT_ARM_FAST: 'RAF', RIGHT_ARM_MEDIUM: 'RAM', LEFT_ARM_FAST: 'LAF', LEFT_ARM_MEDIUM: 'LAM',
  RIGHT_ARM_OFFSPIN: 'OS', RIGHT_ARM_LEGSPIN: 'LS', LEFT_ARM_ORTHODOX: 'SLA', LEFT_ARM_WRIST_SPIN: 'LWS',
}
const ROLE_COLOR: Record<string, string> = {
  BATTER: 'var(--accent-blue)', BOWLER: 'var(--accent-red)',
  ALL_ROUNDER: 'var(--accent-green)', WICKET_KEEPER: 'var(--accent-amber)',
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.from('players')
      .select('player_id, name, role, batting_style, bowling_style')
      .order('name')
      .then(({ data }) => { setPlayers(data ?? []); setLoading(false) })
  }, [])

  const filtered = players.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchRole = !roleFilter || p.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Player Intelligence</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {players.length} players — click any to view phase stats and matchup analysis
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search player…"
          className="rounded-lg px-3 py-1.5 text-sm border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: 220 }}
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All roles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(search || roleFilter) && (
          <button onClick={() => { setSearch(''); setRoleFilter('') }}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Clear
          </button>
        )}
        <span className="text-sm self-center" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} results
        </span>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No players found.</div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                <th className="text-left px-4 py-2 font-medium">Player</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Batting</th>
                <th className="text-left px-4 py-2 font-medium">Bowling</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.player_id}
                  style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
                  <td className="px-4 py-2">
                    <Link href={`/players/${p.player_id}`}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--accent-blue)' }}>
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {p.role ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: ROLE_COLOR[p.role] ?? 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                        {ROLE_LABEL[p.role] ?? p.role}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                    {p.batting_style === 'RIGHT_HAND' ? 'RHB' : p.batting_style === 'LEFT_HAND' ? 'LHB' : '—'}
                  </td>
                  <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                    {p.bowling_style ? STYLE_SHORT[p.bowling_style] ?? p.bowling_style : '—'}
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
