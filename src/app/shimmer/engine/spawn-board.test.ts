// Spawn-board oracle — run: npx tsx src/app/shimmer/engine/spawn-board.test.ts
//
// What this file is really guarding: a re-dealt world has failure modes you cannot see by standing
// in it. A board that is subtly non-deterministic looks perfect to one player and desyncs a party.
// A zone that loses every pond for one window in fifty looks fine all evening and then strands
// somebody's fishing session. A node that is in two consecutive deals but gets tagged `leaving`
// flickers once every 32 minutes, which nobody will ever catch mid-walk but which reads as jank.
//
// So the asserts here run the deal over HUNDREDS of windows against the REAL authored placements,
// not a fixture. The point is to be told about the one window in three hundred where a zone comes
// up empty — the exact bug an eyeball pass cannot find and a player would hit within a week.

import {
  dealZone, currentWindow, windowAt, nodeAlpha, tileKey, msUntilReset, entrySlots, zoneBand, slotKey,
  WINDOW_MS, FADE_OUT_MS, GROW_IN_MS, RESETS_PER_DAY, WORLD_SEED, isBoardPinned,
  bandFill, bandWeights, zoneResets, zoneWindow, msUntilZoneReset,
  type DealtNode,
} from './spawn-board'
import { CYCLE_MS, dayProgress, getDisplayTime } from './day-cycle'
import { ZONE_NODES } from '../world/node-placements'
import { NODE_DEFS } from '../world/resources'
import type { SkillId } from './skills'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { console.log(`  ok    ${label}`); return }
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

const WINDOWS = 300
const zonesWithNodes = Object.entries(ZONE_NODES).filter(([, ns]) => ns.length > 0)
const WILD = zonesWithNodes.filter(([z]) => z !== 'garden')
const skillOf = (t: string) => NODE_DEFS[t as keyof typeof NODE_DEFS].skill

console.log('\nspawn-board oracle\n')

console.log('the window lines up with the clock')
{
  check(`a day holds ${RESETS_PER_DAY} deals`, WINDOW_MS * RESETS_PER_DAY === CYCLE_MS)
  check('a window is 32 real minutes', WINDOW_MS === 32 * 60 * 1000)
  // The whole reason day-cycle put midnight on exactly 0.0: a re-deal has to land on a clock
  // moment the player can name, not 4 minutes past an arbitrary one.
  for (let i = 0; i < 8; i++) {
    const start = currentWindow(i * WINDOW_MS + 1).startMs
    const t = getDisplayTime(dayProgress(start))
    check(`window ${i} opens on the hour it should`, t === '00:00' || t === '12:00', t)
  }
  check('the fade fits inside the window it belongs to', FADE_OUT_MS < WINDOW_MS)
  check('arriving is a moment, leaving is a warning', GROW_IN_MS < FADE_OUT_MS)
  check('the board pin is off outside a browser', isBoardPinned === false)
}

console.log('\nthe deal is a pure function')
{
  const [zoneId, placements] = WILD[0]
  const a = dealZone(zoneId, placements, 42)
  const b = dealZone(zoneId, placements, 42)
  check('same window, same board', JSON.stringify(a) === JSON.stringify(b))

  // The multiplayer promise: another client, with its own copy of the placements in a different
  // order, must still deal the identical set. Order-dependence here would desync a party silently.
  const shuffled = [...placements].reverse()
  const c = dealZone(zoneId, shuffled, 42)
  const setOf = (d: DealtNode[]) => [...new Set(d.map(tileKey))].sort().join('|')
  check('another client dealing the same window sees the same nodes', setOf(a) === setOf(c))

  const d = dealZone(zoneId, placements, 43)
  check('a different window is a different board', setOf(a) !== setOf(d))

  const seeded = dealZone(zoneId, placements, 42, WORLD_SEED + 1)
  check('a different world seed is a different board', setOf(a) !== setOf(seeded))
}

