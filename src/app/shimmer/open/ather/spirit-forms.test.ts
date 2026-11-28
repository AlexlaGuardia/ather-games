// M202 s1: the Vulnyx line's four SECOND FORMS (Vulnara / Vulnarc / Vulnore / Vulnix) and how an evolved spirit picks hers.
// Run: npx tsx src/app/shimmer/open/ather/spirit-forms.test.ts
// Reads the shipped glbs: each form is rigged on the Vulnyx's own M132 plan (same bones, every clip), is bigger than her base
// (every evolution grows the spirit: spirits-species.md, Spirit Scale), and carries the coat of its locked picture.
import * as fs from 'fs'
import { BASE_PREVIEW, LUMINARA_UNIT } from './spirit-base-preview'
import { SHELL_GLB_TALL, shellGlb } from './spirit-models'   // M202 the Shellmere line
import { LEP_GLB_TALL } from './spirit-models'   // M202 the Lepara line
import { LUM_GLB_TALL } from './spirit-models'   // M202 the Luminara line
import { PUBLIC_FORMS } from './spirit-public'
import { type SpiritElement, CROAK_GLB_TALL, AURLOTL_RIG, ARCLOTL_RIG, CRAGLOTL_RIG, LOTL_GLB_TALL, BEAR_GLB_TALL, LUMEBEAR_RIG, VOLTBEAR_RIG, TIDEBEAR_RIG, NOCT_GLB_TALL, NOCTARC_RIG, NOCTARA_RIG, NOCTORE_RIG, NOCTIX_RIG, NOCTYX_RIG, OWL_GLB_TALL, MYSTOWL_RIG, VOLTOWL_RIG, CRAGOWL_RIG, TIDEOWL_RIG, ATHOWL_RIG, HOV_GLB_TALL, VOLTARI_RIG, LUMARI_RIG, OBSIDARI_RIG, TIDARI_RIG, HOVARI_RIG, CRAGBEAR_GLB_TALL, CRAGBEAR_RIG, MARLOTL_RIG, CROAKARC_RIG, SECOND_FORMS, formGrow, SPIRIT_ELEMENTS, SPIRIT_MODELS, SPIRIT_RIGS, formLook, rigLook, spiritModelFor } from './spirit-models'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** the glb's JSON chunk + the body's COLOR_0 bytes */
function glb(url: string) {
  const b = fs.readFileSync('public' + url), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString())
  const bin = b.subarray(20 + jl + 8)
  const body = j.meshes.find((m: { name: string }) => m.name === 'body')
  const acc = j.accessors[body.primitives[0].attributes.COLOR_0], view = j.bufferViews[acc.bufferView]
  const col = bin.subarray((view.byteOffset ?? 0) + (acc.byteOffset ?? 0), (view.byteOffset ?? 0) + (acc.byteOffset ?? 0) + acc.count * 4)
  return { j, col, n: acc.count }
}
/** the mean colour of the body's vertices (sRGB bytes) */
const mean = (col: Buffer, n: number) => [0, 1, 2].map(c => { let s = 0; for (let i = 0; i < n; i++) s += col[i * 4 + c]; return s / n })

// ── the four forms, by element, as the canon roster names them (spirits-species.md, The 40 Second Forms: Vulnyx row) ──
const NAMES = { mana: 'vulnara', storm: 'vulnarc', earth: 'vulnore', water: 'vulnix' } as const
const base = SPIRIT_RIGS.fox!
for (const el of SPIRIT_ELEMENTS) {
  const L = formLook('fox', el)!
  ok(!!L, `fox ${el}: a second form`)
  if (!L) continue
  ok(L.name === NAMES[el] && L.url === `/open/spirits/${NAMES[el]}-rigged.glb`, `fox ${el}: ${L.name} ${L.url}`)
  ok(L.form === el, `fox ${el}: look.form`)
  ok(!!L.rig && L.rig === base.rig, `fox ${el}: rigged on the Vulnyx plan`)
  ok(L.h > base.h * 1.1 && Math.abs(L.h - base.h * formGrow(L.name!)) < 1e-9, `fox ${el}: grown past her base by her own dial (${L.h.toFixed(3)} vs ${base.h.toFixed(3)})`)
  // M202 v2: all four of the Vulnyx line (Vulnore, Vulnara, Vulnarc, Vulnix) are their own creatures at dial 1.4 (Alex 11-26, ~1.0 m)
  ok(formGrow(L.name!) === 1.4, `fox ${el}: size dial ${formGrow(L.name!)}`)
  ok((L.trot.stride ?? 0) > (base.trot.stride ?? 0), `fox ${el}: her stride grows with her`)
  ok(fs.existsSync('public' + L.url), `fox ${el}: ${L.url} shipped`)
  const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
  ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head'].every(x => names.includes(x)), `fox ${el}: nodes ${names.slice(0, 6)}`)
  ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `fox ${el}: clips ${clips}`)
  ok(j.skins?.[0]?.joints?.length === 24, `fox ${el}: 24 bones`)
  // the coat reads as her picture: the dominant channel of the body's mean colour
  const [r, g, b] = mean(col, n)
  const coat = el === 'mana' ? b > g && r > g : el === 'storm' ? b > r && b > g && r < 200 : el === 'earth' ? r > g && g > b : g > r && b > r
  ok(coat, `fox ${el}: coat ${[r, g, b].map(Math.round)}`)
}
// ── M202 MARLOTL: Manalotl's Water form, her OWN creature and her own skeleton (not the Manalotl's), dial 1.4 by length ──
{ const L = formLook('axolotl', 'water')!, b = SPIRIT_RIGS.axolotl!
  ok(!!L && L.name === 'marlotl' && L.url === '/open/spirits/marlotl-rigged.glb' && L.form === 'water', `axolotl water: Marlotl ${L?.url}`)
  ok(!!L.rig && L.rig === MARLOTL_RIG && L.rig !== b.rig, 'axolotl water: her own rig')
  ok(formGrow('marlotl') === 1.4, `axolotl water: size dial ${formGrow('marlotl')}`)
  const len = L.h * MARLOTL_RIG.glbLen, baseLen = b.h * b.rig!.glbLen
  ok(Math.abs(len - 0.9 * 1.4) < 1e-9 && Math.abs(len / baseLen - 1.4) < 0.01, `axolotl water: 1.4 x her base's length (${len.toFixed(3)} vs ${baseLen.toFixed(3)} m)`)
  ok((L.trot.stride ?? 0) > (b.trot.stride ?? 0), 'axolotl water: her stride grows with her')
  ok(fs.existsSync('public' + L.url), `axolotl water: ${L.url} shipped`)
  const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
  ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head'].every(x => names.includes(x)), `axolotl water: nodes ${names.slice(0, 6)}`)
  ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)) && L.rig!.lie === true, `axolotl water: clips ${clips}`)
  ok(j.skins?.[0]?.joints?.length === 24, 'axolotl water: 24 bones')
  // her glb's nose-to-tail is the glbLen her size reads (within 2%)
  const pos = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
  ok(Math.abs((pos.max[2] - pos.min[2]) / MARLOTL_RIG.glbLen - 1) < 0.02, `axolotl water: glb length ${(pos.max[2] - pos.min[2]).toFixed(3)} = glbLen ${MARLOTL_RIG.glbLen}`)
  const [r, g, bb] = mean(col, n); ok(g > r + 40 && bb > r + 40, `axolotl water: a teal coat ${[r, g, bb].map(Math.round)}`) }
