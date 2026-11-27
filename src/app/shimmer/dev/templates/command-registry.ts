/**
 * ⚠ THE LINK ENTRIES ARE DERIVED FROM `dev-pages.ts`, NOT TYPED OUT HERE.
 * This registry had thirty editor modes and TWO navigate entries, while sixteen standalone dev
 * pages shipped with their own URLs — so Ctrl-K could not reach the pages most in need of being
 * reachable. Hand-maintaining a second roster is what produced that gap; a page registered once
 * now appears in the palette and on the index without anyone adding it twice.
 */
import { DEV_PAGES } from './dev-pages'

export interface CommandEntry {
  id: string
  label: string
  keywords?: string[]
  category: 'editor' | 'link' | 'action'
  action: 'switchMode' | 'navigate' | 'deploy'
  mode?: string
  href?: string
}

export const COMMAND_REGISTRY: CommandEntry[] = [
  // M214: only the editors the live game reads (see EDITOR_MAP in ../page.tsx); the rest are in DEV_ARCHIVE.md.
  { id: 'terrain', label: 'Creative mode', keywords: ['world', 'builder', 'terrain', 'zones', 'creative'], category: 'editor', action: 'switchMode', mode: 'terrain' },
  { id: 'spirits', label: 'Spirit gallery', keywords: ['spirit', 'model', 'form', 'gallery'], category: 'editor', action: 'switchMode', mode: 'spirits' },
  { id: 'fair', label: 'Fair events bench', keywords: ['fair', 'clash', 'dash', 'smash', 'bench'], category: 'editor', action: 'switchMode', mode: 'fair' },
  { id: 'moves', label: 'Moves', keywords: ['attack', 'ability'], category: 'editor', action: 'switchMode', mode: 'moves' },
  { id: 'evolution', label: 'Evolution', keywords: ['evolve', 'stage'], category: 'editor', action: 'switchMode', mode: 'evolution' },
  { id: 'tools', label: 'Tools', keywords: ['equipment', 'gear'], category: 'editor', action: 'switchMode', mode: 'tools' },
  { id: 'alchemy', label: 'Alchemy', keywords: ['potion', 'recipe', 'brew'], category: 'editor', action: 'switchMode', mode: 'alchemy' },
  { id: 'farming', label: 'Farming', keywords: ['crops', 'harvest'], category: 'editor', action: 'switchMode', mode: 'farming' },
  { id: 'resources', label: 'Resources', keywords: ['material', 'ingredient'], category: 'editor', action: 'switchMode', mode: 'resources' },
  { id: 'items', label: 'Items', keywords: ['inventory', 'icon'], category: 'editor', action: 'switchMode', mode: 'items' },
  { id: 'skills', label: 'Skills', keywords: ['ability', 'talent'], category: 'editor', action: 'switchMode', mode: 'skills' },
  { id: 'mana', label: 'Mana', keywords: ['magic', 'energy'], category: 'editor', action: 'switchMode', mode: 'mana' },
  { id: 'daycycle', label: 'Day/Night', keywords: ['time', 'cycle', 'clock'], category: 'editor', action: 'switchMode', mode: 'daycycle' },

  // Links
  { id: 'index', label: 'All dev pages', keywords: ['index', 'home', 'everything', 'list'], category: 'editor', action: 'switchMode', mode: 'index' },
  ...DEV_PAGES.map((p): CommandEntry => ({
    id: `page:${p.path}`,
    label: p.title,
    keywords: [...(p.keywords ?? []), ...p.path.split('/').filter(Boolean)],
    category: 'link',
    action: 'navigate',
    href: p.path,
  })),
  { id: 'play', label: 'Play Game', keywords: ['test', 'run'], category: 'link', action: 'navigate', href: '/shimmer' },

  // Actions
  { id: 'deploy', label: 'Deploy to Game', keywords: ['build', 'publish'], category: 'action', action: 'deploy' },
]

export function searchCommands(query: string): CommandEntry[] {
  const q = query.trim().toLowerCase()

  if (!q) {
    return COMMAND_REGISTRY.slice(0, 12)
  }

  const prefixMatches: CommandEntry[] = []
  const substringMatches: CommandEntry[] = []

  for (const entry of COMMAND_REGISTRY) {
    const label = entry.label.toLowerCase()
    const keywords = (entry.keywords ?? []).map(k => k.toLowerCase())

    const labelPrefix = label.startsWith(q)
    const labelSubstring = !labelPrefix && label.includes(q)
    const keywordMatch = keywords.some(k => k.includes(q))

    if (labelPrefix) {
      prefixMatches.push(entry)
    } else if (labelSubstring || keywordMatch) {
      substringMatches.push(entry)
    }
  }

  return [...prefixMatches, ...substringMatches].slice(0, 12)
}
