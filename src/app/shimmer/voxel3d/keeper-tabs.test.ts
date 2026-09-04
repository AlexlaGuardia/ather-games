/**
 * The keeper panel's SHELL: three tabs, one body each, every seat drawn.
 * Run: `npx tsx src/app/shimmer/voxel3d/keeper-tabs.test.ts`
 *
 * Alex, 2026-09-03 eve (the pinned inventory-menu conversation): *"not convinced we need that
 * runes tab"* · *"the seats should show up in gear."* This suite is those two sentences as
 * asserts, plus the fold of Tools into Gear that follows from canon calling a Blade a *gathering
 * focus*. A shell is the easiest thing in a panel to drift — a fifth tab is one array entry — so
 * the list is asserted by VALUE, and the host is asserted to mount exactly one body per entry.
 */
import { readFileSync } from 'node:fs'
import { KEEPER_TABS } from './keeper-panel'
import { noComments, declAt, declAfter } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

// ── A. the list itself ──────────────────────────────────────────────────────────────────────────
const ids = KEEPER_TABS.map(t => t.id)
ok(JSON.stringify(ids) === JSON.stringify(['satchel', 'gear', 'grimoire']),
   `★ exactly three tabs, in the keeper's chain — carry · wear · know (got ${ids.join(' · ')})`)
ok(!ids.some(id => ['runes', 'tools', 'loadout'].includes(id)),
   '★ none of the retired ids came back — Runes retired, Tools folded, Loadout renamed (2026-09-04)')

// ── B. the host mounts one body per tab, and nothing for a tab that is not on the list ─────────
const src = noComments(readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8'))
for (const id of ids) {
  ok(count(src, new RegExp(`\\{tab === '${id}' && `, 'g')) === 1, `one body mounted for '${id}'`)
}
// ⚠ Anchored at LINE START: `hint={tab === 'satchel' ? …}` on the frame is a prop, not a body, and
// an unanchored `{tab === '` counted it — 4 for 3 tabs on a correct host. Bodies are their own line.
const bodies = count(src, /^\s*\{tab === '/gm)
ok(bodies === ids.length, `★ no body for a tab that is not on the list (${bodies} mounts for ${ids.length} tabs)`)
ok(!/function RunesTab\(|function ToolsTab\(|function LoadoutTab\(/.test(src),
   'the retired tab components are gone from the host, not merely unmounted')

// ── C. Gear: the seats, and the gathering focuses ──────────────────────────────────────────────
const rackAt = declAt(src, 'VesselRack')
const gearAt = declAfter(src, 'GearTab', rackAt)
ok(rackAt >= 0 && gearAt > rackAt, 'VesselRack and GearTab both present, in that order (the slice below needs both anchors)')
const rack = rackAt >= 0 && gearAt > rackAt ? src.slice(rackAt, gearAt) : ''
const seatsAt = declAt(src, 'Seats')
const seats = seatsAt >= 0 ? src.slice(seatsAt, src.indexOf('\n}\n', seatsAt)) : ''
// ★ RE-POINTED 2026-09-04 (Alex: *"if the move its meant to represent has one slot then it only needs
// the one slot"*): seats = the WORD's letters, capped at VESSEL_CAP — never a literal 3, never gems.length.
ok(/Array\.from\(\{ length: Math\.min\(VESSEL_CAP, Math\.max\(0, seats\)\) \}/.test(seats),
   '★ Seats draws the word\'s seat count, capped at VESSEL_CAP — the cap is a ceiling, not every vessel\'s count')
ok(/seats = VESSEL_CAP/.test(seats), 'a caller with no word still gets the cap as the default')
// ★ RE-POINTED 2026-09-04: only WRITTEN vessels are gear. The rack draws seats on the WORN vessel and
// offers the written spares in a dropdown BY WORD; unwritten parts live in the satchel (`VesselParts`).
ok(count(rack, /<Seats /g) === 1, `★ the rack draws seats on the worn vessel (${count(rack, /<Seats /g)} mounts, want 1)`)
ok(/<select /.test(rack) && /completeVessels\(/.test(rack), '★ the spares are a dropdown of WRITTEN vessels, by word (completeVessels)')
ok(/dismantleWorn\(/.test(rack), 'the worn vessel can be dismantled from the rack')
ok(!/doEquip\(kind, i\)\}\s*className="gx-btn flex/.test(rack), 'the old spare-button row is gone')
ok(!/nothing set|>empty</.test(rack),
   '★ an empty vessel is three dark seats, never a sentence — "nothing set" and "empty" are gone from the rack')
const gear = gearAt >= 0 ? src.slice(gearAt) : ''
ok(count(gear, /<GatheringFocuses /g) === 1, '★ Gear mounts the gathering focuses once — Tools folded in, not duplicated')
const gfAt = declAt(src, 'GatheringFocuses')
ok(gfAt >= 0 && /TOOL_FAMILIES\.map\(/.test(src.slice(gfAt, gfAt + 2500)),
   'the section still derives its rows from TOOL_FAMILIES — same data as the ToolArc, no second source')

console.log(`keeper-tabs: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