// ── M202 the rest of the Manalotl line: Aurlotl / Arclotl / Craglotl, each her OWN creature and her own skeleton, sculpted in
// Marlotl's number space so all four share Marlotl's world scale (dial 1.4), each with her own coat ──
{ const W = formLook('axolotl', 'water')!, b = SPIRIT_RIGS.axolotl!
  const LINE: [SpiritElement, string, typeof MARLOTL_RIG, (c: number[]) => boolean, string][] = [
    ['mana', 'aurlotl', AURLOTL_RIG, ([r, g, bb]) => bb > g + 40 && r > g + 10, 'a violet coat'],
    ['storm', 'arclotl', ARCLOTL_RIG, ([r, g, bb]) => bb > r + 40 && bb > g + 15, 'a sky-blue coat'],
    ['earth', 'craglotl', CRAGLOTL_RIG, ([r, g, bb]) => r > g + 30 && g > bb + 20, 'an orange earth coat']]
  const sizes: string[] = []
  for (const [el, name, rig, coat, what] of LINE) {
    const L = formLook('axolotl', el)!
    ok(!!L && L.name === name && L.url === `/open/spirits/${name}-rigged.glb` && L.form === el, `axolotl ${el}: ${name} ${L?.url}`)
    ok(L.rig === rig && rig !== MARLOTL_RIG && rig !== b.rig, `axolotl ${el}: her own rig`)
    ok(formGrow(name) === 1.4 && Math.abs(L.h - W.h) < 1e-9, `axolotl ${el}: dial 1.4, Marlotl's world scale (h ${L.h.toFixed(3)} vs ${W.h.toFixed(3)})`)
    ok((L.trot.stride ?? 0) > (b.trot.stride ?? 0), `axolotl ${el}: her stride grows with her`)
    ok(fs.existsSync('public' + L.url), `axolotl ${el}: ${L.url} shipped`)
    const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
    ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head', 'b_ear_l', 'b_tail4'].every(x => names.includes(x)), `axolotl ${el}: nodes ${names.slice(0, 6)}`)
    ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)) && L.rig!.lie === true, `axolotl ${el}: clips ${clips}`)
    ok(j.skins?.[0]?.joints?.length === 24, `axolotl ${el}: 24 bones`)
    const pos = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
    const len = pos.max[2] - pos.min[2], wid = pos.max[0] - pos.min[0], tall = pos.max[1]
    ok(Math.abs(len / rig.glbLen - 1) < 0.02, `axolotl ${el}: glb length ${len.toFixed(3)} = glbLen ${rig.glbLen}`)
    ok(Math.abs(tall / LOTL_GLB_TALL[name] - 1) < 0.06, `axolotl ${el}: glb height ${tall.toFixed(3)} ~ LOTL_GLB_TALL ${LOTL_GLB_TALL[name]}`)
    const c = mean(col, n); ok(coat(c), `axolotl ${el}: ${what} ${c.map(Math.round)}`)
    sizes.push(`${(len / tall).toFixed(1)}:${(wid / tall).toFixed(1)}`)
  }
  // her own silhouette: no two forms of the line share a length:height + width:height read (a reskin would)
  ok(new Set(sizes).size === 3, `axolotl: three distinct silhouettes ${sizes}`)
  ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('axolotl', e)!.url)).size === 4, 'axolotl: four distinct forms') }
// ── M202 Aurlotl's gold marks = second-form INFUSION MARKINGS, pattern only, never a sigil (Magii RULED-AFK, athernyx 0d6d577):
// flowing glyph panels drawn as unlit gold geometry in her 'eyes' part. The brow panel rides the head; the chest / flank / arm
// panels must ride the BODY's bones (else they float off her skin when she walks or sits). The old placeholder was one brow
// sigil and nothing gold off the head bone. ──
{ const b = fs.readFileSync('public/open/spirits/aurlotl-rigged.glb'), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8)
  const at = (i: number) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], o = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); return bin.subarray(o, o + a.count * 4) }
  const e = j.meshes.find((m: { name: string }) => m.name === 'eyes').primitives[0].attributes, n = j.accessors[e.COLOR_0].count
  const col = at(e.COLOR_0), jt = at(e.JOINTS_0), wt = at(e.WEIGHTS_0), head = (j.skins[0].joints as number[]).map(i => j.nodes[i].name).indexOf('b_head')
  let onHead = 0, onBody = 0
  for (let i = 0; i < n; i++) {
    const r = col[i * 4], g = col[i * 4 + 1], bb = col[i * 4 + 2]; if (!(r > 150 && g > 90 && bb < 60)) continue   // gold (linear bytes)
    let top = 0; for (let k = 1; k < 4; k++) if (wt[i * 4 + k] > wt[i * 4 + top]) top = k
    if (jt[i * 4 + top] === head) onHead++; else onBody++
  }
  ok(head >= 0 && onHead > 300, `aurlotl: the brow panel rides the head (${onHead} gold verts)`)
  ok(onBody > 2 * onHead, `aurlotl: chest / flank / arm panels ride the body bones (${onBody} gold verts off the head)`) }
// ── M202 CRAGBEAR: Dewbear's Earth form, her OWN creature and her own skeleton (not the Dewbear's), dial 1.4 by height ──
{ const L = formLook('water-bear', 'earth')!, b = SPIRIT_RIGS['water-bear']!
  ok(!!L && L.name === 'cragbear' && L.url === '/open/spirits/cragbear-rigged.glb' && L.form === 'earth', `water-bear earth: Cragbear ${L?.url}`)
  ok(!!L.rig && L.rig === CRAGBEAR_RIG && L.rig !== b.rig, 'water-bear earth: her own rig')
  ok(formGrow('cragbear') === 1.4 && Math.abs(L.h / b.h - 1.4) < 1e-9, `water-bear earth: size dial ${formGrow('cragbear')} (h ${L.h.toFixed(3)} vs ${b.h.toFixed(3)})`)
  ok((L.trot.stride ?? 0) > (b.trot.stride ?? 0), 'water-bear earth: her stride grows with her')
  ok(fs.existsSync('public' + L.url), `water-bear earth: ${L.url} shipped`)
  const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
  ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head'].every(x => names.includes(x)), `water-bear earth: nodes ${names.slice(0, 6)}`)
  ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)) && L.rig!.lie === true, `water-bear earth: clips ${clips}`)
  ok(j.skins?.[0]?.joints?.length === 24, 'water-bear earth: 24 bones')
  // her glb's nose-to-tail is the glbLen her rig reads, and her height the CRAGBEAR_GLB_TALL the prod check sizes her by (within 3%)
  const pos = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
  ok(Math.abs((pos.max[2] - pos.min[2]) / CRAGBEAR_RIG.glbLen - 1) < 0.03, `water-bear earth: glb length ${(pos.max[2] - pos.min[2]).toFixed(3)} = glbLen ${CRAGBEAR_RIG.glbLen}`)
  ok(Math.abs(pos.max[1] / CRAGBEAR_GLB_TALL - 1) < 0.03, `water-bear earth: glb height ${pos.max[1].toFixed(3)} = CRAGBEAR_GLB_TALL ${CRAGBEAR_GLB_TALL}`)
  // the earth coat: a warm orange-brown barrel (red over green over blue), never the Dewbear's pale dew blue
  const [r, g, bb] = mean(col, n); ok(r > g + 30 && g > bb, `water-bear earth: an earth coat ${[r, g, bb].map(Math.round)}`) }
