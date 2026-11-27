// shared/gun-fit.ts (BETA M81 s2): a kit gun wears the sight it aims through today until the keeper fits another; only an owned
// sight on an owned kit gun fits; the fitting survives a save/load round trip; fp-gun draws the fitted model and aims through its
// optic; a gun without a rail is untouched.
//   npx tsx src/app/shimmer/open/shared/gun-fit.test.ts
import { defaultSight, fittedSight, fitSight, ownedSights, fittedModel, isKitGun, freeSights, addOwnedSight } from './gun-fit'
import { KIT_SIGHTS, kitModel } from './gun-kit'
import { newLoadout, setLoadout, type Loadout } from './loadout'
import { modelOf } from './fp-gun'
import { RANGE_GUNS } from './gunplay'
import { opticOf } from './optics'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }
const gun = (id: string) => RANGE_GUNS.find(g => g.id === id)!
const owning = (...ids: string[]): Loadout => ({ ...newLoadout(), guns: ids, kael: true })

// ── the default: the sight whose optic each gun aims through today (nothing changes for an old keeper) ──
for (const id of ['backbone', 'charred-rifle'] as const) {
  const d = defaultSight(id)
  ok(KIT_SIGHTS[d].optic === opticOf(gun(id)).id, `${id}: default sight ${d} aims through today's optic (${opticOf(gun(id)).id})`)
  ok(fittedSight(owning(id), id) === d, `${id}: nothing fitted -> the default`)
}
ok(fittedSight(owning('repeater'), 'repeater') === null && fittedModel(owning('repeater'), 'repeater') === null, 'a gun without a rail has no fitting')
ok(!isKitGun('repeater') && isKitGun('backbone'), 'isKitGun')

// ── fitting ──
const L = owning('backbone', 'repeater')
// M81 s3 -> M178: FREE = the irons (what it aims through today) + the gun's own; the 2x and the open lens are shop buys
ok(JSON.stringify(ownedSights(L, 'backbone')) === JSON.stringify(['irons', 'hood']), `free: the Backbone owns its irons + its hood only (${ownedSights(L, 'backbone')})`)
ok(JSON.stringify(freeSights('charred-rifle')) === JSON.stringify(['irons', 'ring']), 'free: the Charred Rifle owns its irons + its ring')
ok(!fitSight(L, 'backbone', 'scope2').ok, 'M178: the 2x is not free any more (s2 sells it)')
ok(!fitSight(L, 'backbone', 'lens').ok, 'the open lens is not free any more')
const bought = addOwnedSight(L, 'backbone', 'lens')
ok(ownedSights(bought, 'backbone').includes('lens') && fitSight(bought, 'backbone', 'lens').ok, 'bought: the lens joins the Backbone and fits')
ok(addOwnedSight(bought, 'backbone', 'lens') === bought, 'buying an owned sight twice changes nothing')
ok(!ownedSights(bought, 'charred-rifle').includes('lens'), 'a sight bought for one gun is not owned for another')
const ringOnBackbone = addOwnedSight(L, 'backbone', 'ring')
ok(fitSight(ringOnBackbone, 'backbone', 'ring').ok, "a shop can sell another rail's sight (the ring) for the Backbone")
// GRANDFATHERED (hub 11-22): a keeper who had the lens fitted before s3 keeps it
const old: Loadout = { ...L, fit: { backbone: { sight: 'lens' } } }
ok(fittedSight(old, 'backbone') === 'lens' && ownedSights(old, 'backbone').includes('lens'), 'grandfathered: a lens fitted before s3 stays fitted and owned')
const swapped = fitSight(old, 'backbone', 'hood')
ok(swapped.ok && ownedSights(swapped.loadout, 'backbone').includes('lens'), 'grandfathered: swapping the lens off keeps it owned (written into owned)')
if (swapped.ok) { const back = fitSight(swapped.loadout, 'backbone', 'lens'); ok(back.ok && fittedSight(back.loadout, 'backbone') === 'lens', 'and it fits back on') }
const f = fitSight(L, 'backbone', 'hood'), Lb = addOwnedSight(L, 'backbone', 'lens')
ok(f.ok && fittedSight(f.loadout, 'backbone') === 'hood', 'fit the hood')
ok(f.ok && L.fit === undefined, 'fitting never mutates the loadout it was given')
ok(!fitSight(L, 'backbone', 'ring').ok, "another gun's own sight is not owned for this rail (the ring)")
ok(!fitSight(L, 'backbone', 'nonsense').ok, 'an unknown sight is refused')
ok(!fitSight(L, 'charred-rifle', 'ring').ok, 'a gun you do not own is refused')
ok(!fitSight(L, 'repeater', 'lens').ok, 'a gun without a rail is refused')
if (f.ok) {
  const g2 = fitSight(addOwnedSight(f.loadout, 'backbone', 'lens'), 'backbone', 'lens')
  ok(g2.ok && fittedSight(g2.loadout, 'backbone') === 'lens', 'refit to the lens')
  // ── survives a save/load: the loadout is stored as JSON ──
  if (g2.ok) {
    const back = JSON.parse(JSON.stringify(g2.loadout)) as Loadout
    ok(fittedSight(back, 'backbone') === 'lens', 'the fitting survives a JSON round trip')
  }
  // a stored fitting that is no longer owned / valid falls back to the default
  ok(fittedSight({ ...L, fit: { backbone: { sight: 'ring' } } }, 'backbone') === defaultSight('backbone'), 'a stale fitting falls back to the default')
}