console.log('\nthe board actually breathes')
{
  // Measured PER ZONE. A pooled ratio hides the shape: the zones holding one or two authored nodes
  // are almost entirely guarantee, so they legitimately never change, and enough of them drags the
  // pooled number down until a genuinely frozen big zone would pass unnoticed.
  for (const [zoneId, placements] of WILD.filter(([, ns]) => ns.length >= 6)) {
    let churned = 0
    let prev = dealZone(zoneId, placements, 0).map(tileKey).sort().join('|')
    for (let w = 1; w < WINDOWS; w++) {
      const key = dealZone(zoneId, placements, w).map(tileKey).sort().join('|')
      if (key !== prev) churned++
      prev = key
    }
    check(`${zoneId} re-deals nearly every window`, churned > WINDOWS * 0.9, `${churned}/${WINDOWS - 1}`)
  }

  // A slot that is never filled is an authored placement pretending to be a possibility. One that
  // is ALWAYS filled is the same thing — unless it is the only slot its skill has in that zone, in
  // which case the entry guarantee is holding it up every window, on purpose.
  const stuck: string[] = []
  for (const [zoneId, placements] of WILD) {
    for (const p of placements) {
      const sole = entrySlots(placements, NODE_DEFS[p.type].skill).length === 1
      let hits = 0
      for (let w = 0; w < WINDOWS; w++) {
        if (dealZone(zoneId, placements, w).some(n => n.tileX === p.tileX && n.tileY === p.tileY)) hits++
      }
      const rate = hits / WINDOWS
      if (rate === 0) stuck.push(`${zoneId} ${p.type}@${p.tileX},${p.tileY} never fills`)
      else if (rate === 1 && !sole) stuck.push(`${zoneId} ${p.type}@${p.tileX},${p.tileY} always fills`)
    }
  }
  check('no slot is stuck, unless the guarantee is holding it up', stuck.length === 0, stuck.slice(0, 4).join(', '))
}

console.log('\n★ the tier roll — a slot is a category, not a fixed node')
{
  // ★ THE LEVEL-GATING ASSERT. The band is inferred from what a zone authors precisely so a starter
  // zone can never roll an epic — a level-1 player standing in front of a node they cannot touch is
  // the same "seeing what you are locked out of" failure the entry guarantee exists to prevent.
  // If anyone ever swaps the per-zone band for a global rarity table, this is what fails.
  const overCeiling: string[] = []
  for (const [zoneId, placements] of WILD) {
    for (let w = 0; w < WINDOWS; w++) {
      for (const n of dealZone(zoneId, placements, w)) {
        const band = zoneBand(placements, NODE_DEFS[n.type].skill)
        if (!band.includes(n.type)) overCeiling.push(`${zoneId} dealt ${n.type} @w${w} (band ${band.join('/')})`)
      }
    }
  }
  check('★ a zone never deals a tier it did not author', overCeiling.length === 0,
    `${overCeiling.length}, e.g. ${overCeiling.slice(0, 2).join(', ')}`)

  // The payoff of the whole change: the same clearing holds different things on different visits.
  const varied: string[] = []
  for (const [zoneId, placements] of WILD) {
    for (const p of placements) {
      if (zoneBand(placements, NODE_DEFS[p.type].skill).length < 2) continue   // nothing to vary
      const seen = new Set<string>()
      for (let w = 0; w < WINDOWS; w++) {
        for (const n of dealZone(zoneId, placements, w)) {
          if (n.tileX === p.tileX && n.tileY === p.tileY) seen.add(n.type)
        }
      }
      if (seen.size < 2) varied.push(`${zoneId} ${p.tileX},${p.tileY} only ever held ${[...seen]}`)
    }
  }
  check('a slot in a multi-tier zone holds different things over time', varied.length === 0,
    `${varied.length}, e.g. ${varied.slice(0, 2).join(', ')}`)

  // The weights should be visible in the outcome: within a zone's band, commoner tiers come up more
  // often than rarer ones. Checked as an ORDERING rather than exact frequencies — the guarantee
  // lifts the entry tier further, and pinning exact numbers would just re-encode the constants.
  const [zoneId, placements] = WILD.find(([, ns]) => zoneBand(ns, 'forestry').length >= 2)!
  const band = zoneBand(placements, 'forestry')
  const counts = band.map(t => {
    let c = 0
    for (let w = 0; w < WINDOWS; w++) c += dealZone(zoneId, placements, w).filter(n => n.type === t).length
    return c
  })
  check(`commoner tiers outnumber rarer ones in ${zoneId}`,
    counts.every((c, i) => i === 0 || c <= counts[i - 1]), band.map((t, i) => `${t}:${counts[i]}`).join(' '))
  check('...and every tier in the band actually appears', counts.every(c => c > 0), counts.join('/'))
}

