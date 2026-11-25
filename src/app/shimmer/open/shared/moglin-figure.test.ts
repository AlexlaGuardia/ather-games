// BETA M162: npx tsx src/app/shimmer/open/shared/moglin-figure.test.ts
import * as THREE from 'three'
import { readFileSync, readdirSync } from 'fs'
import { createHash } from 'crypto'
import { MOGLIN_LOOKS, MOGLIN_LOOK_CALLS, LOOK_COLOR, moglinFigure, moglinLook, holdPose } from './moglin-figure'
import { MOGLIN_ACTIONS, MOGLIN_HEIGHT, FUR_TONES, MOGLIN_BUILD, furOf, moglinPose, moglinBlink } from './moglin-model'
import { gladeFolk, GLADE_ID } from '../ather/moonwell-glade'
import { SETTLERS } from '../ather/first-settlement'
let n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error('✗ ' + m); process.exitCode = 1 } }
// ── who has a look of their own: these, in the Glade, and nobody else ───────────────────────────────────────────────────────
ok(gladeFolk(0).filter(f => moglinLook(f.id)).map(f => moglinLook(f.id)).sort().join() === [...MOGLIN_LOOKS].sort().join(), 'the Glade stands every look, once')
ok(gladeFolk(0).length === 5 && MOGLIN_LOOKS.length === 5 && gladeFolk(0).every(f => moglinLook(f.id)), 'all five of the Glade have a look: no plain Moglin stands there')
for (const k of MOGLIN_LOOKS) ok(moglinLook(`${GLADE_ID}:${k}`) === k, `${k}: by the Glade's id`)
for (const id of ['hazel', 'sax', 'yarrow', 'gloview:hazel', 'moonwell:hazel2', 'xmoonwell:sax', 'm70:yarrow', 'burr:sax', 'fennel', 'mallow', 'gloview:fennel', 'moonwell:mallow2', 'm70:mallow', 'otto', '', ...SETTLERS.map(s => s.id)]) ok(moglinLook(id) === null, `'${id}' is a plain Moglin`)
// ── the plain Moglin, as it was: pose, blink, coat and drawing are pinned to the code before M162 ───────────────────────────
const poses = MOGLIN_ACTIONS.map(a => [0, 0.4, 1.3, 2.9, 5, 5.6].map(t => moglinPose(a, t)))
ok(createHash('sha1').update(JSON.stringify(poses, (_, v) => (typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v))).digest('hex') === 'cfbe5dad07a4b63c55ac5eb88c5a2a2375ea73d4', 'every action poses as before')
ok(moglinBlink(0.1, 0) === 0.12 && moglinBlink(0.13, 0) === 1 && moglinBlink(3.75, 0) === 0.12, 'the blink')
ok(MOGLIN_BUILD === 'chibi' && Math.abs(MOGLIN_HEIGHT.chibi - 0.9092) < 1e-9, 'its height (the talk camera + bubble)')
ok(['gloview:a', 'm70:b', 'moonwell:fennel', 'moonwell:mallow', 'x1'].map(i => furOf(i).id).join() === 'clay,honey,clay,clay,fawn' && FUR_TONES.length === 5, 'its coat')
{ const src = readFileSync('src/app/shimmer/open/shared/moglin-model.tsx', 'utf8'), i = src.indexOf('  const fur = <meshStandardMaterial'); ok(i > 0 && createHash('sha1').update(src.slice(i)).digest('hex') === 'd063cab986e8a44331b98fa345e14919cdb5d3ac', 'the plain Moglin is drawn as before (re-pin only when its look is MEANT to change)') }
{ const A = 'src/app/shimmer/open/ather', users = readdirSync(A).filter(f => f.endsWith('.tsx') && /NamedMoglin|MoglinLookModel/.test(readFileSync(`${A}/${f}`, 'utf8'))); ok(users.sort().join() === 'fennel.tsx,glade-cluster-view.tsx,moglin-card-view.tsx', `looks are asked for in the Glade, the card and Fennel at the Rinnshop only (${users})`) }
// ── the figures ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
ok(MOGLIN_LOOK_CALLS < 35, 'fewer draw calls than the plain chibi')
const has = (g: THREE.BufferGeometry, hex: string) => { const c = new THREE.Color(hex), a = g.attributes.color; for (let k = 0; k < a.count; k++) if (Math.abs(a.getX(k) - c.r) + Math.abs(a.getY(k) - c.g) + Math.abs(a.getZ(k) - c.b) < 1e-3) return true; return false }
for (const id of MOGLIN_LOOKS) {
  const f = moglinFigure(id)
  ok(f === moglinFigure(id), `${id}: built once`)
  ok(Object.keys(f.joints).length * 2 + 2 === MOGLIN_LOOK_CALLS, `${id}: its draw calls`)
  let tris = 0, lo = Infinity, hi = 0
  for (const [n, J] of Object.entries(f.joints)) for (const g of [J.toon, J.ink]) {
    ok([...g.attributes.position.array].every(Number.isFinite), `${id}: finite`); tris += g.index!.count / 3
    if (g !== J.toon) continue
    g.computeBoundingBox(); if (!n.startsWith('ear')) lo = Math.min(lo, g.boundingBox!.min.y + J.at[1]); if (n === 'head') hi = g.boundingBox!.max.y + J.at[1]
    const P = g.attributes.position, N = g.attributes.normal, i = g.index!.array; let bad = 0
    for (let k = 0; k < i.length; k += 3) { const [a, b, c] = [0, 1, 2].map(q => new THREE.Vector3().fromBufferAttribute(P, i[k + q])), fn = b.clone().sub(a).cross(c.clone().sub(a)); if (fn.length() > 1e-9 && fn.dot(new THREE.Vector3().fromBufferAttribute(N, i[k])) < -1e-9) bad++ }
    ok(bad / (i.length / 3) < 0.02, `${id} ${n}: wound with its normals (${(bad / i.length * 300).toFixed(1)}% wrong)`)
  }
  ok(tris < 36000, `${id}: ${tris} triangles`)
  ok(Math.abs(lo) < 0.02, `${id}: feet on the ground (${lo.toFixed(3)})`)
  ok(hi > 0.84 && hi < MOGLIN_HEIGHT.chibi + 0.06, `${id}: the chibi's height (${hi.toFixed(3)})`)
  for (const [k, hex] of Object.entries(LOOK_COLOR[id])) ok([...Object.values(f.joints).map(J => J.toon), f.face, f.eyes].some(g => has(g, hex)), `${id}: ${k}`)
  const c = new THREE.Color(LOOK_COLOR[id].fur).getHSL({ h: 0, s: 0, l: 0 }); ok(c.s > 0.4 && c.h > 0.05 && c.h < 0.13, `${id}: earth fur, never grey`)
}
const [h, s, y, fe, ma] = MOGLIN_LOOKS.map(moglinFigure), L = (k: 'hazel' | 'sax' | 'yarrow') => new THREE.Color(LOOK_COLOR[k].fur).getHSL({ h: 0, s: 0, l: 0 }).l
ok(s.joints.armR.at[0] > h.joints.armR.at[0] && h.joints.armR.at[0] > y.joints.armR.at[0], 'Sax is the broad one, Yarrow the slight one')
ok(L('hazel') < L('sax') && L('sax') < L('yarrow'), 'chestnut, clay-tan, warm fawn')
// what they carry stays in their paws
for (const a of MOGLIN_ACTIONS) { const p = moglinPose(a, 1.1); const q = holdPose(p, s.holds, a); ok(q.aL[0] === s.holds!.pitch && (a === 'wave' ? q.aR === p.aR : q.aR[0] === s.holds!.pitch), `${a}: the stone stays held`); ok(holdPose(p, y.holds, a) === p, `${a}: Yarrow's paws are free`) }
ok(!!h.holds && h.holds.pitch < -0.8, 'Hazel carries her planks')
// ── Fennel + Mallow (s2) ────────────────────────────────────────────────────────────────────────────────────────────────────
ok(fe.joints.armR.at[0] > h.joints.armR.at[0] && fe.joints.armR.at[0] < s.joints.armR.at[0] && ma.joints.armR.at[0] === h.joints.armR.at[0], 'Fennel is plump (Sax still the broad one), Mallow plain built')
ok(has(fe.joints.head.toon, LOOK_COLOR.fennel.cloth) && MOGLIN_LOOKS.every(k => k === 'fennel' || !has(moglinFigure(k).joints.head.toon, LOOK_COLOR.fennel.cloth)), 'the headscarf is on Fennel, and only on her')
ok(has(fe.joints.body.toon, LOOK_COLOR.fennel.bowl) && has(fe.joints.body.toon, LOOK_COLOR.fennel.spoon) && has(fe.joints.body.toon, LOOK_COLOR.fennel.flour), 'her bowl, her spoon, flour on the apron')
ok(has(ma.joints.body.toon, LOOK_COLOR.mallow.cloth) && has(ma.joints.body.toon, LOOK_COLOR.mallow.leather) && has(ma.joints.body.toon, LOOK_COLOR.mallow.board) && has(ma.joints.body.toon, LOOK_COLOR.mallow.toggle), "Mallow's shawl, satchel (a wooden toggle), tally board")
{ const c = new THREE.Color(LOOK_COLOR.mallow.cloth).getHSL({ h: 0, s: 0, l: 0 }); ok(c.h > 0.78 && c.h < 0.95 && c.s < 0.45, 'the shawl is mauve') }
{ const hue = (k: keyof typeof LOOK_COLOR) => new THREE.Color(LOOK_COLOR[k].fur).getHSL({ h: 0, s: 0, l: 0 }).h; ok(MOGLIN_LOOKS.every(k => k === 'fennel' || hue('fennel') > hue(k) + 0.015), 'Fennel is the mossy one: the greenest gold of the five') }
for (const a of MOGLIN_ACTIONS) { const p = moglinPose(a, 1.1); for (const f of [fe, ma]) { const q = holdPose(p, f.holds, a); ok(!!f.holds && q.aL[0] === f.holds.pitch && (a === 'wave' ? q.aR === p.aR : q.aR[0] === f.holds.pitch), `${a}: the bowl / the board stays held`) } }
{ const far = (a: string, b: string) => { const x = new THREE.Color(a), y = new THREE.Color(b); return Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b) }; ok(MOGLIN_LOOKS.every((a, i) => MOGLIN_LOOKS.every((b, j) => i >= j || far(LOOK_COLOR[a].fur, LOOK_COLOR[b].fur) > 0.05)), 'five coats, each its own') }
console.log(`moglin-figure: ${n} checks${process.exitCode ? ' FAIL' : ' ok'}`)
