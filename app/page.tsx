'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Stats = {
  matches: number
  deliveries: number
  players: number
  venues: number
  seasons: { min: number; max: number }
}

const NAV_CARDS = [
  { href: '/venues',   icon: '🏟', title: 'Venue Intelligence',  desc: 'Par scores, pitch type, phase averages, toss win % by ground',             accent: 'var(--accent-blue)' },
  { href: '/players',  icon: '👤', title: 'Player Intelligence',  desc: 'Phase-wise averages, batting/bowling style, matchup stats',                 accent: 'var(--accent-purple)' },
  { href: '/phases',   icon: '📊', title: 'Phase Analysis',       desc: 'Powerplay, middle overs & death — benchmarks and batter roles',             accent: 'var(--accent-green)' },
  { href: '/matches',  icon: '📋', title: 'Match Explorer',       desc: 'Browse matches, filter by venue, season, result',                           accent: 'var(--accent-amber)' },
  { href: '/analysis', icon: '🔍', title: 'Match Analysis',       desc: 'Win patterns — toss impact, phase execution, score targets',                accent: 'var(--accent-red)' },
  { href: '/strategy', icon: '🎯', title: 'Strategy',             desc: 'Phase batting targets, chase blueprints, bowler effectiveness by venue',    accent: 'var(--accent-green)' },
]

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('deliveries').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('venues').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('season').order('season', { ascending: true }).limit(1),
      supabase.from('matches').select('season').order('season', { ascending: false }).limit(1),
    ]).then(([m, d, p, v, minS, maxS]) => {
      setStats({
        matches: m.count ?? 0,
        deliveries: d.count ?? 0,
        players: p.count ?? 0,
        venues: v.count ?? 0,
        seasons: {
          min: (minS.data?.[0] as any)?.season ?? 2008,
          max: (maxS.data?.[0] as any)?.season ?? 2024,
        },
      })
    })
  }, [])

  const fmt = (n: number) => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  const statCards = stats ? [
    { label: 'Venues', value: String(stats.venues), sub: 'IPL + domestic', accent: 'var(--accent-blue)' },
    { label: 'Seasons', value: `${stats.seasons.min}–${stats.seasons.max}`, sub: 'IPL + T20I + SMAT', accent: 'var(--accent-green)' },
    { label: 'Matches', value: fmt(stats.matches), sub: 'ball-by-ball', accent: 'var(--accent-amber)' },
    { label: 'Deliveries', value: fmt(stats.deliveries), sub: 'across all competitions', accent: 'var(--accent-purple)' },
    { label: 'Players', value: fmt(stats.players), sub: 'across all competitions', accent: 'var(--accent-red)' },
  ] : [
    { label: 'Venues', value: '—', sub: 'Loading…', accent: 'var(--accent-blue)' },
    { label: 'Seasons', value: '—', sub: '', accent: 'var(--accent-green)' },
    { label: 'Matches', value: '—', sub: '', accent: 'var(--accent-amber)' },
    { label: 'Deliveries', value: '—', sub: '', accent: 'var(--accent-purple)' },
    { label: 'Players', value: '—', sub: '', accent: 'var(--accent-red)' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Cricket Intelligence</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          IPL & T20 analytics — pitch, players, phases, strategy
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map(s => (
          <div key={s.label} className="rounded-xl border p-4 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl font-bold mb-1" style={{ color: s.accent }}>{s.value}</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.label}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {NAV_CARDS.map(card => (
          <Link key={card.href} href={card.href}
            className="block rounded-xl p-5 border transition-opacity hover:opacity-80"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderLeft: `3px solid ${card.accent}` }}>
            <div className="text-2xl mb-3">{card.icon}</div>
            <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{card.title}</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{card.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
