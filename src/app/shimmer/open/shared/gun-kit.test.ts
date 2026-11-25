// M81 blockout (gun-kit.ts): the rail + swappable-sight models. Run: npx tsx src/app/shimmer/open/shared/gun-kit.test.ts
import { KIT_GUNS, KIT_SIGHTS, kitModel, sightsFor, type KitGunId } from './gun-kit'
import { modelOf, previewGunModel, sightOf, adsPos } from './fp-gun'
import { OPTICS, adsFov, lensFov, viewFov } from './optics'
import { V2_GUNS, V2_SIGHTS, v2Model, type V2GunId } from './gun-kit-v2'
import { trisOf, modelGeometry } from './gun-kit-geo'
import { VM, GUN_DEFAULTS, defaultsFor, selectGunTune, GUN_TUNE_KEYS } from './fp-gun'
import { createHash } from 'node:crypto'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9)

const live = { backbone: modelOf({ id: 'backbone', slot: 'LONGBARREL' }), 'charred-rifle': modelOf({ id: 'charred-rifle', slot: 'LONGBARREL' }) }
for (const id of Object.keys(KIT_GUNS) as KitGunId[]) {
  const g = KIT_GUNS[id]
  // Alex's 11-22 hand values are offsets from grip / fore: the new bodies must keep the shipped anchors or the gloves float
  ok(same(g.grip, live[id].grip) && same(g.fore, live[id].fore), `${id}: grip/fore are the shipped longbarrel anchors (hand tune lands)`)
  ok(sightsFor(g)[0] === g.own && sightsFor(g).length >= 2, `${id}: takes its own sight plus at least one alternative`)
  for (const s of sightsFor(g)) {
    const m = kitModel(id, s), sight = KIT_SIGHTS[s]
    ok(m.parts.length === g.parts.length + sight.parts.length, `${id}+${s}: the sight is its own part set, seated on the gun`)
    ok(m.eye! > g.railTop && m.optic === sight.optic, `${id}+${s}: the sight line sits above the rail and names the sight's optic`)
    // the dot of a non-scope sight lies ON the sight line, so ADS puts it dead centre
    const dot = m.parts.filter(p => p.c === 'dot')
    ok(OPTICS[sight.optic].scoped || (dot.length === 1 && Math.abs(dot[0].o[1] - m.eye!) < 1e-9), `${id}+${s}: the etched mark is on the sight line`)
    ok(Math.abs(sightOf(m, OPTICS[sight.optic]).y - m.eye!) < 1e-9 && Number.isFinite(adsPos(m, OPTICS[sight.optic])[1]), `${id}+${s}: the rig aims down this sight line`)
  }
}
ok(sightsFor(KIT_GUNS.backbone)[0] !== sightsFor(KIT_GUNS['charred-rifle'])[0], 'each gun has its own issue sight')

// the live game is untouched: only the dev page's preview swaps a model in, and letting go restores the shipped one
const kit = kitModel('backbone', 'scope2')
previewGunModel('backbone', kit)
ok(modelOf({ id: 'backbone', slot: 'LONGBARREL' }) === kit, 'preview draws the kit model for that gun id')
ok(modelOf({ id: 'charred-rifle', slot: 'LONGBARREL' }) === live['charred-rifle'], 'preview touches no other gun')
previewGunModel('backbone', null)
ok(modelOf({ id: 'backbone', slot: 'LONGBARREL' }) === live.backbone, 'letting go restores the shipped model')

// ── M149 s1: the locked family (gun-kit-v2.ts), off in the game ──
// every model a player draws today, byte for byte as it was before M149 (verified against HEAD's data 11-24; change it only with a look Alex OK'd)
{ const all = [...(['SIDEARM', 'SHORTBARREL', 'LONGBARREL', 'BREACHER', 'REACHER'] as const).map(slot => modelOf({ id: 'x', slot })), live.backbone, live['charred-rifle'], ...Object.entries(KIT_GUNS).flatMap(([id, g]) => sightsFor(g).map(s => kitModel(id as KitGunId, s)))]
  ok(createHash('sha1').update(JSON.stringify(all)).digest('hex') === 'cc8dcb4a4cf7e9942e85f4298c84102af7350861', 'every model in the game is byte-identical to before M149: ' + createHash('sha1').update(JSON.stringify(all)).digest('hex')) }
