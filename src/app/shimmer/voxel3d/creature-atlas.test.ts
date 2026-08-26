// Creature-atlas oracle. Run: npx tsx src/app/shimmer/voxel3d/creature-atlas.test.ts
//
// The last block is the one that matters: it builds a sheet from the REAL painted rabbit and asserts
// the sheet is not blank. Every arithmetic assert above it would pass just as happily on an all-
// transparent atlas, which is the empty-measurement-window trap this repo keeps re-learning.

import { facingFor, buildCreatureAtlas, frameAt, animFor, animKey, cellUV, DIRS, POSES, type CreatureArt, type Dir } from './creature-atlas'
import { SPECIES_ART, SPECIES_IDS, speciesArt } from '../sprites/registry'

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
  const r = speciesArt('rabbit')
  ok(!!r, 'the registry has no rabbit — the real-art block below cannot see its subject')
  const rabbit: CreatureArt = { anims: r?.anims ?? {}, palette: r?.palette ?? [] }
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

// ── 8. ★★★ EVERY REGISTERED SPECIES HONOURS THE KEY CONTRACT ────────────────────────────────────
// This is the guard for the bug that actually happened while writing this module: the first version
// looked for a bare `down` and every atlas came back empty and SILENT. One species quietly dropping
// `deriveSprites` would do the same thing to one animal, and nothing on screen says "wrong key" —
// it says "no creature", which reads as an encounter bug.
//
// ★ DRIVEN BY `sprites/registry.ts`, NOT BY A LIST HERE. This file used to import all ten species and
// build its own map — the fifth copy of a map four other files already kept by hand. The registry's
// own oracle proves the map covers every painted species; this one proves each entry DRAWS. Two
// questions, two files, neither restating the other.
{
  const thin: string[] = []
  ok(SPECIES_IDS.length > 0, 'the registry is empty — this block cannot fail, so it proves nothing')
  for (const id of SPECIES_IDS) {
    const art = speciesArt(id)
    ok(!!art, `${id}: registered but speciesArt returned null`)
    if (!art) continue
    const missing = DIRS.flatMap(d => POSES.map(p => animKey(d, p))).filter(k => !art.anims[k]?.frames?.length)
    ok(missing.length === 0, `${id} is missing painted keys: ${missing.join(', ')} — it may not use deriveSprites`)
    ok(art.palette.length > 0, `${id}: no palette`)
    const at = buildCreatureAtlas({ anims: art.anims, palette: art.palette }, 32)
    let op = 0
    for (let i = 3; i < at.pixels.length; i += 4) if (at.pixels[i] === 255) op++
    const cov = op / Math.max(1, at.cells.length * 32 * 32)
    ok(cov > 0.03, `${id} atlas is ${(cov * 100).toFixed(1)}% covered — effectively blank`)
    if (cov < 0.10) thin.push(`${id} ${(cov * 100).toFixed(1)}%`)
  }
  console.log(`   ${SPECIES_IDS.length} registered species · all keyed dir_pose${thin.length ? ` · thin: ${thin.join(', ')}` : ''}`)
}

// ── 9. cellUV — the arithmetic the wrapper trusts blindly ────────────────────────────────────────
{
  const a = buildCreatureAtlas(art({ down_idle: [1, 2], right_walk: [1, 2] }), 8)
  const u = cellUV(a, 'down', 'idle', 1, false)
  ok(!!u, 'cellUV found no cell for a painted frame')
  if (u) {
    ok(Math.abs(u.repeatX - 1 / a.cols) < 1e-9 && Math.abs(u.repeatY - 1 / a.rows) < 1e-9, 'repeat must be exactly one cell')
    ok(Math.abs(u.offsetX - 1 / a.cols) < 1e-9, 'frame 1 should sit one column in')
    ok(u.offsetY === 0, 'down_idle is the first slot, so offsetY must be 0 (flipY=false, row 0 on top)')
  }
  // ★ A mirrored cell must cover the SAME span, walked backwards — not a shifted window.
  const m = cellUV(a, 'down', 'idle', 1, true)
  ok(!!m, 'cellUV refused a mirrored lookup')
  if (u && m) {
    ok(m.repeatX === -u.repeatX, 'mirror must negate repeatX')
    ok(Math.abs((m.offsetX + m.repeatX) - u.offsetX) < 1e-9, 'a mirrored cell must land on the same left edge')
    ok(m.offsetY === u.offsetY && m.repeatY === u.repeatY, 'mirroring must not touch the vertical')
  }
  // Every painted cell must stay inside [0,1] in both directions, mirrored or not.
  let outside: string | null = null
  for (const c of a.cells) for (const mir of [false, true]) {
    const v = cellUV(a, c.dir, c.pose, c.frame, mir)
    if (!v) { outside = `${c.dir}/${c.pose}/${c.frame} has no UV`; continue }
    const l = Math.min(v.offsetX, v.offsetX + v.repeatX), r = Math.max(v.offsetX, v.offsetX + v.repeatX)
    if (l < -1e-9 || r > 1 + 1e-9 || v.offsetY < -1e-9 || v.offsetY + v.repeatY > 1 + 1e-9)
      outside = `${c.dir}/${c.pose}/${c.frame}${mir ? ' mirrored' : ''} spills outside [0,1]`
  }
  ok(outside === null, `cellUV out of range: ${outside}`)
  ok(cellUV(a, 'up', 'walk', 0, false) === null, 'cellUV must return null for a slot with no cells')
}

if (fails.length) { console.error(`❌ ${fails.length} failed:`); for (const f of fails) console.error('   · ' + f); process.exit(1) }
console.log(`✅ the painted spirits, laid out to face you — ${pass} passed`)
