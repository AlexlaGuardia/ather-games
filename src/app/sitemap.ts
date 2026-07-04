import type { MetadataRoute } from 'next'
import { GAMES } from '@/lib/games'

// Built off the games registry so it stays in sync — every LIVE game plus the
// hubs. Back-room / parked games are intentionally excluded (not public).
const BASE = 'https://ather.games'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const hubs = ['/room', '/arcade/all', '/grimoire', '/bookstore']
  const live = GAMES.filter((g) => g.tier === 'live').map((g) => g.href)

  const seen = new Set<string>()
  const paths = ['', ...hubs, ...live].filter((p) => (seen.has(p) ? false : (seen.add(p), true)))

  return paths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: path === '' || path === '/room' ? 1 : 0.7,
  }))
}
