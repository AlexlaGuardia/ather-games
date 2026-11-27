// M174: the last four base forms, OWNER PREVIEW. Run: npx tsx src/app/shimmer/open/ather/spirit-base-preview.test.ts
// A built base is drawn for the owner only (gallery + own garden) until Alex OKs it; M226 (Alex OK 11-27): all four are players' now, so
// players' registries list the very BASE_PREVIEW look;
// its glb must ship rigged with every game clip, and it must draw at its ruled full-grown size (creature-size.ts GROWN).
import * as fs from 'fs'
import { BASE_PREVIEW, basePreviewFor, LEPARA_GLB_TALL, SHELLMERE_GLB_TALL, CROAKLING_GLB_TALL, LUMINARA_GLB_LONG, LUMINARA_RIG } from './spirit-base-preview'
import { SPIRIT_MODELS, SPIRIT_RIGS, rigLook } from './spirit-models'
import { RIG_CLIPS } from './spirit-rig'
import { GROWN } from '../../sprites/creature-size'
import type { Species } from '../../spirits/spirit'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const glbJson = (url: string) => { const b = fs.readFileSync('public' + url), jl = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + jl).toString()) }

for (const [sp, L] of Object.entries(BASE_PREVIEW) as [Species, NonNullable<(typeof BASE_PREVIEW)[Species]>][]) {
  ok(SPIRIT_MODELS[sp] === L && SPIRIT_RIGS[sp] === L, `${sp}: M226 every keeper's model (players' registries list this very look)`)
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
// Shellmere at his ruled full-grown height (0.45 m to the antenna bulbs standing), rigged with his antennae
const shl = BASE_PREVIEW.turtle!
ok(!!shl && Math.abs(shl.h * SHELLMERE_GLB_TALL - GROWN.turtle.height) < 1e-9, `shellmere: stands ${GROWN.turtle.height} m (h ${shl?.h})`)
ok(!!shl && ['b_shell', 'b_ant_l', 'b_ant2_r'].every(n => glbJson(shl.url).nodes.some((x: { name: string }) => x.name === n)), 'shellmere: shell + antenna bones')
// Croakling at its ruled full-grown height (0.40 m knee-high, to the top of the lure's arch), the canon lure on its own bones and moving in idle
const crk = BASE_PREVIEW.frog!
ok(!!crk && Math.abs(crk.h * CROAKLING_GLB_TALL - GROWN.frog.height) < 1e-9, `croakling: stands ${GROWN.frog.height} m (h ${crk?.h})`)
const cj = crk ? glbJson(crk.url) : null, lureIx = (n: string) => cj ? cj.nodes.findIndex((x: { name: string }) => x.name === n) : -1
ok(!!cj && ['b_lure', 'b_lure2', 'b_lure3', 'b_throat'].every(n => lureIx(n) >= 0), 'croakling: lure (3 bones) + throat bones')
ok(!!cj && ['b_lure', 'b_lure3'].every(n => cj.animations.find((a: { name: string }) => a.name === 'idle')?.channels.some((c: { target: { node: number } }) => c.target.node === lureIx(n))), 'croakling: idle animates the lure')
// Luminara at her ruled full-grown size (~0.30 m long flier: nose to the abdomen's tip, read off the glb's own rest bounds, not a hand copy),
// hovering on the Hovari contract (rig.hover + its own culling, b_hover unkeyed), her pulsing abdomen = the glow part `lamp`, wings + antennae on bones
const lum = BASE_PREVIEW.firefly!, lj = lum ? glbJson(lum.url) : null
const lumLong = (() => { if (!lj) return 0; let z0 = 9, z1 = -9; for (const me of lj.meshes) if (me.name !== 'eyes') { const a = lj.accessors[me.primitives[0].attributes.POSITION]; z0 = Math.min(z0, a.min[2]); z1 = Math.max(z1, a.max[2]) } return z1 - z0 })()
ok(!!lum && Math.abs(lum.h * LUMINARA_GLB_LONG - GROWN.firefly.length!) < 1e-9 && Math.abs(lumLong - LUMINARA_GLB_LONG) < 0.002, `luminara: ${GROWN.firefly.length} m long (h ${lum?.h}, glb ${lumLong.toFixed(4)} units)`)
const lIx = (n: string) => lj ? lj.nodes.findIndex((x: { name: string }) => x.name === n) : -1
ok(!!lj && ['b_hover', 'b_abd', 'b_fw_l', 'b_hw_r', 'b_ant_l', 'b_ant2_r', 'lamp'].every(n => lIx(n) >= 0), 'luminara: hover, abdomen, wing, antenna bones + the lamp mesh')
ok(!!lj && lj.animations.every((a: { channels: { target: { node: number } }[] }) => !a.channels.some(c => c.target.node === lIx('b_hover'))), 'luminara: no clip keys b_hover (the hover contract)')
ok(!!LUMINARA_RIG.hover && !!LUMINARA_RIG.cull && !LUMINARA_RIG.fly && lum?.glow?.part === 'lamp', 'luminara: a hoverer with her own culling, the lamp glows')
ok(basePreviewFor('fox') === null && basePreviewFor(null) === null, 'a species with a player model, or none, has no preview')

console.log(`spirit-base-preview: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('FAIL', f)
process.exit(fails.length ? 1 : 0)
