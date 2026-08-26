'use client'

// The HUD corner, alone, with no world under it.
//
// ★ WHY THIS EXISTS (Alex, 2026-08-26): iterating on the bottom-right cluster meant loading
// `/shimmer/voxel3d` — 30s of worldgen, 19fps, and a GPU at 86% — to look at four sockets and a
// vessel. Four layout fixes went out that way, each one a full build-and-deploy to see a number
// move. This page renders the same cluster in a static box, instantly.
//
// ★★ IT MOUNTS `HudCorner` ITSELF, NOT A COPY OF IT — and that is the entire design constraint.
// `dev/icons` states the rule this page obeys: *"a preview that re-derives can be perfectly correct
// while the game is wrong, which is the exact failure a preview exists to catch."* The positioning
// moved into `hud-corner.tsx` along with the children for the same reason: the ANCHORING is the
// part that has actually been wrong every time, so a harness that restated it would preview the one
// thing it cannot vouch for.
//
// ⚠ THE BACKGROUNDS ARE NOT A GARNISH, and this HUD has the scars: an emerald health bar that
// vanished into grass, and tool sockets that read as "translucent green shapes" once dimmed. A
// cluster judged only on near-black is judged against the one backdrop a player rarely sees.
//
// Run: tools/devwin.sh <lane> → /shimmer/dev/hud

import { useEffect, useRef, useState } from 'react'
import { HudCorner } from '../../voxel3d/hud-corner'
import { ResourceBars } from '../../voxel3d/resource-bars'
import { freshVitals, damage, type Vitals } from '../../engine/vitals'
import { createSkillSet, type SkillSet } from '../../engine/skills'
import { ensureBasicTools, type EquippedTools } from '../../engine/tools'

/** The backdrops the cluster actually sits on in play. Night is where it was tuned; the others are
 *  where it has historically failed. */
const BACKDROPS = [
  { id: 'night', label: 'night', css: '#0b0d14' },
  { id: 'grass', label: 'grass', css: '#4a7c3f' },
  { id: 'stone', label: 'stone', css: '#8a8a86' },
  { id: 'dusk', label: 'dusk', css: '#c8a06a' },
  { id: 'sky', label: 'sky', css: '#a8cbe0' },
] as const

export default function HudDevPage() {
  const [bg, setBg] = useState<string>(BACKDROPS[0].css)
  const [pct, setPct] = useState(0.62)
  const [live, setLive] = useState(false)
  const [active, setActive] = useState<string | null>('forestry')

  // The same ref SHAPES the game hands the cluster — refs, not props, because that is what it takes.
  const mana = useRef<{ cur: number; max: number; regen: number } | null>({ cur: 120, max: 200, regen: 1 })
  const tools = useRef<EquippedTools>(ensureBasicTools({} as EquippedTools))
  const skills = useRef<SkillSet>(createSkillSet())
  // ⚠ REAL `Vitals`, driven through the REAL `damage()` — the same function the Hollows call. A
  // harness that just set two percentages would preview a pair of divs; this previews the thing the
  // fight actually produces, including the shield-soaks-first-then-spills order that makes the two
  // bars mean different things.
  const vitals = useRef<Vitals>(freshVitals())
  const [, bump] = useState(0)

  useEffect(() => {
    if (mana.current) { mana.current.max = 200; mana.current.cur = Math.round(200 * pct) }
  }, [pct])

  // ⚠ The vessel polls its ref at 10Hz and writes the transform directly — it never re-renders on
  // React state. So a slider that only set React state would move the NUMBER and not the LIQUID,
  // and the page would silently stop testing the thing it exists to test.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      const m = mana.current
      if (!m) return
      m.cur = m.cur <= 0 ? m.max : m.cur - m.max / 120
    }, 100)
    return () => clearInterval(id)
  }, [live])

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0b0d14] text-white/80 font-mono text-[12px]">
      <div className="shrink-0 flex flex-wrap items-center gap-3 p-3 border-b border-white/10">
        <span className="text-white/50">HUD CORNER · no world, no GPU</span>
        {BACKDROPS.map(b => (
          <button key={b.id} type="button" onClick={() => setBg(b.css)}
            className={`px-2 py-1 rounded border ${bg === b.css ? 'border-amber-300 text-amber-200' : 'border-white/20 text-white/60'}`}>
            {b.label}
          </button>
        ))}
        <label className="flex items-center gap-2">
          mana
          <input type="range" min={0} max={1} step={0.01} value={pct} disabled={live}
                 onChange={e => setPct(Number(e.target.value))} />
          <span className="tabular-nums w-10">{Math.round(pct * 100)}%</span>
        </label>
        <button type="button"
          onClick={() => { vitals.current = damage(vitals.current, 22).vitals; bump(n => n + 1) }}
          className="px-2 py-1 rounded border border-white/20 text-white/60">take a hit</button>
        <button type="button"
          onClick={() => { vitals.current = freshVitals(); bump(n => n + 1) }}
          className="px-2 py-1 rounded border border-white/20 text-white/60">heal</button>
        <button type="button" onClick={() => setLive(v => !v)}
          className={`px-2 py-1 rounded border ${live ? 'border-amber-300 text-amber-200' : 'border-white/20 text-white/60'}`}>
          {live ? 'draining' : 'drain'}
        </button>
        <label className="flex items-center gap-2">
          active tool
          <select value={active ?? ''} onChange={e => setActive(e.target.value || null)}
                  className="bg-black/40 border border-white/20 rounded px-1 py-0.5">
            <option value="">none</option>
            <option value="forestry">forestry</option>
            <option value="prospecting">prospecting</option>
            <option value="rinning">rinning</option>
            <option value="farming">farming</option>
          </select>
        </label>
      </div>

      {/* The stage is `relative` and viewport-tall, so `absolute bottom-4 right-4` inside HudCorner
          resolves exactly as it does over the world. A stage that shrink-wrapped would move the
          corner and the preview would be lying about the only thing it is here to show. */}
      {/* ⚠ `flex-1`, NOT `calc(100vh - 49px)`. The first version hardcoded the toolbar's height, and
          the moment two more buttons made it wrap to a second row the stage overflowed and pushed
          the bottom-left bars off screen — a harness lying about the exact corner it exists to show.
          A measurement of another element's height is a mirror of that element. */}
      <div className="relative w-full flex-1 min-h-0" style={{ background: bg }}>
        <ResourceBars vitals={vitals} />
        <HudCorner mana={mana} activeTool={active} tools={tools} skills={skills} />
      </div>
    </div>
  )
}