// ── M202 the rest of the Dewbear line: each her OWN creature with her own skeleton (not Cragbear's, not the Dewbear's), dial 1.4 ──
const BEARS: [SpiritElement, string, typeof CRAGBEAR_RIG][] = [['mana', 'lumebear', LUMEBEAR_RIG], ['storm', 'voltbear', VOLTBEAR_RIG], ['water', 'tidebear', TIDEBEAR_RIG]]
for (const [el, name, rig] of BEARS) {
  const L = formLook('water-bear', el)!, b = SPIRIT_RIGS['water-bear']!
  ok(!!L && L.name === name && L.url === `/open/spirits/${name}-rigged.glb` && L.form === el, `water-bear ${el}: ${name} ${L?.url}`)
  ok(L.rig === rig && rig !== b.rig && rig !== CRAGBEAR_RIG, `water-bear ${el}: her own rig`)
  ok(formGrow(name) === 1.4 && Math.abs(L.h / b.h - 1.4) < 1e-9, `water-bear ${el}: size dial ${formGrow(name)}`)
  ok(fs.existsSync('public' + L.url), `water-bear ${el}: ${L.url} shipped`)
  const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
  ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 24, `water-bear ${el}: nodes + 24 bones`)
  ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `water-bear ${el}: clips ${clips}`)
  const pos = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
  ok(Math.abs((pos.max[2] - pos.min[2]) / rig.glbLen - 1) < 0.03, `water-bear ${el}: glb length ${(pos.max[2] - pos.min[2]).toFixed(3)} = glbLen ${rig.glbLen}`)
  ok(Math.abs(pos.max[1] / BEAR_GLB_TALL[name] - 1) < 0.04, `water-bear ${el}: glb height ${pos.max[1].toFixed(3)} = BEAR_GLB_TALL ${BEAR_GLB_TALL[name]}`)
  // her element's coat (canon accents, magii.md: Mana violet, Storm blue, Water teal), never the Dewbear's pale dew blue
  const [r, g, bb] = mean(col, n)
  ok(el === 'mana' ? bb > g + 40 && r > g + 15 : el === 'storm' ? bb > r + 40 && bb > g + 15 : g > r + 40 && bb > r + 40, `water-bear ${el}: her ${el} coat ${[r, g, bb].map(Math.round)}`)
}
// her own creature: no two forms of the line share a silhouette. Her front profile = her width (glb units) in eight height bands of
// her own height, read off her body's vertices; two forms whose profiles never differ by 0.06 would be one body recoloured.
{ const prof = (e: SpiritElement) => { const { j } = glb(formLook('water-bear', e)!.url), b = fs.readFileSync('public' + formLook('water-bear', e)!.url), bin = b.subarray(20 + b.readUInt32LE(12) + 8)
    const a = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION], v = j.bufferViews[a.bufferView], o = (v.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const w = new Array(8).fill(0), top = a.max[1]
    for (let i = 0; i < a.count; i++) { const x = Math.abs(bin.readFloatLE(o + i * 12)), y = bin.readFloatLE(o + i * 12 + 4), k = Math.min(7, Math.floor(y / top * 8)); w[k] = Math.max(w[k], x) }
    return w }
  const P = (['earth', ...BEARS.map(x => x[0])] as SpiritElement[]).map(prof); let same = 0, least = 9
  for (let a = 0; a < P.length; a++) for (let c = a + 1; c < P.length; c++) { const d = Math.max(...P[a].map((x, i) => Math.abs(x - P[c][i]))); least = Math.min(least, d); if (d < 0.06) same++ }
  ok(same === 0, `the Dewbear line: four distinct silhouettes (least profile difference ${least.toFixed(3)} glb units)`) }
{ const { col, n } = glb(SPIRIT_RIGS['water-bear']!.url), [r, g, b] = mean(col, n); ok(b >= r, `base Dewbear stays dew blue ${[r, g, b].map(Math.round)}`) }
// her base form's coat is gold: a second form never ships the base colours by mistake
{ const { col, n } = glb(SPIRIT_RIGS.fox!.url), [r, g, b] = mean(col, n); ok(r > b + 60 && g > b, `base Vulnyx stays gold ${[r, g, b].map(Math.round)}`) }

// M202 the Noctyx line: each form her own creature on the base's flier rig plan (32 bones, idle/walk = hop/run = fly/sit/lie)
const NOCTS: [SpiritElement, string, typeof NOCTYX_RIG][] = [['storm', 'noctarc', NOCTARC_RIG], ['mana', 'noctara', NOCTARA_RIG], ['earth', 'noctore', NOCTORE_RIG], ['water', 'noctix', NOCTIX_RIG]]
for (const [el, name, rig] of NOCTS) {
  const L = formLook('bat', el)!, b = SPIRIT_RIGS.bat!
  ok(!!L && L.name === name && L.url === `/open/spirits/${name}-rigged.glb` && L.form === el, `bat ${el}: ${name} ${L?.url}`)
  ok(L.rig === rig && rig !== b.rig && !!rig.fly, `bat ${el}: her own rig, still a flier`)
  ok(formGrow(name) === 1.4 && Math.abs(L.h / b.h - 1.4) < 1e-9, `bat ${el}: size dial ${formGrow(name)}`)
  ok(fs.existsSync('public' + L.url), `bat ${el}: ${L.url} shipped`)
  const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
  const pos = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
  ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head', 'b_lids', 'b_arm1_l'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 32, `bat ${el}: nodes + 32 bones`)
  ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `bat ${el}: clips ${clips}`)
  ok(Math.abs(pos.max[1] / NOCT_GLB_TALL[name] - 1) < 0.04, `bat ${el}: glb height ${pos.max[1].toFixed(3)} = NOCT_GLB_TALL ${NOCT_GLB_TALL[name]}`)
  // her element's coat (magii.md: Mana violet, Storm blue, Earth brown, Water teal), never the base Noctyx's purple
  const [r, g, bb] = mean(col, n)
  ok(el === 'mana' ? bb > g + 25 && r > g + 10 : el === 'storm' ? bb > r + 40 && bb > g + 15 : el === 'earth' ? r > g + 20 && g > bb : g > r + 40 && bb > r + 40, `bat ${el}: her ${el} coat ${[r, g, bb].map(Math.round)}`)
}
// a flier's front width is mostly her wing span, so her profile is width + front depth + back depth in the same eight bands
{ const prof = (u: string) => { const { j } = glb(u), b = fs.readFileSync('public' + u), bin = b.subarray(20 + b.readUInt32LE(12) + 8)
    const a = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION], v = j.bufferViews[a.bufferView], o = (v.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const w = new Array(24).fill(-9), top = a.max[1]
    for (let i = 0; i < a.count; i++) { const x = Math.abs(bin.readFloatLE(o + i * 12)), y = bin.readFloatLE(o + i * 12 + 4), z = bin.readFloatLE(o + i * 12 + 8), k = Math.min(7, Math.floor(y / top * 8)); w[k] = Math.max(w[k], x); w[8 + k] = Math.max(w[8 + k], z); w[16 + k] = Math.max(w[16 + k], -z) }
    return w }
  const P = [SPIRIT_RIGS.bat!.url, ...NOCTS.map(x => formLook('bat', x[0])!.url)].map(prof); let same = 0, least = 9
  for (let a = 0; a < P.length; a++) for (let c = a + 1; c < P.length; c++) { const d = Math.max(...P[a].map((x, i) => Math.abs(x - P[c][i]))); least = Math.min(least, d); if (d < 0.06) same++ }
  ok(same === 0, `the Noctyx line: five distinct silhouettes, base included (least profile difference ${least.toFixed(3)} glb units)`) }
ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('bat', e)!.url)).size === 4, 'the Noctyx line: four distinct forms')

