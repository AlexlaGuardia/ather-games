// Creature-atlas oracle. Run: npx tsx src/app/shimmer/voxel3d/creature-atlas.test.ts
//
// The last block is the one that matters: it builds a sheet from the REAL painted rabbit and asserts
// the sheet is not blank. Every arithmetic assert above it would pass just as happily on an all-
// transparent atlas, which is the empty-measurement-window trap this repo keeps re-learning.

import { facingFor, buildCreatureAtlas, frameAt, animFor, animKey, DIRS, POSES, type CreatureArt, type Dir } from './creature-atlas'
import { PALETTES } from '../sprites/palette'
import { RABBIT_SPRITES } from '../sprites/rabbit'
import { OWL_SPRITES } from '../sprites/owl'
import { FROG_SPRITES } from '../sprites/frog'
import { AXOLOTL_SPRITES } from '../sprites/axolotl'
import { TURTLE_SPRITES } from '../sprites/turtle'
import { WATER_BEAR_SPRITES } from '../sprites/water-bear'
import { FOX_SPRITES } from '../sprites/fox'
import { BAT_SPRITES } from '../sprites/bat'
import { FIREFLY_SPRITES } from '../sprites/firefly'
import { HUMMINGBIRD_SPRITES } from '../sprites/hummingbird'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const P2 = Math.PI * 2

const frame = (v: number, n = 32) => { const a = new Uint8Array(n * n); a.fill(v); return a }
// Build a fixture keyed the way the shipped files are keyed: `${dir}_${pose}`.
const art = (keys: Record<string, number[]>, palette = ['#ff0000', '#00ff00']): CreatureArt => ({
  anims: Object.fromEntries(Object.entries(keys).map(([k, fs]) =>
    [k, { frames: fs.map(v => frame(v)), rate: 4 }])),
  palette,
})

// ── 1. facingFor: the four sectors, from the viewer's side ───────────────────────────────────────
{
  // Body facing +x (yaw 0). Viewer directly in front (same direction from body) sees its face.
  ok(facingFor(0, 0).dir === 'down', 'viewer in front of a body must see its FACE (down)')
  ok(facingFor(0, Math.PI).dir === 'up', 'viewer behind a body must see its BACK (up)')
  const a = facingFor(0, Math.PI / 2), b = facingFor(0, -Math.PI / 2)
  ok(a.dir === 'right' && b.dir === 'right', 'both flanks use the painted profile')
  ok(a.mirror !== b.mirror, '★ the two flanks must not be the SAME image — one is mirrored')
}

// ── 2. ★ ONLY THE DIFFERENCE MATTERS — rotate both and nothing may change ────────────────────────
// The cheapest wrong implementation reads bodyYaw alone (or viewerYaw alone) and looks fine in a
// screenshot taken from world origin. This is what refuses it.
{
  let stable = true
  for (let i = 0; i < 64; i++) {
    const spin = (i / 64) * P2
    const base = facingFor(0, Math.PI / 3)
    const spun = facingFor(0 + spin, Math.PI / 3 + spin)
    if (base.dir !== spun.dir || base.mirror !== spun.mirror) stable = false
  }
  ok(stable, 'facingFor is not a pure function of (viewer - body) — rotating both changed the answer')
}

