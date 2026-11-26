// M202 s1: the Vulnyx line's four SECOND FORMS (Vulnara / Vulnarc / Vulnore / Vulnix) and how an evolved spirit picks hers.
// Run: npx tsx src/app/shimmer/open/ather/spirit-forms.test.ts
// Reads the shipped glbs: each form is rigged on the Vulnyx's own M132 plan (same bones, every clip), is bigger than her base
// (every evolution grows the spirit: spirits-species.md, Spirit Scale), and carries the coat of its locked picture.
import * as fs from 'fs'
import { SECOND_FORMS, formGrow, SPIRIT_ELEMENTS, SPIRIT_MODELS, SPIRIT_RIGS, formLook, rigLook, spiritModelFor } from './spirit-models'

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
// her base form's coat is gold: a second form never ships the base colours by mistake
{ const { col, n } = glb(SPIRIT_RIGS.fox!.url), [r, g, b] = mean(col, n); ok(r > b + 60 && g > b, `base Vulnyx stays gold ${[r, g, b].map(Math.round)}`) }

// ── picking ──
ok(formLook('fox', null) === null && formLook('fox', undefined) === null, 'no element = no form (her base)')
ok(formLook(null, 'mana') === null, 'no species = no form')
ok(formLook('axolotl', 'water') === null, 'a species whose forms are not modelled yet keeps her base')
ok(Object.keys(SECOND_FORMS).length === 1, 'slice 1 = the Vulnyx line only')
ok(new Set(SPIRIT_ELEMENTS.map(e => formLook('fox', e)!.url)).size === 4, 'four distinct forms')
// rigLook: a form stays itself when rigs are on; ?rig=0 (the frame measure) gives her species' old model, never a rigged glb unrigged
const v = formLook('fox', 'storm')!
ok(rigLook('fox', v, true) === v, 'rigLook keeps the form (rigs on)')
ok(rigLook('fox', v, false) === SPIRIT_MODELS.fox, 'rigLook ?rig=0 = the old model')
ok(rigLook('fox', spiritModelFor('fox')!, true) === SPIRIT_RIGS.fox, 'rigLook base unchanged')

console.log(`spirit-forms: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('FAIL', f)
process.exit(fails.length ? 1 : 0)
