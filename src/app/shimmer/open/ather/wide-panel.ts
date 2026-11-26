// M199 (Alex 11-26 playtest): room + station panels fill the screen WIDE before they scroll. Pure layout math + the hook the
// panels read. Desktop and landscape go wide (Store on the LEFT, the crafting centre on the RIGHT, side by side); a phone in
// portrait stacks as before. Run: npx tsx src/app/shimmer/open/ather/wide-panel.test.ts
import { useEffect, useState } from 'react'

/** under this the panels stack (the old useNarrow line, so a portrait phone is unchanged) */
export const WIDE_MIN = 760
/** the overlay's side gutters + the gap between the two columns */
export const GUTTER = 16, GAP = 18
const STORE_MIN = 300, STORE_MAX = 460, CRAFT_MAX = 860

export interface WideLayout { wide: boolean; store: number; craft: number }

/** The two columns' widths for a viewport. They always fit inside the viewport with the gutters; the store takes ~38% (300..460),
 *  the crafting centre the rest (up to 860). Narrow = one column, each panel its old 520 cap. */
export function widePanels(vw: number): WideLayout {
  if (!(vw >= WIDE_MIN)) return { wide: false, store: Math.min(520, vw - 2 * GUTTER), craft: Math.min(520, vw - 2 * GUTTER) }
  const room = vw - 2 * GUTTER - GAP
  const store = Math.round(Math.min(STORE_MAX, Math.max(STORE_MIN, room * 0.38)))
  const craft = Math.round(Math.min(CRAFT_MAX, room - store))
  return { wide: true, store, craft }
}

/** One station (no store, e.g. the alchemy set): how wide it may go. */
export const wideSingle = (vw: number): number => { const l = widePanels(vw); return l.wide ? Math.min(980, l.store + GAP + l.craft) : l.craft }

export function useWideLayout(): WideLayout & { vw: number } {
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  useEffect(() => { const f = () => setVw(window.innerWidth); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return { ...widePanels(vw), vw }
}
