'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const nav = [
  { href: '/', label: 'Overview', icon: '◉' },
  { href: '/venues', label: 'Venues', icon: '🏟' },
  { href: '/players', label: 'Players', icon: '👤' },
  { href: '/matches', label: 'Matches', icon: '📋' },
  { href: '/phases', label: 'Phase Analysis', icon: '📊' },
  { href: '/analysis', label: 'Match Analysis', icon: '🔍' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col border-r"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🏏</span>
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Cricket IQ
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              IPL Analytics
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'font-semibold'
                  : 'hover:opacity-80'
              )}
              style={{
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                borderLeft: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        Data: Cricsheet · IPL + SMAT
      </div>
    </aside>
  )
}