// M202 the Athowl line: each form her own creature on the base Athowl's flier rig plan (25 bones, idle/walk = hop/run = fly/sit/lie)
const OWLS: [SpiritElement, string, typeof ATHOWL_RIG][] = [['mana', 'mystowl', MYSTOWL_RIG], ['storm', 'voltowl', VOLTOWL_RIG], ['earth', 'cragowl', CRAGOWL_RIG], ['water', 'tideowl', TIDEOWL_RIG]]
for (const [el, name, rig] of OWLS) {
  const L = formLook('owl', el)!, b = SPIRIT_RIGS.owl!
  ok(!!L && L.name === name && L.url === `/open/spirits/${name}-rigged.glb` && L.form === el, `owl ${el}: ${name} ${L?.url}`)
  ok(L.rig === rig && rig !== b.rig && !!rig.fly && rig.neck === ATHOWL_RIG.neck, `owl ${el}: her own rig, still a flier`)
  ok(formGrow(name) === 1.4 && Math.abs(L.h / b.h - 1.4) < 1e-9, `owl ${el}: size dial ${formGrow(name)}`)
  ok(fs.existsSync('public' + L.url), `owl ${el}: ${L.url} shipped`)
  const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
  const pos = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
  ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head', 'b_lids', 'b_wing1_l', 'b_tail2'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 25, `owl ${el}: nodes + 25 bones`)
  ok(['idle', 'walk', 'run', 'sit', 'lie', 'glide'].every(c => clips.includes(c)), `owl ${el}: clips ${clips}`)
  ok(Math.abs(pos.max[1] / OWL_GLB_TALL[name] - 1) < 0.04, `owl ${el}: glb height ${pos.max[1].toFixed(3)} = OWL_GLB_TALL ${OWL_GLB_TALL[name]}`)
  // her element's coat (magii.md: Mana violet, Storm blue, Earth brown, Water teal), never the base Athowl's lavender-silver
  const [r, g, bb] = mean(col, n)
  ok(el === 'mana' ? bb > g + 25 && r > g + 10 : el === 'storm' ? bb > r + 40 && bb > g + 15 : el === 'earth' ? r > g + 20 && g > bb : g > r + 40 && bb > r + 40, `owl ${el}: her ${el} coat ${[r, g, bb].map(Math.round)}`)
}
// siblings told apart: width + front depth + back depth in eight height bands (a front width alone is blind on wide wings), the
// base included, plus each form's own tell: Voltowl's raised wings are the widest, Cragowl's antlers the tallest, Tideowl's tail the longest
{ const prof = (u: string) => { const { j } = glb(u), b = fs.readFileSync('public' + u), bin = b.subarray(20 + b.readUInt32LE(12) + 8)
    const a = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION], v = j.bufferViews[a.bufferView], o = (v.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const w = new Array(24).fill(-9), top = a.max[1]
    for (let i = 0; i < a.count; i++) { const x = Math.abs(bin.readFloatLE(o + i * 12)), y = bin.readFloatLE(o + i * 12 + 4), z = bin.readFloatLE(o + i * 12 + 8), k = Math.min(7, Math.floor(y / top * 8)); w[k] = Math.max(w[k], x); w[8 + k] = Math.max(w[8 + k], z); w[16 + k] = Math.max(w[16 + k], -z) }
    return { w, max: a.max as number[], min: a.min as number[] } }
  const P = [SPIRIT_RIGS.owl!.url, ...OWLS.map(x => formLook('owl', x[0])!.url)].map(prof); let same = 0, least = 9
  for (let a = 0; a < P.length; a++) for (let c = a + 1; c < P.length; c++) { const d = Math.max(...P[a].w.map((x, i) => Math.abs(x - P[c].w[i]))); least = Math.min(least, d); if (d < 0.06) same++ }
  ok(same === 0, `the Athowl line: five distinct silhouettes, base included (least profile difference ${least.toFixed(3)} glb units)`)
  const [, mys, vol, crag, tide] = P, others = (k: object) => [P[0], mys, vol, crag, tide].filter(x => x !== k)
  ok(others(vol).every(x => vol.max[0] > x.max[0] + 0.1), `Voltowl: her raised wings the widest (${vol.max[0].toFixed(3)})`)
  ok(others(crag).every(x => crag.max[1] > x.max[1] + 0.08), `Cragowl: her antlers the tallest (${crag.max[1].toFixed(3)})`)
  ok(others(tide).every(x => tide.min[2] < x.min[2] - 0.1), `Tideowl: her long tail the longest back (${tide.min[2].toFixed(3)})`) }
ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('owl', e)!.url)).size === 4, 'the Athowl line: four distinct forms')
// M202 the Hovari line: each form her own creature on the base Hovari's hover plan (24 bones, b_hover unkeyed, the shimmer petals)
const HOVS: [SpiritElement, string, typeof HOVARI_RIG][] = [['storm', 'voltari', VOLTARI_RIG], ['mana', 'lumari', LUMARI_RIG], ['earth', 'obsidari', OBSIDARI_RIG], ['water', 'tidari', TIDARI_RIG]]
for (const [el, name, rig] of HOVS) {
  const L = formLook('hummingbird', el)!, b = SPIRIT_RIGS.hummingbird!
  ok(!!L && L.name === name && L.url === `/open/spirits/${name}-rigged.glb` && L.form === el, `hummingbird ${el}: ${name} ${L?.url}`)
  ok(L.rig === rig && rig !== b.rig && !!rig.hover && rig.hover === HOVARI_RIG.hover && rig.neck === HOVARI_RIG.neck, `hummingbird ${el}: her own rig, still a hoverer`)
  ok(formGrow(name) === 1.5 && Math.abs(L.h / b.h - 1.5) < 1e-9, `hummingbird ${el}: size dial ${formGrow(name)} (redo 11-27: a bit bigger)`)
  ok(L.glow?.part === 'shimmer' && L.glow.emissive !== b.glow?.emissive, `hummingbird ${el}: her own shimmer glow ${L.glow?.emissive}`)
  ok(fs.existsSync('public' + L.url), `hummingbird ${el}: ${L.url} shipped`)
  const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
  const pos = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
  ok(['body', 'eyes', 'shimmer', 'b_root', 'b_hover', 'b_neck', 'b_head', 'b_lids', 'b_arm_l'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 24, `hummingbird ${el}: nodes + 24 bones`)
  ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `hummingbird ${el}: clips ${clips}`)
  // a hoverer's bind pose hangs over the ground, so her body height is max - min (the hover not counted)
  ok(Math.abs((pos.max[1] - pos.min[1]) / HOV_GLB_TALL[name] - 1) < 0.04 && pos.min[1] > 3, `hummingbird ${el}: body ${(pos.max[1] - pos.min[1]).toFixed(3)} = HOV_GLB_TALL ${HOV_GLB_TALL[name]}, hung at ${pos.min[1].toFixed(2)}`)
  // her element's coat (magii.md: Mana violet, Storm blue, Earth brown, Water teal), never the base Hovari's mint-teal
  const [r, g, bb] = mean(col, n)
  ok(el === 'mana' ? bb > g + 25 && r > g + 10 : el === 'storm' ? bb > r + 40 && bb > g + 15 : el === 'earth' ? r > g + 20 && g > bb : g > r + 40 && bb > r + 40, `hummingbird ${el}: her ${el} coat ${[r, g, bb].map(Math.round)}`)
}
// siblings told apart: width + front depth + back depth in eight bands of her BODY height (a hoverer's hover is empty air), base included
{ const prof = (u: string) => { const { j } = glb(u), b = fs.readFileSync('public' + u), bin = b.subarray(20 + b.readUInt32LE(12) + 8)
    const a = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION], v = j.bufferViews[a.bufferView], o = (v.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const w = new Array(24).fill(-9), lo = a.min[1], top = a.max[1] - lo
    for (let i = 0; i < a.count; i++) { const x = Math.abs(bin.readFloatLE(o + i * 12)), y = bin.readFloatLE(o + i * 12 + 4) - lo, z = bin.readFloatLE(o + i * 12 + 8), k = Math.min(7, Math.floor(y / top * 8)); w[k] = Math.max(w[k], x); w[8 + k] = Math.max(w[8 + k], z); w[16 + k] = Math.max(w[16 + k], -z) }
    return { w, max: a.max as number[], min: a.min as number[] } }
  const P = [SPIRIT_RIGS.hummingbird!.url, ...HOVS.map(x => formLook('hummingbird', x[0])!.url)].map(prof); let same = 0, least = 9
  for (let a = 0; a < P.length; a++) for (let c = a + 1; c < P.length; c++) { const d = Math.max(...P[a].w.map((x, i) => Math.abs(x - P[c].w[i]))); least = Math.min(least, d); if (d < 0.06) same++ }
  ok(same === 0, `the Hovari line: five distinct silhouettes, base included (least profile difference ${least.toFixed(3)} glb units)`)
  const [, volt, lum, obs, tide] = P, others = (k: object) => P.filter(x => x !== k)
  ok(others(volt).every(x => volt.max[0] >= x.max[0]) && [obs, tide].every(x => volt.max[0] > x.max[0] + 0.08), `Voltari: her long wings the widest span (${volt.max[0].toFixed(3)})`)
  ok(others(tide).every(x => tide.min[2] < x.min[2] - 0.03), `Tidari: her long tail the longest back (${tide.min[2].toFixed(3)})`)
  ok(others(obs).every(x => obs.max[1] > x.max[1] + 0.03), `Obsidari: her chip crest the highest crown (${obs.max[1].toFixed(3)})`) }
ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('hummingbird', e)!.url)).size === 4, 'the Hovari line: four distinct forms')
// M202 the Luminara line: each form the base Luminara's sculpt + rig re-shaped by name (19 bones, the hover plan, the `lamp` glow part),
// in the base's unit (h = the base's x her dial), owner preview only; read off the shipped glbs
// M202 v2 (Alex 11-28): Luminore + Luminix lost their flight: grounded wingless EGG forms on their own 10-bone ground rig (rig_lum_ground.py)
{ const EGG = (el: SpiritElement) => el === 'earth' || el === 'water'
  const b = BASE_PREVIEW.firefly!, LUMS: [SpiritElement, string][] = [['mana', 'luminel'], ['storm', 'luminarc'], ['earth', 'luminore'], ['water', 'luminix']]
  const box = (u: string, part: string) => { const { j } = glb(u), a = j.accessors[j.meshes.find((m: { name: string }) => m.name === part).primitives[0].attributes.POSITION]; return { max: a.max as number[], min: a.min as number[] } }
  for (const [el, name] of LUMS) {
    const L = formLook('firefly', el)!
    ok(!!L && L.name === name && L.url === `/open/spirits/${name}-rigged.glb` && L.form === el, `firefly ${el}: ${name} ${L?.url}`)
    if (EGG(el)) ok(!!L.rig && L.rig !== b.rig && L.rig.neck === b.rig!.neck && !L.rig.hover && !L.rig.cull && !L.rig.fly && L.rig.avatar.y === undefined && L.rig.clipV.walk < b.rig!.clipV.walk, `firefly ${el}: her own RigLook, GROUNDED (no hover, no own culling, the panel copy not set down; waddle clipV ${L.rig?.clipV.walk.toFixed(2)})`)
    else ok(!!L.rig && L.rig !== b.rig && L.rig.neck === b.rig!.neck && !!L.rig.hover && L.rig.hover.flap === b.rig!.hover!.flap && L.rig.hover.low > 2 && !!L.rig.cull && L.rig.cull !== b.rig!.cull, `firefly ${el}: her own RigLook, still a hoverer with her own culling (glbLen ${L.rig?.glbLen})`)
    ok(formGrow(name) === 1.5 && Math.abs(L.h / b.h - 1.5) < 1e-9, `firefly ${el}: size dial ${formGrow(name)}, grown past her base`)
    ok(L.glow?.part === 'lamp' && L.glow.emissive !== b.glow?.emissive, `firefly ${el}: the lamp glows her own ${L.glow?.emissive}`)
    ok(!PUBLIC_FORMS.has(name), `firefly ${el}: owner preview only (not in PUBLIC_FORMS)`)
    ok(fs.existsSync('public' + L.url), `firefly ${el}: ${L.url} shipped`)
    const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name), bx = box(L.url, 'body')
    if (EGG(el)) { ok(['body', 'eyes', 'lamp', 'b_root', 'b_hips', 'b_abd', 'b_neck', 'b_head', 'b_lids', 'b_lids_r', 'b_leg_l', 'b_leg_r'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 10 && !names.some(x => /^b_(hover|fw|hw|ant|arm)/.test(x)), `firefly ${el}: the egg's ground rig, 10 bones, no hover / wing / antenna / arm bone`)
      { const rt = (j.nodes as { name: string; translation?: number[] }[]).find(x => x.name === 'b_root')?.translation ?? [0, 0, 0]
        ok(Math.abs(rt[1]) < 1e-4, `firefly ${el}: b_root AT the ground (y ${rt[1]}): the prod check reads her ground off it`) }
      const M = JSON.parse(fs.readFileSync(`docs/looks/m202-luminara-line-2026-11-27/${name}-metrics.json`, 'utf8')), cl = ['idle', 'walk', 'run', 'sit', 'lie']
      ok(M.ground === true && cl.every(c => M[c].lowest_glb > -0.002 && M[c].lowest_glb < 0.01 && M[c].body_lowest_glb < 0.03), `firefly ${el}: on the ground in every clip (lowest ${cl.map(c => M[c].lowest_glb).join(' / ')} glb)`)
      ok(Math.abs(M.body_mean_top - LUM_GLB_TALL[name]) < 0.01 && Math.abs(M.walk.plays_1to1_at_mps - L.rig!.clipV.walk * LUMINARA_UNIT) < 1e-3 && Math.abs(M.run.plays_1to1_at_mps - L.rig!.clipV.run * LUMINARA_UNIT) < 1e-3, `firefly ${el}: LUM_GLB_TALL + clipV match her rig metrics`) }
    else ok(['body', 'eyes', 'lamp', 'b_root', 'b_hover', 'b_abd', 'b_neck', 'b_head', 'b_lids', 'b_fw_l', 'b_hw_r', 'b_ant2_l', 'b_arm_l'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 19, `firefly ${el}: nodes + 19 bones`)
    ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)) && !(j.animations as { channels: { target: { node: number } }[] }[]).some(a => a.channels.some(c => j.nodes[c.target.node].name === 'b_hover')), `firefly ${el}: five clips, none keys b_hover`)
    ok(Math.abs((bx.max[1] - bx.min[1]) / LUM_GLB_TALL[name] - 1) < 0.08 && (EGG(el) ? Math.abs(bx.min[1]) < 0.005 : bx.min[1] > 1.9), `firefly ${el}: body ${(bx.max[1] - bx.min[1]).toFixed(3)} ~ LUM_GLB_TALL ${LUM_GLB_TALL[name]}, ${EGG(el) ? 'feet on the ground' : 'hung'} at ${bx.min[1].toFixed(2)}`)
    const [r, g, bb] = mean(col, n)   // her element's coat, never the base's amber
    ok(el === 'mana' ? bb > g + 25 && r > g + 10 : el === 'storm' ? bb > r + 40 && bb > g + 15 : el === 'earth' ? r > g + 20 && g > bb : g > r + 40 && bb > r + 40, `firefly ${el}: her ${el} coat ${[r, g, bb].map(Math.round)}`)
  }
  const B = (el: SpiritElement, part = 'body') => box(formLook('firefly', el)!.url, part), all = SPIRIT_ELEMENTS, base0 = box(b.url, 'body')
  ok(B('mana').min[1] < B('storm').min[1] - 0.03 && B('mana').min[1] < base0.min[1] - 0.03, `Luminel: her gem drawn to the lowest point of the hoverers (${B('mana').min[1].toFixed(3)})`)
  ok(B('storm', 'eyes').max[1] > B('mana', 'eyes').max[1] + 0.1, `Luminarc: her branched antennae the tallest hoverer (${B('storm', 'eyes').max[1].toFixed(3)})`)
  ok(all.filter(e => e !== 'earth').every(e => B('earth').max[2] > B(e).max[2] + 0.02) && ['earth', 'water'].every(e => B(e as SpiritElement).max[0] > base0.max[0] + 0.05), `Luminore + Luminix: round, no waist (wider than the base); Luminore the deepest front (${B('earth').max[2].toFixed(3)})`)
  ok(B('water').max[1] > B('earth').max[1] + 0.02, `Luminix: her crown fin over Luminore's crown (${B('water').max[1].toFixed(3)})`) }
ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('firefly', e)!.url)).size === 4, 'the Luminara line: four distinct forms')
// M202 the Croakling line: each form the base Croakling's sculpt + rig re-shaped (19 bones, the lure chain; Croakarc's tail rides it)
{ const b = BASE_PREVIEW.frog!, FROGS: [SpiritElement, string][] = [['water', 'croakrill'], ['mana', 'croakara'], ['earth', 'croakore'], ['storm', 'croakarc']]
  const prof = (u: string) => { const { j } = glb(u), a = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
    const e = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'eyes').primitives[0].attributes.POSITION]; return { max: a.max as number[], min: a.min as number[], emax: e.max as number[] } }
  for (const [el, name] of FROGS) {
    const L = formLook('frog', el)!
    ok(!!L && L.name === name && L.url === `/open/spirits/${name}-rigged.glb` && L.form === el, `frog ${el}: ${name} ${L?.url}`)
    ok(!!L.rig && L.rig !== b.rig && L.rig.neck === b.rig!.neck && L.rig.lie === b.rig!.lie && L.rig.glbLen > 0.6, `frog ${el}: her own RigLook on the base's plan (glbLen ${L.rig?.glbLen})`)
    ok(Math.abs(L.h / b.h - formGrow(name)) < 1e-9 && formGrow(name) >= 1.4, `frog ${el}: grows past the base (dial ${formGrow(name)})`)
    ok(L.skin.emissive !== b.skin.emissive && L.hull.color !== b.hull.color, `frog ${el}: her element's tints`)
    ok(fs.existsSync('public' + L.url), `frog ${el}: ${L.url} shipped`)
    const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
    if (el === 'storm') ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head', 'b_pelvis', 'b_spine', 'b_fl_up', 'b_hr_paw', 'b_tail1', 'b_tail4'].every(x => names.includes(x)) && !names.includes('b_lure') && j.skins?.[0]?.joints?.length === 24 && L.rig === CROAKARC_RIG, `frog storm: Croakarc a skink on her OWN 24-bone sprawl skeleton (four legs, four tail bones, no lure)`)
    else ok(['body', 'eyes', 'b_root', 'b_neck', 'b_head', 'b_lids', 'b_lids_r', 'b_throat', 'b_lure', 'b_lure2', 'b_lure3', 'b_arm_l', 'b_foot_r'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 19, `frog ${el}: nodes + 19 bones`)
    ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `frog ${el}: clips ${clips}`)
    const p = prof(L.url); ok(Math.abs((p.max[1] - p.min[1]) / CROAK_GLB_TALL[name] - 1) < 0.08, `frog ${el}: body ${(p.max[1] - p.min[1]).toFixed(3)} ~ CROAK_GLB_TALL ${CROAK_GLB_TALL[name]}`)
    const [r, g, bb] = mean(col, n)
    ok(el === 'mana' ? bb > g + 15 && r > g + 15 : el === 'storm' ? bb > r + 25 && bb > g : el === 'earth' ? r > g + 15 && g > bb + 40 : g > r + 50 && bb > r + 20, `frog ${el}: her ${el} coat ${[r, g, bb].map(Math.round)}`)
  }
  const [base, rill, ara, ore, arc] = [b.url, ...FROGS.map(x => formLook('frog', x[0])!.url)].map(prof)
  ok(arc.min[2] < Math.min(base.min[2], rill.min[2], ara.min[2], ore.min[2]) - 0.3, `Croakarc: a skink's tail, the longest back by far (${arc.min[2].toFixed(3)})`)
  ok(arc.max[1] - arc.min[1] < 0.70 * (base.max[1] - base.min[1]) && arc.max[2] - arc.min[2] > 1.9, `Croakarc: LOW and long, a lizard (${(arc.max[1] - arc.min[1]).toFixed(3)} tall x ${(arc.max[2] - arc.min[2]).toFixed(3)} long)`)
  ok(arc.emax[1] < arc.max[1] + 0.05 && [base, rill, ara, ore].every(x => x.emax[1] > x.max[1] + 0.1), `Croakarc: no lure (the others' lure arches over the body)`)
  ok([base, rill, arc].every(x => ara.max[0] > x.max[0] + 0.05), `Croakara: the widest squat (${ara.max[0].toFixed(3)})`)
  ok([base, ara, ore].every(x => rill.max[1] - rill.min[1] > x.max[1] - x.min[1]), `Croakrill: the tallest frog body (${(rill.max[1] - rill.min[1]).toFixed(3)})`)
  ok(formGrow('croakore') > Math.max(...['croakrill', 'croakara', 'croakarc'].map(formGrow)) && ore.max[0] > base.max[0] + 0.05, 'Croakore: the heaviest (the biggest dial, wider than the base)')
  ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('frog', e)!.url)).size === 4, 'the Croakling line: four distinct forms') }