console.log('\nthe Home Plot strips, and stays stripped')
{
  const garden = ZONE_NODES.garden
  const full = dealZone('garden', garden, 5)
  check('the plot starts with everything canon authored', full.length === garden.length)

  // Alex: "the home plot should clear the resource so the player has to go out for more."
  const taken = new Set([slotKey('garden', garden[0]), slotKey('garden', garden[1])])
  const after = dealZone('garden', garden, 5, undefined, taken)
  check('a stripped slot is gone', after.length === garden.length - 2)
  check('...and does not come back next window', dealZone('garden', garden, 6, undefined, taken).length === garden.length - 2)
  check('...and is still gone 300 windows later', dealZone('garden', garden, 305, undefined, taken).length === garden.length - 2)
  check('...while everything unstripped is untouched',
    after.every(n => !taken.has(n.key)) && after.length > 0)

  // The strip key must survive a tier re-roll AND a layout nudge, so it carries the zone + skill +
  // logical tile and nothing about what happened to be growing there.
  check('a strip is keyed on the slot, not on what grew in it',
    slotKey('garden', { type: 'goldwood', tileX: 4, tileY: 9 }) === slotKey('garden', { type: 'dawnwood', tileX: 4, tileY: 9 }))
  check('...and is zone-qualified, so a plot strip cannot take out a wild slot',
    slotKey('garden', garden[0]) !== slotKey('mycelial-path', garden[0]))
}

console.log('\n★ a zone never loses a whole skill')
{
  // The headline assert. Independent rolls WILL eventually drop every pond in a zone at once; in
  // the zones holding exactly one node of a skill it is a coin flip per window. This is the assert
  // that says the guarantee pass is load-bearing rather than decorative.
  const holes: string[] = []
  for (const [zoneId, placements] of zonesWithNodes) {
    const authored = new Set<SkillId>(placements.map(p => skillOf(p.type)))
    for (let w = 0; w < WINDOWS; w++) {
      const dealt = new Set<SkillId>(dealZone(zoneId, placements, w).map(n => skillOf(n.type)))
      for (const s of authored) if (!dealt.has(s)) holes.push(`${zoneId}/${s}@w${w}`)
    }
  }
  check(`every authored skill is standing in every one of ${WINDOWS} windows`, holes.length === 0,
    `${holes.length} holes, e.g. ${holes.slice(0, 3).join(', ')}`)

  // And the guarantee has to be HARVESTABLE, not just present — a level-10 dawnwood standing in for
  // a missing level-1 goldwood is a guarantee a new player cannot cash.
  const tooHigh: string[] = []
  for (const [zoneId, placements] of WILD) {
    const bySkill = new Map<SkillId, number>()
    for (const p of placements) {
      const s = skillOf(p.type), lv = NODE_DEFS[p.type].minLevel
      bySkill.set(s, Math.min(bySkill.get(s) ?? 99, lv))
    }
    for (let w = 0; w < WINDOWS; w++) {
      const dealt = dealZone(zoneId, placements, w)
      for (const [s, lowest] of bySkill) {
        const best = Math.min(...dealt.filter(n => skillOf(n.type) === s).map(n => NODE_DEFS[n.type].minLevel))
        if (best > lowest) tooHigh.push(`${zoneId}/${s}@w${w} (${best} > ${lowest})`)
      }
    }
  }
  check('the entry-level node for each skill is always reachable', tooHigh.length === 0,
    `${tooHigh.length}, e.g. ${tooHigh.slice(0, 3).join(', ')}`)

  const single = WILD.find(([, ns]) => ns.length === 1)
  if (single) {
    const [zid, ns] = single
    let up = 0
    for (let w = 0; w < WINDOWS; w++) if (dealZone(zid, ns, w).length === 1) up++
    check(`a zone with one authored node always has it (${zid})`, up === WINDOWS, `${up}/${WINDOWS}`)
  }
}

