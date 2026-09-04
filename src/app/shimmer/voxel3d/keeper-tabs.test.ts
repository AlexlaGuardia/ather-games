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
ok(/Array\.from\(\{ length: VESSEL_CAP \}/.test(seats),
   '★ Seats draws exactly VESSEL_CAP seats — the cap, never a literal 3, never the gems.length')
ok(count(rack, /<Seats /g) === 2,
   `★ the rack draws seats on the worn vessel AND on every spare (${count(rack, /<Seats /g)} mounts, want 2)`)
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