// M202 the Shellmere line: each form the base Shellmere's sculpt + rig re-shaped (18 bones, five clips), her own silhouette
{ const b = BASE_PREVIEW.turtle!, TURTLES: [SpiritElement, string][] = [['earth', 'mesamere'], ['mana', 'aurmere'], ['storm', 'voltmere'], ['water', 'tidemere']]
  const prof = (u: string) => { const { j } = glb(u), a = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]
    const e = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'eyes').primitives[0].attributes.POSITION]; return { max: a.max as number[], min: a.min as number[], emax: e.max as number[] } }
  for (const [el, name] of TURTLES) {
    const L = formLook('turtle', el)!
    ok(!!L && L.name === name && L.url === shellGlb(name) && L.url.endsWith('-rigged.glb') && L.url.includes(name) && L.form === el, `turtle ${el}: ${name} ${L?.url}`)
    ok(!!L.rig && L.rig !== b.rig && L.rig.neck === b.rig!.neck && L.rig.lie === b.rig!.lie && L.rig.glbLen > 1.2, `turtle ${el}: her own RigLook on the base's plan (glbLen ${L.rig?.glbLen})`)
    ok(Math.abs(L.h / b.h - formGrow(name)) < 1e-9 && formGrow(name) >= 1.4, `turtle ${el}: grows past the base (dial ${formGrow(name)})`)
    ok(L.skin.emissive !== b.skin.emissive && L.hull.color !== b.hull.color, `turtle ${el}: her element's tints`)
    ok(fs.existsSync('public' + L.url), `turtle ${el}: ${L.url} shipped`)
    const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
    // M202 11-28 Tidemere CARRIES HER OWN WATER (canon spirits-species.md): her own 14-bone rig, a flipper + blade bone per flipper and NO
    // leg / foot / paw bones (she never steps), no antennae; the other three keep the base's 18
    if (name === 'tidemere') ok(['body', 'eyes', 'b_root', 'b_shell', 'b_neck', 'b_head', 'b_lids', 'b_tail', 'b_flip0_l', 'b_blade0_r', 'b_flip1_r', 'b_blade1_l'].every(x => names.includes(x))
      && !names.some(x => /leg|foot|paw|ant/.test(x)) && j.skins?.[0]?.joints?.length === 14, `turtle water: Tidemere nodes + 14 bones, flippers only, no legs (${names.filter(x => x.startsWith('b_')).join(' ')})`)
    else ok(['body', 'eyes', 'b_root', 'b_shell', 'b_neck', 'b_head', 'b_lids', 'b_tail', 'b_ant_l', 'b_ant2_r', 'b_leg0_l', 'b_foot1_r'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 18, `turtle ${el}: nodes + 18 bones`)
    ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `turtle ${el}: clips ${clips}`)
    // the bind pose = her sculpt; Tidemere's SHELL_GLB_TALL is her glide rig's idle body (flippers lifted off her ground), lower than her
    // sculpt by 0.05-0.10 units (moved assert, 11-28: her sculpt is still the 0.581 the line was built at)
    const p = prof(L.url), top = p.max[1] - p.min[1]
    if (name === 'tidemere') ok(Math.abs(top / 0.581 - 1) < 0.06 && top - SHELL_GLB_TALL[name] > 0.04 && top - SHELL_GLB_TALL[name] < 0.11, `turtle water: sculpt ${top.toFixed(3)} ~ 0.581, rides at SHELL_GLB_TALL ${SHELL_GLB_TALL[name]} (flippers off the ground)`)
    else ok(Math.abs(top / SHELL_GLB_TALL[name] - 1) < 0.06, `turtle ${el}: body ${top.toFixed(3)} ~ SHELL_GLB_TALL ${SHELL_GLB_TALL[name]}`)
    ok(SHELL_GLB_TALL[name] * L.h > 0.30, `turtle ${el}: stands ${(SHELL_GLB_TALL[name] * L.h).toFixed(2)} m`)
    const [r, g, bb] = mean(col, n)
    ok(el === 'mana' ? bb > g + 25 && r > g + 10 : el === 'storm' ? bb > r + 20 && bb > g + 5 : el === 'earth' ? r > bb + 40 && g > bb + 25 : g > r + 50 && bb > r + 40, `turtle ${el}: her ${el} coat ${[r, g, bb].map(Math.round)}`)
  }
  const [base, mesa, aur, volt, tide] = [b.url, ...TURTLES.map(x => formLook('turtle', x[0])!.url)].map(prof)
  const tall = (x: typeof base) => x.max[1] - x.min[1], wide = (x: typeof base) => x.max[0] - x.min[0], long = (x: typeof base) => x.max[2] - x.min[2]
  ok([base, aur, volt, tide].every(x => tall(mesa) > tall(x) + 0.05) && formGrow('mesamere') > formGrow('aurmere'), `Mesamere: the tallest shell, the heaviest dial (${tall(mesa).toFixed(3)})`)
  ok([base, mesa, volt, tide].every(x => aur.emax[1] > x.emax[1] + 0.04) && [volt, tide].every(x => x.emax[1] < x.max[1] + 0.05), `Aurmere: antennae longer than the base's, the line's highest point; Voltmere + Tidemere carry none (${aur.emax[1].toFixed(3)})`)
  ok(wide(volt) > wide(base) + 0.15 && tall(volt) < tall(mesa) - 0.1, `Voltmere: wide and low (${wide(volt).toFixed(3)} x ${tall(volt).toFixed(3)})`)
  ok([base, mesa, aur, volt].every(x => long(tide) > long(x) + 0.1 && tall(tide) < tall(x) - 0.05), `Tidemere: a sea turtle, the longest and lowest (${long(tide).toFixed(3)} x ${tall(tide).toFixed(3)})`)
  ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('turtle', e)!.url)).size === 4, 'the Shellmere line: four distinct forms') }

