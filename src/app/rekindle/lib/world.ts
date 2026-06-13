// REKINDLE — the world meta-layer. Each puzzle is a dead machine on the Aeterna
// network; clearing it lights the node and unlocks a lore fragment. The world
// wakes as you play. No lives, no timers, no IAP — the story is the reward.
//
// LORE STATUS: draft atmosphere for canon review via /magii. Leans on existing
// canon (Aeterna, the Ather, the machines left running in the dark) and invents
// no new named facts — keep it that way until the magii chair vets these.

export interface WorldNode {
  id: number
  level: number // index into puzzle LEVELS/TEMPLATES
  name: string
  x: number // map position, 0..100 (viewBox space)
  y: number // 0..62
  prereq: number | null // node that must be cleared to unlock this one
  lore: string
}

export const NODES: WorldNode[] = [
  {
    id: 0, level: 0, name: 'First Light', x: 12, y: 50, prereq: null,
    lore: 'The first conduit still remembers the shape of current. One vein wakes, and the dark leans back a hand’s breadth. It is not much. It is everything.',
  },
  {
    id: 1, level: 1, name: 'The Fork', x: 31, y: 28, prereq: 0,
    lore: 'Where the old engineers split a line, they split a choice. Two cores, one source — and the Ather, asked to be in two places, obliges without complaint.',
  },
  {
    id: 2, level: 2, name: 'Crossing', x: 50, y: 47, prereq: 1,
    lore: 'The machines were built to cross without touching. Whoever drew these lines feared the merge as much as the dark. You are beginning to understand why.',
  },
  {
    id: 3, level: 3, name: 'Two Currents', x: 70, y: 25, prereq: 2,
    lore: 'Not all Ather is the same Ather. The cyan runs cold and far; the amber runs warm and short. Kept apart, each remembers its purpose. Let them meet, and both forget.',
  },
  {
    id: 4, level: 4, name: 'Pure Veins', x: 88, y: 45, prereq: 3,
    lore: 'A pure vein is a kept promise. The deep machines ran ten thousand years because no one let the colours bleed. Hold the line, and the old discipline wakes with the light.',
  },
]

export const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
]

export const FINALE =
  'Five machines breathe. The network finds itself in the dark, node to node, the way a memory finds the next word. Aeterna is not awake. But it is dreaming again.'

// ── progression (localStorage) ──────────────────────────────────────────────
const KEY = 'rekindle.progress'
export type Progress = Record<number, number> // nodeId -> best stars (>0 means cleared)

export function loadProgress(): Progress {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export function recordClear(id: number, starsEarned: number): Progress {
  const p = loadProgress()
  p[id] = Math.max(p[id] || 0, starsEarned)
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
  return p
}

export const isCleared = (p: Progress, id: number) => (p[id] || 0) > 0
export const isUnlocked = (p: Progress, n: WorldNode) => n.prereq === null || isCleared(p, n.prereq)
export const allCleared = (p: Progress) => NODES.every((n) => isCleared(p, n.id))
