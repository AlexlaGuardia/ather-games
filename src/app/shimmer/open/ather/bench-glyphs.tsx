'use client'
// Code-drawn glyphs for the bench tabs (bench-tabs.ts). Placeholder craft: one stroke weight, ink colour, 24 px box; swap for
// painted icons any time without touching the panel (it only calls <TabGlyph tab=... />).
import type { BenchTab } from './bench-tabs'

const P: Record<BenchTab, React.ReactNode> = {
  // a saw over a plank
  refine: <><rect x="3" y="15" width="18" height="5" rx="1" /><path d="M6 13 L17 4 L20 7 L9 15" /><path d="M9 11.5l1 1M11.5 9.5l1 1M14 7.5l1 1" /></>,
  // a chair
  furniture: <><path d="M7 3v17M7 12h10v8M7 12V3h9v9" /><path d="M7 8h9" /></>,
  // a curved blade on a grip
  blades: <><path d="M5 19l4-4" /><path d="M9 15c2-6 6-10 11-11-1 5-5 9-11 11z" /></>,
  // a crystal spike
  spikes: <><path d="M12 2l5 8-5 12-5-12z" /><path d="M7 10h10M12 2v20" /></>,
  // a flame on a hearth stone
  hearth: <><path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-8z" /><path d="M4 21h16" /></>,
  // a cauldron with a bubble
  cauldron: <><path d="M4 10h16M5 10c0 6 3 9 7 9s7-3 7-9" /><path d="M7 21l1-2M17 21l-1-2" /><circle cx="10" cy="6" r="1.5" /><circle cx="14" cy="4" r="1" /></>,
  // a hook
  bait: <><path d="M12 3v11a4 4 0 0 1-8 0v-2" /><path d="M4 12l2 2" /><circle cx="12" cy="3" r="1" /></>,
  // a rod with its line
  rinsticks: <><path d="M4 20L19 4" /><path d="M19 4c1 6 0 10-2 14" /><circle cx="17" cy="19" r="1.3" /></>,
  // a round Moglin head with ears
  keeper: <><circle cx="12" cy="13" r="6.5" /><path d="M7 8L5 3l4 3M17 8l2-5-4 3" /><circle cx="10" cy="12.5" r=".6" /><circle cx="14" cy="12.5" r=".6" /></>,
}

export function TabGlyph({ tab, size = 22 }: { tab: BenchTab; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[tab]}
    </svg>
  )
}
