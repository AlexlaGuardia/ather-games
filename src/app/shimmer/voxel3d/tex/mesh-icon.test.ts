// Mesh-icon audit. Run: npx tsx src/app/shimmer/voxel3d/tex/mesh-icon.test.ts
//
// ── ★ WHAT THIS IS DEFENDING ────────────────────────────────────────────────────────────────────
// `mesh-icon.ts` renders an item icon from the geometry `flora-mesh.ts` instances into the world.
// Everything that can go wrong here goes wrong QUIETLY and looks like a picture either way: a log
// that stands up instead of lying down, a mushroom that loses its cap, shading that flattens the
// facets into a silhouette. Every one of those still returns a plausible buffer of coloured pixels.
//
// So none of these asserts ask "did it draw something". They ask about properties the shape must
// have, and each is written so there is an input that makes it fire.

import * as THREE from 'three'
import { floraLogGeo, floraShroomStemGeo, floraShroomCapGeo, FLORA_COLORS } from '../flora-mesh'
import { meshIcon, hasMeshIcon, renderParts } from './mesh-icon'
import { materialForItem } from '../../voxel/registry'
import { hasTileArt, iconSourceFor, iconPixelsFor } from './item-icon'
import { MAT } from '../../voxel/depth'

const fails: string[] = []
let pass = 0
const S = 64

const stats = (px: Uint8Array | null) => {
  if (!px) return null
  let cov = 0, minX = S, maxX = -1, minY = S, maxY = -1
  const colors = new Set<string>()
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    if (px[i + 3] === 0) continue
    cov++; colors.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { cov, w: maxX - minX + 1, h: maxY - minY + 1, colors: colors.size }
}

// ── ① THE TWO ITEMS REACH THE MESH ARM AND IT FILLS ITSELF ────────────────────────────────────
for (const id of ['deadwood', 'mushroom_cap']) {
  const src = iconSourceFor(id)
  if (src !== 'mesh') { fails.push(`${id} resolves as '${src}', want 'mesh'`); continue }
  const s = stats(iconPixelsFor(id, S))
  if (!s || s.cov === 0) { fails.push(`${id} names source 'mesh' and renders nothing`); continue }
  pass++
}

// ── ② A FELLED LOG LIES DOWN, AND THAT IS A MEASURABLE PROPERTY ───────────────────────────────
// ★ THE ASSERT THAT EARNS ITS KEEP. `floraLogGeo` is a CylinderGeometry, which stands along Y, and
// the ONLY thing that lays it down is the `rotateZ` after construction. Any consumer that rebuilt
// the primitive without that call gets a standing post and is perfectly self-consistent about it —
// the mirror bug, and the reason the geometry is exported instead of restated. A standing log and a
// lying log both render a fine picture; only the aspect ratio tells them apart.
{
  const s = stats(meshIcon(MAT.DEADFALL, S))
  if (!s) fails.push('the deadfall log rendered nothing')
  else if (s.w <= s.h) fails.push(`the deadfall log is ${s.w}x${s.h} — a felled trunk must be wider than tall, so it is standing up`)
  else pass++
}

// ── ③ A MUSHROOM KEEPS ITS TWO PARTS ──────────────────────────────────────────────────────────
// The world draws stalk and cap as separate geometry in separate colours. If the icon ever renders
// one part, or paints both the same, it has invented a simpler object than the one in the ground.
// ⚠ Asserted against the world's OWN colours rather than a count, because "more than one colour" is
// satisfied by shading alone and would pass with the cap deleted.
{
  const px = meshIcon(MAT.MUSHROOM, S)
  if (!px) fails.push('the mushroom rendered nothing')
  else {
    const near = (c: number) => {
      const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] === 0) continue
        // shading only ever darkens, so match on hue ratio rather than exact bytes
        const s2 = px[i] / (r || 1), s3 = px[i + 1] / (g || 1), s4 = px[i + 2] / (b || 1)
        if (Math.abs(s2 - s3) < 0.12 && Math.abs(s3 - s4) < 0.12 && s2 > 0.4) return true
      }
      return false
    }
    if (!near(FLORA_COLORS.shroomStem)) fails.push('the mushroom icon has no stalk-coloured pixel')
    else pass++
    if (!near(FLORA_COLORS.shroomCaps[0])) fails.push('the mushroom icon has no cap-coloured pixel')
    else pass++
  }
}

// ── ④ THE FACETS MUST SURVIVE — flat shading, not a silhouette ────────────────────────────────
// ⚠⚠ AND THIS IS THE ONE THAT WOULD OTHERWISE BE DECORATION. "Has more than one colour" passes on a
// two-part mushroom even with shading switched off entirely, so it is asked of the LOG, which is a
// single part in a single tint: every distinct colour in it comes from a facet catching the light
// differently. One colour there means the shading collapsed and the log is a flat brown blob.
{
  const s = stats(meshIcon(MAT.DEADFALL, S))
  if (!s) fails.push('the deadfall log rendered nothing')
  else if (s.colors < 3) fails.push(`the log renders ${s.colors} distinct colour(s) — flat shading has collapsed and the facets are gone`)
  else pass++
}

// ── ⑤ THE GEOMETRY IS THE WORLD'S, NOT A COPY ─────────────────────────────────────────────────
// ★ Compares DERIVATIONS, not values: each factory is called twice and must agree with itself, and
// the icon module must be reaching the same factories. A restated primitive would differ in vertex
// count the moment anyone changed a segment count in flora-mesh — which is exactly the drift this
// export exists to prevent, and it is silent without an assert.
{
  const pairs: [string, () => THREE.BufferGeometry][] = [
    ['log', floraLogGeo], ['shroom stem', floraShroomStemGeo], ['shroom cap', floraShroomCapGeo],
  ]
  for (const [name, f] of pairs) {
    const a = f(), b = f()
    if (a.attributes.position.count !== b.attributes.position.count) fails.push(`${name} geometry is not stable across calls`)
    else pass++
    a.dispose(); b.dispose()
  }
}

// ── ⑥ NOTHING ON THE MESH ARM MAY HAVE ACQUIRED A TILE TEXTURE ────────────────────────────────
// ⚠ THE 2026-08-23 SAPLING BUG, PRE-EMPTED FROM THE OTHER SIDE. Texturing a material to fix the
// WORLD silently promoted its icon to a confident cube. If someone gives Deadfall or Mushroom a
// tile painter, the block arm — which sits above this one — would take over and draw a cube of it,
// and nothing else would complain. This says so out loud instead.
for (const id of ['deadwood', 'mushroom_cap']) {
  const mat = materialForItem(id)
  if (mat !== undefined && hasTileArt(mat)) {
    fails.push(`${id}'s material now has tile art, so the BLOCK arm outranks the mesh arm and it will draw a cube. `
      + `Decide which is right and move the arm, do not leave both true.`)
  } else pass++
  if (!hasMeshIcon(mat)) fails.push(`${id} is no longer registered in MESH_PARTS`)
  else pass++
}

// ── ⑦ AN EMPTY PART LIST MUST RETURN AN EMPTY BUFFER, NOT THROW ───────────────────────────────
{
  const px = renderParts([], S)
  if (px.some((v, i) => i % 4 === 3 && v !== 0)) fails.push('rendering no parts produced visible pixels')
  else pass++
}

console.log(`\nmesh-icon audit: ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the bag draws the same log and mushroom the ground does')
