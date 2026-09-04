'use client'

// The keeper panel, alone, with no world under it and no Marks to earn.
//
// ★ WHY THIS EXISTS (2026-09-04, play lane). Every GBOARD block written across 09-03 and 09-04
// carries the same stamp: NOT LOOKED AT. The vessels ruling, the letters card split, the three-tab
// shell, the seats, the chrome pass — all covered by headless asserts, none of it seen rendered.
// The cause was mechanical, not neglect: the only road to a written vessel ran through play. Earn
// 75 Marks, buy a bracelet at the Passage, dig a crystal, imbue it, bind the word. That is twenty
// minutes to answer a question the design brief asks outright, and asks of the EYE:
//
//     "an empty seat is dark and visibly empty — a player reads how loaded a keeper is from
//      across the square."
//
// No assert in this repo can answer that. This page removes the twenty minutes.
//
// ★★ IT MOUNTS THE REAL BODIES, NOT COPIES OF THEM — the same constraint `dev/hud` states and for
// the same reason: a preview that re-derives can be perfectly correct while the game is wrong,
// which is the exact failure a preview exists to catch. `SatchelLetters` and `GearTab` here are the
// components `/shimmer/voxel3d` mounts, exported for this page (0dfae8d); the keeper they read is
// written by `panel-fixture.ts` through the SHIPPED save functions. What you see is the panel, or
// it is a bug in the panel.
//
// ⚠ THE SCENARIO SWITCH REMOUNTS, AND THAT IS NOT A FLOURISH. `GearTab` pins the runes, the birth
// and the book in `useState` on mount, on purpose — a keeper's identity cannot change while the
// panel is open. So seeding new state under a live tab would leave the old keeper on screen and the
// page would quietly show the wrong scenario under the right label. The `key` forces a real mount.
//
// ⚠ THE BACKDROPS ARE NOT A GARNISH. A dark seat is a dim rounded void; whether it reads as EMPTY
// rather than as a hole, a rim or a rendering fault depends on what sits behind the plate. Judging
// it only on near-black is judging it against one of the backdrops a player rarely stands on.
//
// ⛔ GRIMOIRE IS DELIBERATELY NOT DRIVEN HERE. It needs a party and a spirit index, which is a
// different fixture and a different question. This bench is about the seats.
//
// Run: tools/devwin.sh play → /shimmer/dev/panel

import { useEffect, useMemo, useRef, useState } from 'react'
import { KeeperFrame, TabEmpty, type KeeperTab } from '../../voxel3d/keeper-panel'
import { GearTab, SatchelLetters } from '../../voxel3d/VoxelWorld'
import { PANEL_SCENARIOS, planPanel, seedPanel, type PanelPlan, type PanelScenarioId } from '../../play3d/panel-fixture'
import { VESSEL_CAP, VESSELS } from '../../play3d/gems'
import { createInventory, type Inventory } from '../../engine/inventory'
import { ensureBasicTools, type EquippedTools } from '../../engine/tools'
import { createSkillSet, type SkillSet } from '../../engine/skills'

/** The grounds the panel actually opens over. Night is where it was tuned. */
const BACKDROPS = [
  { id: 'night', label: 'night', css: '#0b0d14' },
  { id: 'grass', label: 'grass', css: '#4a7c3f' },
  { id: 'stone', label: 'stone', css: '#8a8a86' },
  { id: 'dusk', label: 'dusk', css: '#c8a06a' },
  { id: 'sky', label: 'sky', css: '#a8cbe0' },
] as const

