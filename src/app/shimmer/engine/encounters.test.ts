// ── Encounter tables — the world's shape, asserted ─────────────────────────────
// Run: npx tsx src/app/shimmer/engine/encounters.test.ts
//
// Areas carry ABSOLUTE level bands (Alex, 2026-07-23) instead of offsets from the player,
// and species are placed by their CANON element affinity. Both of those are the kind of
// data that rots silently: a band edited during a map pass, a species dropped into a table
// because it was handy. Neither shows up in a build error and neither shows up in play
// until someone walks into a Lv 19 spirit two minutes from the starting well. So they get
// a gate.

import { ENCOUNTER_TABLES, ZONE_ECOLOGY, SPECIES_AFFINITY, HOLD_LEVELS, rollEncounter } from './encounters'
import { LAUNCHED_SPECIES } from './spirit-index'
import { speciesDisplayName } from '../spirits/spirit'

const fails: string[] = []
const ok: string[] = []

// ── 1. Every table is well-formed and only ships launched species ──
for (const [zone, t] of Object.entries(ENCOUNTER_TABLES)) {
  const [lo, hi] = t.levels
  if (lo < 1 || hi < lo) fails.push(`${zone}: nonsense band [${lo}, ${hi}]`)
  if (t.rate > 0 && t.entries.length === 0) fails.push(`${zone}: rate ${t.rate} but nothing can spawn`)
  if (t.rate === 0 && t.entries.length > 0) fails.push(`${zone}: has entries but rate 0 — they can never appear`)
  for (const e of t.entries) {
    if (!LAUNCHED_SPECIES.includes(e.species)) fails.push(`${zone}: ${e.species} is not a launched species`)
    if (e.weight <= 0) fails.push(`${zone}: ${e.species} has weight ${e.weight} — it can never be drawn`)
    if (e.levels && (e.levels[0] < 1 || e.levels[1] < e.levels[0])) fails.push(`${zone}: ${e.species} override band is nonsense`)
  }
}

// ── 2. Ecology — a species may only appear where its canon affinity is supported ──
// This is the assert that catches "a Manalotl in a dry cavern".
for (const { zone, supports } of ZONE_ECOLOGY) {
  const t = ENCOUNTER_TABLES[zone]
  if (!t) { fails.push(`ZONE_ECOLOGY names '${zone}' but there is no encounter table for it`); continue }
  for (const e of t.entries) {
    const aff = SPECIES_AFFINITY[e.species]
    if (!supports.includes(aff)) {
      fails.push(`${zone}: ${speciesDisplayName(e.species)} is ${aff}-affinity, but the region only supports ${supports.join('/')}`)
    }
  }
}
// …and every zone that can spawn anything must declare its ecology, or the check above
// is trivially satisfiable by simply not listing a zone.
for (const [zone, t] of Object.entries(ENCOUNTER_TABLES)) {
  if (t.rate > 0 && !ZONE_ECOLOGY.some(z => z.zone === zone)) {
    fails.push(`${zone}: spawns wilds but declares no ZONE_ECOLOGY — it is exempt from the ecology check`)
  }
}

// ── 3. The curve rises. Progression order is ZONE_ECOLOGY's order. ──
let prevLo = 0, prevZone = ''
for (const { zone } of ZONE_ECOLOGY) {
  const t = ENCOUNTER_TABLES[zone]
  if (!t) continue
  if (t.levels[0] < prevLo) {
    fails.push(`progression dips: ${zone} starts at Lv ${t.levels[0]} but ${prevZone} already started at ${prevLo}`)
  }
  prevLo = t.levels[0]; prevZone = zone
}