console.log('\nthe Home Plot does not re-deal')
{
  const garden = ZONE_NODES.garden
  const first = dealZone('garden', garden, 0).map(tileKey).sort().join('|')
  let same = true, tagged = false
  for (let w = 0; w < WINDOWS; w++) {
    const d = dealZone('garden', garden, w)
    if (d.map(tileKey).sort().join('|') !== first) same = false
    if (d.some(n => n.leaving || n.arriving)) tagged = true
  }
  check('your own plot is the same plot every window', same)
  check('...and nothing in it is ever tagged arriving or leaving', !tagged)
  check('...and it keeps every authored node', dealZone('garden', garden, 9).length === garden.length)
}

console.log('\narriving / leaving are read off the neighbours')
{
  const [zoneId, placements] = WILD.find(([, ns]) => ns.length >= 8)!
  let wrongLeaving = 0, wrongArriving = 0, flickered = 0
  for (let w = 1; w < WINDOWS; w++) {
    const prev = new Set(dealZone(zoneId, placements, w - 1).map(tileKey))
    const now = dealZone(zoneId, placements, w)
    const next = new Set(dealZone(zoneId, placements, w + 1).map(tileKey))
    for (const n of now) {
      const k = tileKey(n)
      if (n.leaving !== !next.has(k)) wrongLeaving++
      if (n.arriving !== !prev.has(k)) wrongArriving++
      // ★ the no-flicker property: survive a boundary and you must not move a pixel.
      if (prev.has(k) && next.has(k) && (n.leaving || n.arriving)) flickered++
    }
  }
  check('leaving means "not in the next deal"', wrongLeaving === 0, `${wrongLeaving} wrong`)
  check('arriving means "not in the last deal"', wrongArriving === 0, `${wrongArriving} wrong`)
  check('★ a node that survives a boundary never flickers', flickered === 0, `${flickered} flickered`)
}

console.log('\nthe fade')
{
  const win = currentWindow(WINDOW_MS * 10 + 1)
  const at = (ms: number) => win.startMs + ms
  const stable: DealtNode = { type: 'goldwood', tileX: 1, tileY: 1, key: 'z|forestry@1,1', leaving: false, arriving: false }
  const going: DealtNode = { ...stable, leaving: true }
  const coming: DealtNode = { ...stable, arriving: true }

  check('a stable node is fully present all window', [0, 1e5, WINDOW_MS - 1].every(m => nodeAlpha(stable, at(m), win) === 1))
  check('a leaving node is still whole before its fade starts', nodeAlpha(going, win.endMs - FADE_OUT_MS - 1000, win) === 1)
  check('...is half gone halfway through it', Math.abs(nodeAlpha(going, win.endMs - FADE_OUT_MS / 2, win) - 0.5) < 1e-6)
  check('...and is gone exactly at the boundary', nodeAlpha(going, win.endMs, win) === 0)

  let monotonic = true
  for (let m = 0; m <= FADE_OUT_MS; m += 1000) {
    const a = nodeAlpha(going, win.endMs - FADE_OUT_MS + m, win)
    const b = nodeAlpha(going, win.endMs - FADE_OUT_MS + m + 1000, win)
    if (b > a) monotonic = false
  }
  check('...fading only ever goes one way', monotonic)

  check('an arriving node starts from nothing', nodeAlpha(coming, win.startMs, win) === 0)
  check('...and is whole once it has risen', nodeAlpha(coming, win.startMs + GROW_IN_MS, win) === 1)
  check('...and stays whole for the rest of the window', nodeAlpha(coming, win.endMs - 1, win) === 1)

  // A node can arrive AND leave in the same window — up for one window only. Both ends must work,
  // and the two bands must not overlap or the node would rise straight into its own fade.
  const brief: DealtNode = { ...stable, arriving: true, leaving: true }
  check('a one-window node rises and then goes out',
    nodeAlpha(brief, win.startMs, win) === 0 &&
    nodeAlpha(brief, win.startMs + GROW_IN_MS, win) === 1 &&
    nodeAlpha(brief, win.endMs, win) === 0)

  check('alpha never leaves 0..1', [-5e6, 0, 1e3, WINDOW_MS, WINDOW_MS * 2].every(m => {
    const a = nodeAlpha(going, at(m), win)
    return a >= 0 && a <= 1
  }))
}