// M202 the Lepara line: each form the base Lepara's sculpt + rig re-shaped (20 bones, five clips), her own silhouette
{ const b = BASE_PREVIEW.rabbit!, RABBITS: [SpiritElement, string][] = [['mana', 'lepaura'], ['storm', 'leparc'], ['earth', 'lepore'], ['water', 'lepnix']]
  const prof = (u: string) => { const { j } = glb(u), a = j.accessors[j.meshes.find((m: { name: string }) => m.name === 'body').primitives[0].attributes.POSITION]; return { max: a.max as number[], min: a.min as number[] } }
  for (const [el, name] of RABBITS) {
    const L = formLook('rabbit', el)!
    ok(!!L && L.name === name && L.url === `/open/spirits/${name}-rigged.glb` && L.form === el, `rabbit ${el}: ${name} ${L?.url}`)
    ok(!!L.rig && L.rig !== b.rig && L.rig.neck === b.rig!.neck && L.rig.lie === b.rig!.lie && L.rig.glbLen > 0.7, `rabbit ${el}: her own RigLook on the base's plan (glbLen ${L.rig?.glbLen})`)
    ok(Math.abs(L.h / b.h - formGrow(name)) < 1e-9 && formGrow(name) >= 1.4, `rabbit ${el}: grows past the base (dial ${formGrow(name)})`)
    ok(LEP_GLB_TALL[name] * L.h > 1.25 * 0.982 * b.h, `rabbit ${el}: stands taller than her base (${(LEP_GLB_TALL[name] * L.h).toFixed(2)} m vs ${(0.982 * b.h).toFixed(2)} m)`)
    ok(L.skin.emissive !== b.skin.emissive && L.hull.color !== b.hull.color, `rabbit ${el}: her element's tints`)
    ok(fs.existsSync('public' + L.url), `rabbit ${el}: ${L.url} shipped`)
    const { j, col, n } = glb(L.url), names = (j.nodes as { name: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
    ok(['body', 'eyes', 'b_root', 'b_hips', 'b_neck', 'b_head', 'b_lids', 'b_nose', 'b_tail', 'b_ear_l', 'b_ear2_r', 'b_arm_l', 'b_foot_r'].every(x => names.includes(x)) && j.skins?.[0]?.joints?.length === 20, `rabbit ${el}: nodes + 20 bones`)
    ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `rabbit ${el}: clips ${clips}`)
    const p = prof(L.url), top = p.max[1] - p.min[1]; ok(top > LEP_GLB_TALL[name] * 0.9 && top < LEP_GLB_TALL[name] * 1.15, `rabbit ${el}: rest body ${top.toFixed(3)} ~ LEP_GLB_TALL ${LEP_GLB_TALL[name]}`)
    const [r, g, bb] = mean(col, n)
    ok(el === 'mana' ? bb > g + 15 && r > g + 10 : el === 'storm' ? bb > r + 8 && bb > g : el === 'earth' ? r > bb + 40 && g > bb + 15 : g > r + 50 && bb > r + 40, `rabbit ${el}: her ${el} coat ${[r, g, bb].map(Math.round)}`)
  }
  const [base, aura, arc, ore, nix] = [b.url, ...RABBITS.map(x => formLook('rabbit', x[0])!.url)].map(prof)
  const wide = (x: typeof base) => x.max[0] - x.min[0], long = (x: typeof base) => x.max[2] - x.min[2]
  ok(formGrow('lepore') > Math.max(...['lepaura', 'leparc', 'lepnix'].map(formGrow)), 'Lepore: the heaviest dial (her natural element)')
  ok(long(aura) > long(base) + 0.05 && aura.min[2] < arc.min[2] - 0.05, `Lepaura: the plume tail reaches furthest back of the rabbits (${long(aura).toFixed(3)})`)
  ok(wide(arc) > wide(base) + 0.02, `Leparc: cheek tufts widen her face (${wide(arc).toFixed(3)} vs ${wide(base).toFixed(3)})`)
  ok(wide(ore) > wide(base) + 0.05, `Lepore: wider than the base (${wide(ore).toFixed(3)})`)
  ok(long(nix) > long(base) + 0.15 && nix.max[1] < base.max[1] - 0.05, `Lepnix: a foal, long and level, ears lower than the base's (${long(nix).toFixed(3)} x ${nix.max[1].toFixed(3)} vs ${base.max[1].toFixed(3)})`)
  ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('rabbit', e)!.url)).size === 4, 'the Lepara line: four distinct forms') }
