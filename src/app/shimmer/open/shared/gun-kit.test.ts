// M81 blockout (gun-kit.ts): the rail + swappable-sight models. Run: npx tsx src/app/shimmer/open/shared/gun-kit.test.ts
import { KIT_GUNS, KIT_SIGHTS, kitModel, sightsFor, type KitGunId } from './gun-kit'
import { modelOf, previewGunModel, sightOf, adsPos } from './fp-gun'
import { OPTICS } from './optics'

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

console.log(`gun-kit: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