console.log('\nthe clock the HUD reads')
{
  const t = WINDOW_MS * 3 + 5 * 60_000
  check('time-to-reset counts down inside the window', msUntilReset(t) === WINDOW_MS - 5 * 60_000)
  check('...and is never longer than a window', [0, 1, WINDOW_MS - 1, WINDOW_MS * 7 + 3].every(x => msUntilReset(x) > 0 && msUntilReset(x) <= WINDOW_MS))
  check('the window index advances once per window', currentWindow(t).index + 1 === currentWindow(t + WINDOW_MS).index)
  check('a window contains its own instant', currentWindow(t).startMs <= t && t < currentWindow(t).endMs)

  // ★ Regression guard for a bug only the browser could show. `?window=` pins which board is dealt;
  // the first cut also moved the window's start/end back to that index's own epoch, decades ago —
  // so the countdown sat on RENEWING forever and every leaving node was already at alpha 0, i.e.
  // invisible, in the exact mode built for looking at it. The pin must never move the clock.
  const pinned = windowAt(t, 1000)
  check('a pinned board deals the window it was told to', pinned.index === 1000)
  check('...but still sits inside the live window', pinned.startMs <= t && t < pinned.endMs)
  check('...so the countdown stays sane', pinned.endMs - t > 0 && pinned.endMs - t <= WINDOW_MS)
  check('...and a leaving node is not born already faded out',
    nodeAlpha({ leaving: true, arriving: false }, t, pinned) === 1)
  check('an unpinned window is just the live one', windowAt(t, null).index === currentWindow(t).index)
}

