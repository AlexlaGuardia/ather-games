// The tile paint off the main thread (2026-09-17). Run: npx tsx src/app/shimmer/voxel3d/tex/tile-worker.test.ts
//
// ★ WHY: the placeholder is what every player sees for the first second of every load, and it is
// built by a mapping (layer → material) that nothing else exercises; a slot off by one paints the
// meadow the colour of deep stone for a second on every boot and nobody files that. And the
// worker's whole failure mode is SILENCE — a bad hash constructs a Worker that never replies — so
// the fallback and its timeout are pinned as text, and the artifact the URL module names must exist.
import fs from 'node:fs'
import { materialOfLayer, buildPlaceholderArray, TILE_MATERIALS, VARIANT_MATERIALS, VARIANTS_PER, FALLBACK_LAYER, VARIANT_BASE, LAYER_COUNT, layerOf, variantLayerOf, TOP, SIDE, BOTTOM } from './tiles'
import { flatReliefArray } from './relief'
import { MATERIAL_COLOR } from '../attrs'
import { MAT } from '../../voxel/depth'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. layer → material, across all three regions of the array ────────────────────────────────
for (const m of TILE_MATERIALS) for (const f of [TOP, SIDE, BOTTOM]) ok(materialOfLayer(layerOf(m, f)) === m, `base layer of ${m}/${f} maps back`)
ok(materialOfLayer(FALLBACK_LAYER) === -1, 'the fallback layer belongs to no material')
for (const m of VARIANT_MATERIALS) for (const f of [TOP, SIDE, BOTTOM]) for (let v = 0; v < VARIANTS_PER; v++)
  ok(materialOfLayer(variantLayerOf(m, f) + v) === m, `variant layer of ${m}/${f} v${v + 1} maps back`)
ok(materialOfLayer(LAYER_COUNT) === -1 && materialOfLayer(VARIANT_BASE + 9999) === -1, 'past the end is nobody\'s')

// ── 2. the placeholder wears each material's flat colour ───────────────────────────────────────
{
  const size = 8, per = size * size * 4
  const ph = buildPlaceholderArray(size)
  ok(ph.length === per * LAYER_COUNT, 'placeholder covers every layer')
  const at = (L: number) => [ph[L * per], ph[L * per + 1], ph[L * per + 2], ph[L * per + 3]]
  const c = MATERIAL_COLOR[MAT.TOPSOIL]
  ok(at(layerOf(MAT.TOPSOIL, TOP)).slice(0, 3).join() === [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(), 'turf placeholder = MATERIAL_COLOR[TOPSOIL]')
  ok(at(FALLBACK_LAYER).slice(0, 3).join() === '255,0,255', 'the fallback placeholder is still magenta')
  ok(at(variantLayerOf(MAT.STONE, SIDE)).join() === at(layerOf(MAT.STONE, SIDE)).join(), 'a variant placeholder matches its base')
  ok(at(layerOf(MAT.TOPSOIL, TOP))[3] === 0, 'placeholder alpha is 0 — no emissive mask on a stand-in')
  // uniform within a layer
  const L = layerOf(MAT.SAND, TOP); let uniform = true
  for (let i = 0; i < per; i += 4) if (ph[L * per + i] !== ph[L * per] || ph[L * per + i + 1] !== ph[L * per + 1]) { uniform = false; break }
  ok(uniform, 'a placeholder layer is one flat colour')
  const fr = flatReliefArray(per)
  ok(fr[0] === 128 && fr[1] === 128 && fr[2] === 255 && fr[3] === 255 && fr[per - 1] === 255, 'the flat relief is every normal straight out')
}

// ── 3. the worker, the URL, the artifact, and the fallback ─────────────────────────────────────
const worker = fs.readFileSync(new URL('../../../../workers/tile-paint.worker.ts', import.meta.url), 'utf8')
ok(/msg\.type !== 'tiles'/.test(worker) && /buildTileArray\(size\)/.test(worker) && /buildReliefArray\(data, size\)/.test(worker), 'the worker paints tiles + relief on a tiles message')
ok(/\[data\.buffer, relief\.buffer\]/.test(worker), 'both buffers are transferred, not copied')
ok(!/from 'three'|from 'react'/.test(worker), 'the worker imports no host library')
const urlMod = fs.readFileSync(new URL('../../../../workers/worker-url.ts', import.meta.url), 'utf8')
const tileUrl = urlMod.match(/TILE_WORKER_URL = '\/(tile-paint\.worker\.[0-9a-f]{10}\.js)'/)?.[1]
ok(!!tileUrl, 'worker-url.ts exports TILE_WORKER_URL with a hash')
ok(!!tileUrl && fs.existsSync(new URL(`../../../../../public/${tileUrl}`, import.meta.url)), `the artifact ${tileUrl} exists in public/`)
const build = fs.readFileSync(new URL('../../../../../scripts/build-worker.mjs', import.meta.url), 'utf8')
ok(/tile-paint\.worker\.ts/.test(build) && /TILE_WORKER_URL/.test(build), 'build-worker.mjs builds the tile worker')
const fresh = fs.readFileSync(new URL('../../../../../scripts/worker-fresh.mjs', import.meta.url), 'utf8')
ok(/tile-paint\.worker/.test(fresh), 'worker-fresh.mjs checks the tile worker too')
const atlas = fs.readFileSync(new URL('./atlas.ts', import.meta.url), 'utf8')
ok(/typeof Worker !== 'undefined'/.test(atlas) && /buildPlaceholderArray\(size\) : buildTileArray\(size\)/.test(atlas), 'no Worker → the synchronous paint, as before')
ok(/worker\.onerror = \(\) => fallback/.test(atlas) && /setTimeout\(\(\) => fallback/.test(atlas) && /TILE_WORKER_TIMEOUT_MS/.test(atlas), 'error and silence both fall back to the main-thread paint')
ok(/tex\.image\.data = bytes; tex\.needsUpdate = true/.test(atlas) && /relief\.image\.data = normals; relief\.needsUpdate = true/.test(atlas), 'the swap writes both textures in place')
ok(/msg\.size !== size\) return/.test(atlas), 'a reply for another size is ignored')
ok(/worker\?\.terminate\(\)/.test(atlas), 'the worker is terminated after the swap')

console.log(`\ntile-worker: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the placeholder wears the right colours, the worker paints the real ones, and silence falls back')