export default function PanelDevPage() {
  const [scenario, setScenario] = useState<PanelScenarioId>('fresh')
  const [tab, setTab] = useState<KeeperTab>('gear')
  const [bg, setBg] = useState<string>(BACKDROPS[0].css)
  const [gen, setGen] = useState(0)
  // ⚠ CLIENT-ONLY ON PURPOSE, AND NOT FOR TIDINESS. Every save function here is try/catch'd for
  // private mode, so a server render does not crash — it does something worse. It reads a keeper
  // with no runes, paints an EMPTY panel, and then hydration swaps in the seeded one: a flash of
  // the wrong keeper on a bench whose entire job is to be looked at. Briefly wrong is the worst
  // duration for a lie in an instrument. Nothing renders until there is a browser to render for.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ★ THE SCENARIO AND TAB ARE READABLE FROM THE URL (`?s=written&tab=satchel`), so a specific read
  // can be linked, bookmarked and SHOT. `scripts/page-shot.mts` photographs a path and cannot click,
  // so without this every screenshot of this bench would be the same default keeper — and a contact
  // sheet of five identical pictures is the kind of evidence that gets believed at a glance.
  // Read once, on mount: a live subscription would fight the buttons for control of the same state.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const s = q.get('s'); const t = q.get('tab')
    if (s && PANEL_SCENARIOS.some(x => x.id === s)) setScenario(s as PanelScenarioId)
    if (t === 'satchel' || t === 'gear' || t === 'grimoire') setTab(t)
    const b = BACKDROPS.find(x => x.id === q.get('bg')); if (b) setBg(b.css)
  }, [])

  // The same ref SHAPES the game hands these bodies — refs, not props, because that is what it takes.
  const items = useRef<Inventory>(createInventory())
  const tools = useRef<EquippedTools>(ensureBasicTools({} as EquippedTools))
  const skills = useRef<SkillSet>(createSkillSet())

  // ★ Seeding happens HERE, in render-time memo keyed on the scenario and the generation counter, so
  // the state is written BEFORE the bodies below mount and read it. A seed in an effect would run
  // after the first paint, and the panel would show the previous keeper for a frame — briefly, which
  // is the worst duration for a lie in a tool built to be looked at.
  const plan: PanelPlan = useMemo(() => (mounted ? seedPanel(scenario) : planPanel(scenario)), [mounted, scenario, gen])
  const asks = PANEL_SCENARIOS.find(s => s.id === scenario)?.asks ?? ''
  const seated = VESSELS.map(k => `${k} ${plan.worn[k].length}/${VESSEL_CAP}`).join(' · ')

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0b0d14] text-white/80 font-mono text-[12px]">
      <div className="shrink-0 flex flex-wrap items-center gap-2 p-3 border-b border-white/10">
        <span className="text-white/50">KEEPER PANEL · no world, no Marks</span>
        {PANEL_SCENARIOS.map(s => (
          <button key={s.id} type="button" onClick={() => setScenario(s.id)}
            className={`px-2 py-1 rounded border ${scenario === s.id ? 'border-amber-300 text-amber-200' : 'border-white/20 text-white/60'}`}>
            {s.label}
          </button>
        ))}
        <span className="mx-1 text-white/20">|</span>
        {BACKDROPS.map(b => (
          <button key={b.id} type="button" onClick={() => setBg(b.css)}
            className={`px-2 py-1 rounded border ${bg === b.css ? 'border-amber-300 text-amber-200' : 'border-white/20 text-white/60'}`}>
            {b.label}
          </button>
        ))}
        <button type="button" onClick={() => setGen(n => n + 1)}
          className="px-2 py-1 rounded border border-white/20 text-white/60">re-seed</button>
      </div>

      {/* ★ THE QUESTION IS PRINTED BESIDE THE PICTURE. A bench of images with no question is
          decoration; this is the sentence the look is supposed to answer. And `plan.why` is printed
          with it ON PURPOSE — it is the fixture stating what it believes it built, so a scenario
          that quietly fails to seat what its label claims is caught by reading, not assumed away.
          The first cut of this fixture was green at 71/0 and drew `written` identically to
          `partial`; this row is what makes that visible without running a test. */}
      <div className="shrink-0 px-3 py-2 border-b border-white/10 text-[11px]">
        <div className="text-amber-200/80">{asks}</div>
        <div className="mt-0.5 text-white/35">{seated} · spares {plan.spares.length} · {plan.why}</div>
      </div>

      {/* The stage is `relative` and fills what is left, so KeeperFrame's `absolute inset-0` centring
          resolves exactly as it does over the world. `flex-1 min-h-0`, never a hardcoded height —
          the toolbar wraps at narrow widths and a measurement of another element is a mirror of it. */}
      <div className="relative w-full flex-1 min-h-0" style={{ background: bg }}>
        {!mounted ? null : <KeeperFrame key={`${scenario}:${gen}`} tab={tab} setTab={setTab} onClose={() => {}}
                     hint={<span className="text-white/40">dev bench · nothing here is saved to a real keeper</span>}>
          {tab === 'satchel' && <SatchelLetters owned={plan.owned} birth={plan.birth} items={items} onChange={() => setGen(n => n + 1)} />}
          {tab === 'gear' && <GearTab items={items} onLetters={() => setGen(n => n + 1)} tools={tools} skills={skills} />}
          {tab === 'grimoire' && (
            <TabEmpty>The grimoire needs a party and a spirit index. This bench drives the seats; open the game for that one.</TabEmpty>
          )}
        </KeeperFrame>}
      </div>
    </div>
  )
}
