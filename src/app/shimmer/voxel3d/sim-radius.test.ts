// Sim/render split oracle (#1113). Run: npx tsx src/app/shimmer/voxel3d/sim-radius.test.ts
//
// The claim: the night is ticked to `simRadius`, drawn to `viewRadius`, and the first can never
// exceed the second. Three consumers must all read the SIM number (the Hollow cap, the spawn ring's
// far edge / despawn line, the patrol despawn) and two must still read the VIEW number (the column
// loader and the eviction ring) — a split that moved the loader would load less world, not tick less.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { simRadiusOf, simColumns, SIM_RADIUS_MIN, VIEW_RADIUS_MIN, VIEW_RADIUS_MAX, DEFAULT_SETTINGS } from './settings'
import { hollowCap, PLAYER_EXCLUSION } from './hollows'
import { SECTION } from '../voxel/column'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── the pure half ────────────────────────────────────────────────────────────────────────────
{
  ok(DEFAULT_SETTINGS.simRadius === DEFAULT_SETTINGS.viewRadius && DEFAULT_SETTINGS.simRadius === 6,
     '★ the default sim radius IS the old baseline (6) — a keeper who never opens settings gets the night they had')
  ok(simRadiusOf({ simRadius: 6, viewRadius: 4 }) === 4, '★★ sim is clamped to the view: a body cannot stand on unloaded ground')
  ok(simRadiusOf({ simRadius: 4, viewRadius: 12 }) === 4, 'a wider view does not widen the sim')
  ok(simRadiusOf({ simRadius: 1, viewRadius: 12 }) === SIM_RADIUS_MIN, 'the sim never drops below its floor')
  ok(SIM_RADIUS_MIN * SECTION > PLAYER_EXCLUSION, `★ at the sim floor the spawn ring still exists (${SIM_RADIUS_MIN * SECTION} > exclusion ${PLAYER_EXCLUSION})`)
  ok(SIM_RADIUS_MIN >= VIEW_RADIUS_MIN && SIM_RADIUS_MIN <= VIEW_RADIUS_MAX, 'the sim floor sits inside the view range')
  // The cap follows the sim disc, and at the default it is the number the old full load gave.
  ok(simColumns(6) === 113, `a r=6 disc is 113 columns (${simColumns(6)}) — the number hollows.test pins as "a full load radius"`)
  ok(hollowCap(simColumns(6)) === hollowCap(113), '★ the default cap is unchanged by the split')
  ok(hollowCap(simColumns(4)) < hollowCap(simColumns(6)), `a r=4 night carries fewer bodies (${hollowCap(simColumns(4))} < ${hollowCap(simColumns(6))})`)
  ok(hollowCap(simColumns(12)) === hollowCap(simColumns(6)) || hollowCap(simColumns(12)) === 12,
     'a r=12 sim hits the same horde ceiling — the split does not open a bigger night than before')
}

// ── the wiring ───────────────────────────────────────────────────────────────────────────────
{
  const src = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
  ok(/const simR = simRadiusOf\(settings\)\n\s*const cap = hollowCap\(Math\.min\(cols\.current\.size, simColumns\(simR\)\)\)/.test(src),
     '★★ the Hollow cap is fed the SIM disc (bounded by what is loaded), not the loaded column count')
  ok(/const despawn = simR \* SECTION/.test(src), '★★ the spawn ring\'s far edge / despawn line is the SIM edge')
  ok(!/const despawn = settings\.viewRadius \* SECTION/.test(src), 'and no longer the view edge')
  ok(/> simRadiusOf\(settings\) \* SECTION\) \{\n\s*dropFoe\(i\)/.test(src), '★ a patrol despawns at the SIM edge too')
  ok(!/> settings\.viewRadius \* SECTION\) \{\n\s*dropFoe/.test(src), 'and not at the view edge')
  // What must NOT have moved: the loader and the eviction still draw to the VIEW radius.
  const loaderR = (src.match(/const R = settings\.viewRadius/g) ?? []).length
  ok(loaderR === 2, `★★ the column loader and the eviction ring still read the VIEW radius (${loaderR} of 2) — the split ticks less, it must not load less`)
  ok(/value=\{s\.simRadius\}/.test(src) && /\{simRadiusOf\(s\) \* 16\} blk/.test(src), 'the O panel has the dial and its label shows the EFFECTIVE (clamped) value')
  ok(/simBlocks: simRadiusOf\(settings\) \* SECTION, viewBlocks: settings\.viewRadius \* SECTION/.test(src), '/hostiles prints the ring it actually spawns in')
}

console.log(fails.length ? `❌ sim-radius: ${pass} pass, ${fails.length} fail\n  - ${fails.join('\n  - ')}` : `✅ sim-radius: ${pass} pass, 0 fail`)
if (fails.length) process.exit(1)