console.log('\nper-map spawn dials (ZoneSpawnConfig)')
{
  // A dial-less config must be BYTE-IDENTICAL to the legacy roll — the dials ship into a
  // live world, and "no dials set" silently changing any zone's board would be a regression
  // wearing a feature's name.
  const [zid, nodes] = WILD[0]
  for (let w = 0; w < 50; w++) {
    const a = dealZone(zid, nodes, w)
    const b = dealZone(zid, nodes, w, WORLD_SEED, undefined, {})
    if (JSON.stringify(a) !== JSON.stringify(b)) { check('empty config === legacy deal', false, `window ${w}`); break }
    if (w === 49) check('empty config === legacy deal (50 windows)', true)
  }

  // Abundance is LITERAL: the dialed number is the measured fill share, regardless of band
  // size — including a single-tier band, where the legacy fill is stuck at 40/60=67%.
  const oneTier = [{ type: 'goldwood' as const, tileX: 1, tileY: 1 }, { type: 'goldwood' as const, tileX: 5, tileY: 5 },
    { type: 'goldwood' as const, tileX: 9, tileY: 2 }, { type: 'goldwood' as const, tileX: 3, tileY: 8 }]
  for (const target of [0.3, 0.6, 0.9]) {
    let filled = 0, slots = 0
    for (let w = 0; w < 600; w++) {
      // raw fill, guarantee excluded: measure the ROLL by using a 2nd+ slot's presence
      const dealt = dealZone('dial-zone', oneTier, w, WORLD_SEED, undefined, { abundance: target })
      filled += dealt.length; slots += oneTier.length
    }
    const measured = filled / slots
    // entry guarantee props one slot up in empty windows, biasing small targets upward — allow for it
    check(`abundance ${target} measures ${measured.toFixed(2)}`, Math.abs(measured - target) < 0.08 + (target < 0.4 ? 0.06 : 0))
  }
  check('abundance is clamped, not trusted', bandFill(['goldwood'] as never, { abundance: 9 }) <= 1 && bandFill(['goldwood'] as never, { abundance: -1 }) > 0)

  // Richness tilts the dealt tiers monotonically; band membership and entry tier are untouched.
  const richZone = WILD.map(([z, ns]) => [z, ns] as const).find(([, ns]) => new Set(ns.map(n => skillOf(n.type))).size >= 1)!
  const meanTier = (r: number) => {
    let sum = 0, n = 0
    for (let w = 0; w < 300; w++) {
      for (const d of dealZone(richZone[0], richZone[1], w, WORLD_SEED, undefined, { richness: r })) {
        const band = zoneBand(richZone[1], skillOf(d.type))
        sum += band.indexOf(d.type as never); n++
      }
    }
    return sum / n
  }
  const lo = meanTier(0.5), mid = meanTier(1), hi = meanTier(2)
  check(`richness tilts tiers up (0.5:${lo.toFixed(2)} < 1:${mid.toFixed(2)} < 2:${hi.toFixed(2)})`, lo <= mid && mid < hi)
  check('richness 1 === legacy weights', JSON.stringify(bandWeights(['goldwood', 'shimmeroak'] as never)) === JSON.stringify(bandWeights(['goldwood', 'shimmeroak'] as never, { richness: 1 })))

  // Entry guarantee survives the stingiest dial: a level-1 player always has something to cash.
  let guaranteed = true
  for (let w = 0; w < 300 && guaranteed; w++) {
    const dealt = dealZone('dial-zone', oneTier, w, WORLD_SEED, undefined, { abundance: 0.05 })
    if (dealt.length === 0) guaranteed = false
  }
  check('entry guarantee holds at abundance 0.05', guaranteed)

  // Per-map cadence: default resets === the global window exactly (pins included elsewhere);
  // resets 4 halves the window and its boundaries nest inside the global ones.
  const t = 100 * WINDOW_MS + 12345
  check('zoneResets validates (3 → default)', zoneResets({ resets: 3 }) === RESETS_PER_DAY && zoneResets({ resets: 4 }) === 4)
  const g = currentWindow(t), z2 = zoneWindow(t, { resets: 2 }), z4 = zoneWindow(t, { resets: 4 })
  check('resets 2 === the global window', z2.index === g.index && z2.startMs === g.startMs && z2.endMs === g.endMs)
  check('resets 4 window is half as long', (z4.endMs - z4.startMs) * 2 === g.endMs - g.startMs)
  check('a 4x boundary nests in the 2x window', z4.startMs >= g.startMs && z4.endMs <= g.endMs)
  check('msUntilZoneReset agrees with the window', msUntilZoneReset(t, { resets: 4 }) === z4.endMs - t)
  // A map on 4x re-deals differently across a HALF-global window (that is the point of the dial).
  const w4a = zoneWindow(g.startMs + 1, { resets: 4 }).index
  const w4b = zoneWindow(g.startMs + WINDOW_MS / 2 + 1, { resets: 4 }).index
  check('4x turns over mid-global-window', w4b === w4a + 1)
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} failing`}\n`)
process.exit(failures === 0 ? 0 : 1)