// M202 11-28 LEPNIX'S OWN GAIT (trot_lepnix.py): the foal walks + trots on four two-bone legs. The rabbit clips she rode drew her leg
// joints out (run leg reach 2.7x) and hopped (root up 0.13, both hind legs in step). Read from her shipped glb's channels.
{ const b = fs.readFileSync('public/open/spirits/lepnix-rigged.glb'), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8)
  const f32 = (i: number) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], o = bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), n = a.count * ({ SCALAR: 1, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type]
    return new Float32Array(bin.buffer.slice(o, o + n * 4)) }
  const node = (n: string) => (j.nodes as { name: string }[]).findIndex(x => x.name === n)
  const track = (clip: string, n: string, path: string) => { const an = j.animations.find((a: { name: string }) => a.name === clip), ch = an?.channels.find((c: { target: { node: number; path: string } }) => c.target.node === node(n) && c.target.path === path)
    return ch ? f32(an.samplers[ch.sampler].output) : null }
  const comp = (t: Float32Array | null, k: number, w: number) => t ? Array.from({ length: t.length / w }, (_, i) => t[i * w + k]) : []
  const corr = (x: number[], y: number[]) => { const mx = x.reduce((a, c) => a + c, 0) / x.length, my = y.reduce((a, c) => a + c, 0) / y.length
    const c = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0); return c / (Math.sqrt(x.reduce((a, v) => a + (v - mx) ** 2, 0) * y.reduce((a, v) => a + (v - my) ** 2, 0)) || 1) }
  for (const clip of ['idle', 'walk', 'run', 'sit', 'lie']) { let dev = 0
    for (const n of ['b_paw_l', 'b_paw_r', 'b_foot_l', 'b_foot_r']) { const t = track(clip, n, 'translation'), r = j.nodes[node(n)].translation ?? [0, 0, 0]
      if (t) for (let i = 0; i < t.length; i++) dev = Math.max(dev, Math.abs(t[i] - r[i % 3])) }
    ok(dev < 1e-4, `Lepnix ${clip}: no leg joint is drawn out (knee + hock stay at their bind offset: ${dev.toFixed(4)})`) }
  const ry = comp(track('run', 'b_root', 'translation'), 1, 3)
  ok(ry.length > 10 && Math.max(...ry) - Math.min(...ry) < 0.05, `Lepnix run: no hop (root rise ${(Math.max(...ry) - Math.min(...ry)).toFixed(3)} glb units)`)
  for (const clip of ['walk', 'run']) { const c = corr(comp(track(clip, 'b_thigh_l', 'rotation'), 0, 4), comp(track(clip, 'b_thigh_r', 'rotation'), 0, 4))
    ok(c < 0.3, `Lepnix ${clip}: her hind legs are not in step (a hop moves both together): correlation ${c.toFixed(2)}`) }
  const ft = (clip: string) => comp(track(clip, 'b_arm_l', 'rotation'), 0, 4), fr = (clip: string) => comp(track(clip, 'b_arm_r', 'rotation'), 0, 4)
  for (const clip of ['idle', 'sit']) { const l = ft(clip), r = fr(clip), both = Math.max(...l.map((x, i) => Math.min(Math.abs(x), Math.abs(r[i] ?? 0))))
    ok(l.length > 10 && both < 0.2, `Lepnix ${clip}: no two-foreleg groom (both forelegs never lift together: ${both.toFixed(2)})`) } }

