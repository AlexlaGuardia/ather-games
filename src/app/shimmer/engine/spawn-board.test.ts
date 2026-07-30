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
  dealZone, currentWindow, windowAt, nodeAlpha, tileKey, msUntilReset, entryLocations,
  WINDOW_MS, FADE_OUT_MS, GROW_IN_MS, RESETS_PER_DAY, WORLD_SEED, isBoardPinned,
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

  // A location that never comes up is an authored placement pretending to be a possibility. One
  // that ALWAYS comes up is the same thing, unless it is the zone's only entry-tier node for its
  // skill — in which case the guarantee is holding it up on purpose, every window, by design.
  const stuck: string[] = []
  for (const [zoneId, placements] of WILD) {
    const entry = entryLocations(placements)
    for (const p of placements) {
      let hits = 0
      for (let w = 0; w < WINDOWS; w++) {
        if (dealZone(zoneId, placements, w).some(n => tileKey(n) === tileKey(p))) hits++
      }
      const rate = hits / WINDOWS
      const soleEntry = entry.length === 1 && tileKey(entry[0]) === tileKey(p)
      const pinnedBySkill = entry.some(e => tileKey(e) === tileKey(p)) &&
        entry.filter(e => NODE_DEFS[e.type].skill === NODE_DEFS[p.type].skill).length === 1
      if (rate === 0) stuck.push(`${zoneId} ${tileKey(p)} never spawns`)
      else if (rate === 1 && !soleEntry && !pinnedBySkill) stuck.push(`${zoneId} ${tileKey(p)} always spawns`)
    }
  }
  check('no location is stuck, unless the guarantee is holding it up', stuck.length === 0, stuck.slice(0, 4).join(', '))

  // The roll should track the configured chance. Guarantees push the observed rate UP (never down),
  // so this is a floor-and-ceiling check rather than an equality.
  const [zoneId, placements] = WILD.find(([, ns]) => ns.length >= 8)!
  for (const p of placements.slice(0, 3)) {
    let hits = 0
    for (let w = 0; w < WINDOWS; w++) if (dealZone(zoneId, placements, w).some(n => tileKey(n) === tileKey(p))) hits++
    const rate = hits / WINDOWS
    check(`${p.type} spawns at a plausible rate`, rate > 0.25 && rate < 0.98, rate.toFixed(2))
  }
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
  const stable: DealtNode = { type: 'goldwood', tileX: 1, tileY: 1, leaving: false, arriving: false }
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
    nodeAlpha({ type: 'goldwood', tileX: 1, tileY: 1, leaving: true, arriving: false }, t, pinned) === 1)
  check('an unpinned window is just the live one', windowAt(t, null).index === currentWindow(t).index)
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} failing`}\n`)
process.exit(failures === 0 ? 0 : 1)