// ── 3. Every sector is reachable, and the sweep is total ─────────────────────────────────────────
{
  const seen = new Map<string, number>()
  for (let i = 0; i < 720; i++) {
    const f = facingFor(0, (i / 720) * P2)
    const k = `${f.dir}${f.mirror ? '-m' : ''}`
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  ok(seen.size === 4, `expected 4 distinct facings around a full turn, got ${seen.size} (${[...seen.keys()].join(',')})`)
  // Each quadrant is a quarter turn, so each should claim ~180 of 720. Loose bound: no sector may
  // collapse or swallow the circle — that is the shape of an off-by-one in the boundaries.
  for (const [k, n] of seen) ok(n > 120 && n < 240, `sector ${k} claims ${n}/720 — the boundaries are lopsided`)
  ok(seen.size > 0, 'sweep produced nothing')
}

// ── 4. Angles far outside [-PI,PI] still answer ──────────────────────────────────────────────────
{
  ok(facingFor(0, P2 * 5).dir === 'down', 'a viewer angle wound 5 turns must normalise')
  ok(facingFor(0, -P2 * 3 + Math.PI).dir === 'up', 'a negative wound angle must normalise')
}

// ── 5. Atlas layout: a row per DIR, in DIRS order, whatever is missing ───────────────────────────
{
  const a = buildCreatureAtlas(art({ down_idle: [1, 2, 1], right_walk: [2] }), 8)
  const SLOTS = DIRS.length * POSES.length
  ok(a.rows === SLOTS, `one row per dir x pose slot (${SLOTS}), got ${a.rows}`)
  ok(a.cols === 3, `cols should follow the longest anim (3), got ${a.cols}`)
  ok(a.width === 3 * 8 && a.height === SLOTS * 8, 'atlas dimensions do not follow cols/rows')
  ok(a.pixels.length === a.width * a.height * 4, 'pixel buffer is the wrong size')
  // ★ right_walk must sit on ITS fixed row, not slide up because earlier slots resolved to less.
  const want = (DIRS.indexOf('right') * POSES.length + POSES.indexOf('walk')) * 8
  // ⚠ NO `!` HERE. A non-null assertion THROWS when the lookup misses, and a throw is neither a pass
  // nor a fail — it buries every assert below it and reads as broken test code rather than a finding.
  // (PATTERNS 2026-08-22, instance 1. Caught re-committing it while mutation-testing this very file.)
  const r = a.cells.find(c => c.dir === 'right' && c.pose === 'walk')
  ok(!!r, 'right_walk produced NO cell — the key contract resolved nothing for a painted fixture')
  ok(!r || r.y === want, `right_walk landed at y=${r?.y}, expected ${want} — an unfilled slot shifted a later row`)
  ok(a.index('right', 'walk', 0) >= 0, 'index() cannot find what was painted')
}

// ── 6. frameAt: durations, rate, and the unpainted fallback ──────────────────────────────────────
{
  const a = art({ down_walk: [1, 2, 1, 2], down_idle: [1], idle: [2] })
  const seen = new Set<number>()
  for (let t = 0; t < 5000; t += 13) seen.add(frameAt(a, 'down', 'walk', t).frame)
  ok(seen.size === 4, `a 4-frame anim should show all 4 over time, showed ${seen.size}`)
  ok([...seen].every(f => f >= 0 && f < 4), 'frameAt returned a frame outside the anim')
  // ★ The fallback chain, asserted in order rather than described in a comment.
  ok(animFor(a, 'up', 'walk') === a.anims['idle'], 'a missing dir+pose must fall back through `idle`')
  ok(animFor(a, 'down', 'walk') === a.anims['down_walk'], 'an exact key must win over any fallback')
  ok(animFor(art({ down_idle: [1] }), 'down', 'walk') !== null, 'dir_idle must answer when dir_walk is absent')
  ok(frameAt(art({ down_idle: [1] }), 'down', 'idle', -99999).frame === 0, 'a 1-frame anim must always be frame 0')
}

// ── 7. ★★ THE REAL ART — can the instrument see its subject? ─────────────────────────────────────
// Everything above passes on an all-transparent atlas. This is the block that would notice.
{
  const rabbit: CreatureArt = { anims: RABBIT_SPRITES, palette: PALETTES.rabbit.base }
  const a = buildCreatureAtlas(rabbit, 32)
  let opaque = 0
  for (let i = 3; i < a.pixels.length; i += 4) if (a.pixels[i] === 255) opaque++
  const total = a.width * a.height
  ok(a.cells.length > 0, 'the real rabbit produced NO cells — the art is not where this thinks it is')
  ok(opaque > 0, '★ the rabbit atlas is entirely transparent — palette or frame wiring is wrong')
  ok(opaque < total, 'the rabbit atlas is entirely OPAQUE — transparency (index 0) is not being honoured')
  // A creature should cover a real fraction of its cell, or the palette mapped almost everything to
  // a colour that does not exist (the silent-hole failure `flatIconPixels` warns about).
  const cover = opaque / (a.cells.length * 32 * 32)
  ok(cover > 0.05, `rabbit covers only ${(cover * 100).toFixed(1)}% of its cells — most pixels resolved to no colour`)
  console.log(`   real art · rabbit ${a.cols} frames x ${a.rows} slots, ${a.width}x${a.height}px, ${(cover * 100).toFixed(1)}% covered`)
}

// ── 8. ★★★ ALL TEN ROSTER SPECIES HONOUR THE KEY CONTRACT ────────────────────────────────────────
// This is the guard for the bug that actually happened while writing this module: the first version
// looked for `down` and every atlas came back empty and SILENT. One species quietly dropping
// `deriveSprites` would do the same thing to one animal, and nothing on screen says "wrong key" —
// it says "no creature", which reads as an encounter bug.
{
  const TEN: [string, Record<string, any>, string][] = [
    ['rabbit', RABBIT_SPRITES, 'rabbit'], ['owl', OWL_SPRITES, 'owl'], ['frog', FROG_SPRITES, 'frog'],
    ['axolotl', AXOLOTL_SPRITES, 'axolotl'], ['turtle', TURTLE_SPRITES, 'turtle'],
    ['water-bear', WATER_BEAR_SPRITES, 'water-bear'], ['fox', FOX_SPRITES, 'fox'],
    ['bat', BAT_SPRITES, 'bat'], ['firefly', FIREFLY_SPRITES, 'firefly'],
    ['hummingbird', HUMMINGBIRD_SPRITES, 'hummingbird'],
  ]
  const thin: string[] = []
  for (const [name, anims, palKey] of TEN) {
    const missing = DIRS.flatMap(d => POSES.map(p => animKey(d, p))).filter(k => !anims[k]?.frames?.length)
    ok(missing.length === 0, `${name} is missing painted keys: ${missing.join(', ')} — it may not use deriveSprites`)
    const pal = (PALETTES as any)[palKey]?.base
    ok(Array.isArray(pal) && pal.length > 0, `${name}: no palette under PALETTES.${palKey}`)
    if (!pal) continue
    const at = buildCreatureAtlas({ anims, palette: pal }, 32)
    let op = 0
    for (let i = 3; i < at.pixels.length; i += 4) if (at.pixels[i] === 255) op++
    const cov = op / Math.max(1, at.cells.length * 32 * 32)
    ok(cov > 0.03, `${name} atlas is ${(cov * 100).toFixed(1)}% covered — effectively blank`)
    if (cov < 0.10) thin.push(`${name} ${(cov * 100).toFixed(1)}%`)
  }
  console.log(`   ten species · all keyed \`\${dir}_\${pose}\`${thin.length ? ` · thin: ${thin.join(', ')}` : ''}`)
}

if (fails.length) { console.error(`❌ ${fails.length} failed:`); for (const f of fails) console.error('   · ' + f); process.exit(1) }
console.log(`✅ the painted spirits, laid out to face you — ${pass} passed`)