// ── picking ──
ok(formLook('fox', null) === null && formLook('fox', undefined) === null, 'no element = no form (her base)')
ok(formLook(null, 'mana') === null, 'no species = no form')
// M202: the whole Manalotl line is modelled (Marlotl, Aurlotl, Arclotl, Craglotl); see the line block above
ok(SPIRIT_ELEMENTS.every(e => !!formLook('firefly', e)), 'the last line modelled: no species keeps her base for a form any more')   // M202: was "a species whose forms are not modelled yet keeps her base" (Hovari, Lepara, then Luminara 11-28: all ten modelled)
// M202 Cragbear (the Dewbear line begins): her Earth form is modelled, the other three Dewbear forms are not yet
ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('water-bear', e)!.url)).size === 4, 'the Dewbear line: four distinct forms')
ok(Object.keys(SECOND_FORMS).sort().join() === 'axolotl,bat,firefly,fox,frog,hummingbird,owl,rabbit,turtle,water-bear', 'the Vulnyx line + the Manalotl line + the Dewbear line + the Noctyx line + the Athowl line + the Hovari line + the Croakling line + the Shellmere line + the Lepara line + the Luminara line')
ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('fox', e)!.url)).size === 4, 'four distinct forms')
// rigLook: a form stays itself when rigs are on; ?rig=0 (the frame measure) gives her species' old model, never a rigged glb unrigged
const v = formLook('fox', 'storm')!
ok(rigLook('fox', v, true) === v, 'rigLook keeps the form (rigs on)')
ok(rigLook('fox', v, false) === SPIRIT_MODELS.fox, 'rigLook ?rig=0 = the old model')
ok(rigLook('fox', spiritModelFor('fox')!, true) === SPIRIT_RIGS.fox, 'rigLook base unchanged')

console.log(`spirit-forms: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('FAIL', f)
process.exit(fails.length ? 1 : 0)
