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
  // SPRITES group
  { id: 'sprites', label: 'Spirits', keywords: ['sprite', 'fox', 'owl'], category: 'editor', action: 'switchMode', mode: 'sprites' },
  { id: 'player', label: 'Player', keywords: ['character'], category: 'editor', action: 'switchMode', mode: 'player' },
  { id: 'beasts', label: 'Beasts', keywords: ['enemy', 'monster'], category: 'editor', action: 'switchMode', mode: 'beasts' },
  { id: 'items', label: 'Items', keywords: ['inventory', 'equipment'], category: 'editor', action: 'switchMode', mode: 'items' },
  { id: 'furniture', label: 'Furniture', keywords: ['decoration', 'house'], category: 'editor', action: 'switchMode', mode: 'furniture' },
  { id: 'nodes', label: 'Nodes', keywords: ['resource', 'gather'], category: 'editor', action: 'switchMode', mode: 'nodes' },

  // WORLD group
  { id: 'map', label: 'Map', keywords: ['world', 'zone', 'tilemap'], category: 'editor', action: 'switchMode', mode: 'map' },
  { id: 'structures', label: 'Structures', keywords: ['building', 'stamp'], category: 'editor', action: 'switchMode', mode: 'structures' },
  { id: 'npcs', label: 'NPCs', keywords: ['character', 'villager'], category: 'editor', action: 'switchMode', mode: 'npcs' },

  // SYSTEMS group
  { id: 'battle', label: 'Battle', keywords: ['combat', 'fight'], category: 'editor', action: 'switchMode', mode: 'battle' },
  { id: 'moves', label: 'Moves', keywords: ['attack', 'ability'], category: 'editor', action: 'switchMode', mode: 'moves' },
  { id: 'farming', label: 'Farming', keywords: ['crops', 'harvest'], category: 'editor', action: 'switchMode', mode: 'farming' },
  { id: 'exchange', label: 'Exchange', keywords: ['trade', 'shop', 'market'], category: 'editor', action: 'switchMode', mode: 'exchange' },
  { id: 'encounters', label: 'Encounters', keywords: ['zone', 'spawn'], category: 'editor', action: 'switchMode', mode: 'encounters' },
  { id: 'alchemy', label: 'Alchemy', keywords: ['potion', 'recipe', 'brew'], category: 'editor', action: 'switchMode', mode: 'alchemy' },
  { id: 'quests', label: 'Quests', keywords: ['task', 'mission'], category: 'editor', action: 'switchMode', mode: 'quests' },
  { id: 'evolution', label: 'Evolution', keywords: ['evolve', 'stage'], category: 'editor', action: 'switchMode', mode: 'evolution' },
  { id: 'resources', label: 'Resources', keywords: ['material', 'ingredient'], category: 'editor', action: 'switchMode', mode: 'resources' },
  { id: 'tools', label: 'Tools', keywords: ['equipment', 'gear'], category: 'editor', action: 'switchMode', mode: 'tools' },
  { id: 'skills', label: 'Skills', keywords: ['ability', 'talent'], category: 'editor', action: 'switchMode', mode: 'skills' },
  { id: 'mana', label: 'Mana', keywords: ['magic', 'energy'], category: 'editor', action: 'switchMode', mode: 'mana' },
  { id: 'daycycle', label: 'Day/Night', keywords: ['time', 'cycle', 'clock'], category: 'editor', action: 'switchMode', mode: 'daycycle' },

  // TOOLS group
  { id: 'banner', label: 'Banner', keywords: ['header', 'title'], category: 'editor', action: 'switchMode', mode: 'banner' },
  { id: 'spinner', label: 'Spinner', keywords: ['loading', 'wheel'], category: 'editor', action: 'switchMode', mode: 'spinner' },
  { id: 'voices', label: 'Voices', keywords: ['audio', 'sound', 'speech'], category: 'editor', action: 'switchMode', mode: 'voices' },

  // Links
  { id: 'dialogue', label: 'Dialogue Editor', keywords: ['conversation', 'npc', 'talk'], category: 'link', action: 'navigate', href: '/shimmer/dev/dialogue' },
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