// ── the drawn model: fp-gun draws the fitted kit model and aims through its optic ──
const lensL = fitSight(Lb, 'backbone', 'lens')
if (lensL.ok) {
  setLoadout(lensL.loadout)
  const m = modelOf(gun('backbone'))
  ok(m.optic === 'reddot' && m.eye === kitModel('backbone', 'lens').eye, `fp-gun draws the Backbone with the lens (optic ${m.optic})`)
  ok(modelOf(gun('backbone')) === m, 'the same model object every frame (geometry is not rebuilt per frame)')
  const hood = fitSight(lensL.loadout, 'backbone', 'hood')
  if (hood.ok) { setLoadout(hood.loadout); ok(modelOf(gun('backbone')) !== m && modelOf(gun('backbone')).eye === kitModel('backbone', 'hood').eye, 'refitting changes the model in hand') }
  setLoadout(owning('backbone'))
  ok(modelOf(gun('backbone')).optic === opticOf(gun('backbone')).id && modelOf(gun('backbone')).optic === 'irons-long', 'no fitting: the Backbone aims through its irons (M178)')
  ok(fittedModel(owning('repeater'), 'repeater') === null && modelOf(gun('repeater')).optic === 'irons' && !!modelOf(gun('repeater')).post, 'the Repeater keeps its own body, on irons (M178)')
}


// ── M178: every gun's default sight is irons; the field persists; an old save keeps the sight it FITTED ──
for (const g of RANGE_GUNS) {
  const m = modelOf(g)
  ok((m.optic === 'irons' || m.optic === 'irons-long') && !!m.post, `${g.id}: by default its model aims through irons with a front post`)
  ok(!!m.post && m.post[0] === m.eye && m.post[1] < m.sightZ - 0.15, `${g.id}: the post tip is ON the sight line, well ahead of the rear notch (a pistol's sight radius at least)`)
}
for (const id of ['backbone', 'charred-rifle'] as const) ok(defaultSight(id) === 'irons' && fittedSight(owning(id), id) === 'irons', `${id}: nothing fitted -> irons`)
{ const f2 = fitSight(owning('backbone'), 'backbone', 'irons')
  ok(f2.ok && JSON.parse(JSON.stringify(f2.ok ? f2.loadout : null)).fit.backbone.sight === 'irons', 'the sight field is written to the save')
  if (f2.ok) { const back = JSON.parse(JSON.stringify(f2.loadout)) as Loadout; ok(fittedSight(back, 'backbone') === 'irons', 'and read back after a round trip') }
  const oldScope: Loadout = { ...owning('backbone', 'charred-rifle'), fit: { backbone: { sight: 'scope2' }, 'charred-rifle': { sight: 'lens', owned: ['lens'] } } }
  const rt = JSON.parse(JSON.stringify(oldScope)) as Loadout
  ok(fittedSight(rt, 'backbone') === 'scope2' && ownedSights(rt, 'backbone').includes('scope2'), 'an old save that fitted the 2x keeps it fitted and owned')
  ok(fittedSight(rt, 'charred-rifle') === 'lens', 'an old save that bought the lens keeps it fitted')
  const off = fitSight(rt, 'backbone', 'irons')
  ok(off.ok && ownedSights(off.loadout, 'backbone').includes('scope2'), 'swapping the fitted 2x for irons keeps the 2x owned') }

console.log(`gun-fit: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