// ── 4. Alex's pinned numbers (2026-07-23). These are HIS calls — a later tuning pass
//     that quietly moves them should have to delete an assertion to do it. ──
const pinned: [string, [number, number]][] = [
  ['route-moonwell-garden', [3, 5]],   // Moonwell Pass
  ['spirit-meadow', [7, 8]],           // Spirit Meadows
]
for (const [zone, want] of pinned) {
  const got = ENCOUNTER_TABLES[zone]?.levels
  if (!got || got[0] !== want[0] || got[1] !== want[1]) {
    fails.push(`${zone}: band is [${got}] but Alex pinned [${want}]`)
  }
}
if (HOLD_LEVELS.thistle !== 7) fails.push(`Thistle is Lv ${HOLD_LEVELS.thistle}, Alex pinned 7`)
if (HOLD_LEVELS.sorrel.guard !== 7 || HOLD_LEVELS.sorrel.captive !== 6) {
  fails.push(`Sorrel is ${HOLD_LEVELS.sorrel.captive}/${HOLD_LEVELS.sorrel.guard}/${HOLD_LEVELS.sorrel.captive}, Alex pinned 6/7/6`)
}

// ── 5. A boss is its region's gatekeeper, not a spike — at or under the local band. ──
const bossIn: [string, number, string][] = [
  ['spirit-meadow', HOLD_LEVELS.thistle, 'Thistle'],
  ['sorrel-hold', HOLD_LEVELS.sorrel.guard, "Sorrel's guard"],
  ['brack-hold', HOLD_LEVELS.brack.muscle, "Brack's muscle"],
]
for (const [zone, lv, who] of bossIn) {
  const band = ENCOUNTER_TABLES[zone]?.levels
  if (band && lv > band[1]) fails.push(`${who} (Lv ${lv}) is above ${zone}'s wild band [${band[0]}-${band[1]}] — that is a spike, not a gatekeeper`)
}

// ── 6. rollEncounter actually honours the band, and does NOT take the player's level ──
if (rollEncounter.length > 3) fails.push('rollEncounter still takes a player-level argument — bands must be absolute')
for (const [zone, t] of Object.entries(ENCOUNTER_TABLES)) {
  if (t.rate === 0) continue
  const seen = new Set<string>()
  let outOfBand = 0
  for (let i = 0; i < 400; i++) {
    const enc = rollEncounter(zone, false, true)   // force = skip the rate roll
    if (!enc) continue
    seen.add(enc.species)
    const entry = t.entries.find(e => e.species === enc.species)!
    const [lo, hi] = entry.levels ?? t.levels
    if (enc.level < lo || enc.level > hi) outOfBand++
  }
  if (outOfBand > 0) fails.push(`${zone}: ${outOfBand}/400 rolls landed outside the band`)
  const spawnable = t.entries.filter(e => LAUNCHED_SPECIES.includes(e.species))
  if (seen.size < spawnable.length) {
    fails.push(`${zone}: only ${seen.size}/${spawnable.length} species ever appeared in 400 rolls`)
  }
}

// ── report ──
console.log('=== ENCOUNTER TABLES — the world, by level ===\n')
console.log('  ' + 'AREA'.padEnd(26) + 'BAND'.padEnd(9) + 'RATE   WHO LIVES THERE')
for (const { zone } of ZONE_ECOLOGY) {
  const t = ENCOUNTER_TABLES[zone]
  if (!t) continue
  const who = t.entries.map(e => `${speciesDisplayName(e.species)}${e.levels ? `(${e.levels[0]}-${e.levels[1]})` : ''}`).join(', ')
  console.log(`  ${zone.padEnd(26)}${`${t.levels[0]}-${t.levels[1]}`.padEnd(9)}${String(t.rate).padEnd(7)}${who}`)
}
console.log(`\n  holds: Thistle Lv ${HOLD_LEVELS.thistle} · Sorrel ${HOLD_LEVELS.sorrel.captive}/${HOLD_LEVELS.sorrel.guard}/${HOLD_LEVELS.sorrel.captive} · Brack ${HOLD_LEVELS.brack.muscle}/${HOLD_LEVELS.brack.enforcer} + 3× Lv ${HOLD_LEVELS.brack.captive}\n`)

if (fails.length) { console.error('❌ ENCOUNTER ORACLE FAILED:\n  - ' + fails.join('\n  - ')); process.exit(1) }
console.log(`✅ encounter oracle: bands absolute and rising, ecology matches canon affinity, Alex's pins intact.${ok.length ? '' : ''}`)
