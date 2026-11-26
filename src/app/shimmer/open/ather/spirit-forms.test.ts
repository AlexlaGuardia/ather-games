// M202 s1: the Vulnyx line's four SECOND FORMS (Vulnara / Vulnarc / Vulnore / Vulnix) and how an evolved spirit picks hers.
// Run: npx tsx src/app/shimmer/open/ather/spirit-forms.test.ts
// Reads the shipped glbs: each form is rigged on the Vulnyx's own M132 plan (same bones, every clip), is bigger than her base
// (every evolution grows the spirit: spirits-species.md, Spirit Scale), and carries the coat of its locked picture.
import * as fs from 'fs'
import { type SpiritElement, AURLOTL_RIG, ARCLOTL_RIG, CRAGLOTL_RIG, LOTL_GLB_TALL, CRAGBEAR_GLB_TALL, CRAGBEAR_RIG, MARLOTL_RIG, SECOND_FORMS, formGrow, SPIRIT_ELEMENTS, SPIRIT_MODELS, SPIRIT_RIGS, formLook, rigLook, spiritModelFor } from './spirit-models'

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
{ const { col, n } = glb(SPIRIT_RIGS['water-bear']!.url), [r, g, b] = mean(col, n); ok(b >= r, `base Dewbear stays dew blue ${[r, g, b].map(Math.round)}`) }
// her base form's coat is gold: a second form never ships the base colours by mistake
{ const { col, n } = glb(SPIRIT_RIGS.fox!.url), [r, g, b] = mean(col, n); ok(r > b + 60 && g > b, `base Vulnyx stays gold ${[r, g, b].map(Math.round)}`) }

// ── picking ──
ok(formLook('fox', null) === null && formLook('fox', undefined) === null, 'no element = no form (her base)')
ok(formLook(null, 'mana') === null, 'no species = no form')
// M202: the whole Manalotl line is modelled (Marlotl, Aurlotl, Arclotl, Craglotl); see the line block above
ok(formLook('owl', 'earth') === null, 'a species whose forms are not modelled yet keeps her base')
// M202 Cragbear (the Dewbear line begins): her Earth form is modelled, the other three Dewbear forms are not yet
ok(formLook('water-bear', 'mana') === null && formLook('water-bear', 'storm') === null && formLook('water-bear', 'water') === null, 'a Dewbear form not modelled yet = her base')
ok(Object.keys(SECOND_FORMS).sort().join() === 'axolotl,fox,water-bear', 'the Vulnyx line + the Manalotl line + the Dewbear line')
ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('fox', e)!.url)).size === 4, 'four distinct forms')
// rigLook: a form stays itself when rigs are on; ?rig=0 (the frame measure) gives her species' old model, never a rigged glb unrigged
const v = formLook('fox', 'storm')!
ok(rigLook('fox', v, true) === v, 'rigLook keeps the form (rigs on)')
ok(rigLook('fox', v, false) === SPIRIT_MODELS.fox, 'rigLook ?rig=0 = the old model')
ok(rigLook('fox', spiritModelFor('fox')!, true) === SPIRIT_RIGS.fox, 'rigLook base unchanged')

console.log(`spirit-forms: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('FAIL', f)
process.exit(fails.length ? 1 : 0)
