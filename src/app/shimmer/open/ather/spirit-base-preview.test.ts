// M174: the last four base forms, OWNER PREVIEW. Run: npx tsx src/app/shimmer/open/ather/spirit-base-preview.test.ts
// A built base is drawn for the owner only (gallery + own garden) until Alex OKs it: players' registries must NOT list it,
// its glb must ship rigged with every game clip, and it must draw at its ruled full-grown size (creature-size.ts GROWN).
import * as fs from 'fs'
import { BASE_PREVIEW, basePreviewFor, LEPARA_GLB_TALL } from './spirit-base-preview'
import { SPIRIT_MODELS, SPIRIT_RIGS, rigLook } from './spirit-models'
import { RIG_CLIPS } from './spirit-rig'
import { GROWN } from '../../sprites/creature-size'
import type { Species } from '../../spirits/spirit'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const glbJson = (url: string) => { const b = fs.readFileSync('public' + url), jl = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + jl).toString()) }

for (const [sp, L] of Object.entries(BASE_PREVIEW) as [Species, NonNullable<(typeof BASE_PREVIEW)[Species]>][]) {
  ok(!SPIRIT_MODELS[sp] && !SPIRIT_RIGS[sp], `${sp}: still owner-only (players' registries do not list it)`)
  ok(basePreviewFor(sp) === L, `${sp}: basePreviewFor finds it`)
  ok(!!L.rig && rigLook(sp, L, true) === L && rigLook(sp, L, false) === L, `${sp}: rigLook keeps the rigged look (no player model to fall back to)`)
  ok(fs.existsSync('public' + L.url), `${sp}: ${L.url} ships`)
  const j = glbJson(L.url), names = j.animations.map((a: { name: string }) => a.name)
  ok(RIG_CLIPS.every(c => names.includes(c)), `${sp}: every game clip (${names.join(',')})`)
  ok(['body', 'eyes', 'b_neck', 'b_head', 'b_lids'].every(n => j.nodes.some((x: { name: string }) => x.name === n)), `${sp}: body, eyes, neck, head, lids nodes`)
  ok((j.skins?.[0]?.joints?.length ?? 99) <= 30, `${sp}: inside the game's 30-bone budget`)
}
// Lepara at her ruled full-grown height (0.48 m to the ear tips standing)
const lep = BASE_PREVIEW.rabbit!
ok(Math.abs(lep.h * LEPARA_GLB_TALL - GROWN.rabbit.height) < 1e-9, `lepara: stands ${GROWN.rabbit.height} m (h ${lep.h})`)
ok(basePreviewFor('fox') === null && basePreviewFor(null) === null, 'a species with a player model, or none, has no preview')

console.log(`spirit-base-preview: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('FAIL', f)
process.exit(fails.length ? 1 : 0)