const SLOT: Record<V2GunId, 'LONGBARREL' | 'REACHER'> = { backbone: 'LONGBARREL', 'charred-rifle': 'LONGBARREL', lance: 'REACHER' }
for (const g of Object.values(V2_GUNS)) {
  const shipped = modelOf({ id: 'x', slot: SLOT[g.id] })
  ok(same(g.grip, shipped.grip) && same(g.fore, shipped.fore), `new ${g.id}: grip/fore are the shipped anchors (a saved hand tune lands)`)
  const cols = new Set(g.parts.map(p => p.c)), low = Math.max(...g.parts.map(p => p.o[2] + p.s[2] / 2))
  ok(!cols.has('ember') && !cols.has('body') && low < 0.5, `new ${g.id}: dead metal, no lit seam, no rack colour`)
  ok(cols.has('core') === (g.id !== 'charred-rifle'), `new ${g.id}: ${g.id === 'charred-rifle' ? 'the Prototype takes no core' : 'a sigil core below'}`)
  ok(cols.has('cell') === (g.id === 'charred-rifle'), `new ${g.id}: the sealed cell is the Prototype's mark alone`)
  for (const s of g.sights) {
    const m = v2Model(g.id, s), si = V2_SIGHTS[s], t = trisOf(m), dot = m.parts.filter(p => p.c === 'dot')
    ok(v2Model(g.id, s) === m && m.parts.length === g.parts.length + si.parts.length, `new ${g.id}+${s}: the sight is its own part set, one cached object`)
    ok(t > 500 && t < 4500 && modelGeometry(m).size <= 12, `new ${g.id}+${s}: cheap (${t} tris, ${modelGeometry(m).size} draws)`)
    ok(dot.length === 1 && Math.abs(dot[0].o[1] - m.eye!) < 1e-9, `new ${g.id}+${s}: the mark is on the sight line`)
    const p = adsPos(m, OPTICS[si.optic]), z = p[2] + m.sightZ * VM.S
    ok(Math.abs(p[1] + m.eye! * VM.S) < 1e-9 && z < -0.1, `new ${g.id}+${s}: aimed, the sight sits on the camera's axis, clear of the lens's near plane`)
    ok(OPTICS[si.optic].scoped === false, `new ${g.id}+${s}: no full-screen scope ring`)
  }
}
// the prism: the view only punches in, the glass makes up the rest to a TRUE 3x; every optic worn today sees exactly adsFov
const tanH = (d: number) => Math.tan(d * Math.PI / 360), P = OPTICS.prism3
ok(Math.abs(tanH(75) / tanH(viewFov(75, P)) * (0.05 / 2 / 0.16) / tanH(lensFov(0.05, 0.16, P.mag / P.view!)) - 3) < 1e-9, 'prism: what is in the glass is a true 3x')
for (const o of ['reddot', 'scope2', 'scope3'] as const) ok(viewFov(75, OPTICS[o], 0.7) === adsFov(75, OPTICS[o], 0.7), `${o}: the view is unchanged`)
// an untuned gun's preview hold sits UNDER a saved or baked tune and goes when the preview goes
selectGunTune('charred-rifle'); previewGunModel('charred-rifle', v2Model('charred-rifle', 'ring'), V2_GUNS['charred-rifle'].hold)
ok(VM.S === 1.2, 'preview: an untuned gun wears the hold'); previewGunModel('charred-rifle', null)
ok(GUN_TUNE_KEYS.every(k => VM[k] === GUN_DEFAULTS[k]), 'preview off: back on the shipped numbers')
selectGunTune('backbone'); previewGunModel('backbone', v2Model('backbone', 'holo'), { S: 9, HIP_X: 9 })
ok(GUN_TUNE_KEYS.every(k => VM[k] === defaultsFor('backbone')[k]), "a hold never beats Alex's baked numbers"); previewGunModel('backbone', null)

console.log(`gun-kit: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
