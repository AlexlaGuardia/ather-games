// M178 s2 (Alex 11-25: irons on every gun, "better sights are bought"): the 2x scope, the holo and the 3x prism are sold at the gun
// shops, each only for a gun whose rail takes it (M149: holo on the Backbone, the clean 3x prism on the Lance), fitted or taken off per
// gun, saved in the loadout. Run: npx tsx src/app/shimmer/open/business/sight-shop.test.ts
import { buySight, GUNSHOP_STOCK, SIGHT_PRICES } from './gun-shop'
import { fitSight, unfitSight, fittedSight, fittedModel, ownedSights, freeSights, sightFits, defaultSight } from '../shared/gun-fit'
import { KIT_GUNS, KIT_SIGHTS, sightsFor, kitModel, type KitGunId } from '../shared/gun-kit'
import { ironsFor } from '../shared/irons'
import { OPTICS, viewFov, adsFov } from '../shared/optics'
import type { Loadout } from '../shared/loadout'
import type { Ledger } from '../trade'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else { fails.push(l); console.log('  FAIL', l) } }
const L = (guns: string[]): Loadout => ({ v: 1, guns, primary: guns[0] ?? null, secondary: null, kael: true, vessels: [], tactical: null, signature: null } as unknown as Loadout)
const cash = (marks: number) => ({ marks } as Ledger)

// 1 · every sight a counter sells has a price, and fits the gun it is sold for; every bought-only sight on any rail is sold somewhere
const stocked = Object.entries(GUNSHOP_STOCK).flatMap(([town, s]) => s.sights.map(x => ({ town, ...x })))
for (const x of stocked) {
  ok(Number.isFinite(SIGHT_PRICES[x.sight]) && SIGHT_PRICES[x.sight] > 0, `${x.town}: ${x.sight} has a price`)
  ok(sightFits(x.gun, x.sight), `${x.town}: ${x.sight} is sold only for a gun that takes it (${x.gun})`)
}
for (const id of Object.keys(KIT_GUNS) as KitGunId[]) for (const s of sightsFor(KIT_GUNS[id])) {
  if (freeSights(id).includes(s)) continue
  ok(stocked.some(x => x.gun === id && x.sight === s), `${id}: the bought-only ${s} is sold at some counter`)
}
ok(SIGHT_PRICES.scope2 === 600 && SIGHT_PRICES.holo === 700 && SIGHT_PRICES.prism === 1200, 'the new prices: 2x 600, holo 700, prism 1200')
ok(SIGHT_PRICES.holo > SIGHT_PRICES.lens && SIGHT_PRICES.prism > SIGHT_PRICES.holo, 'a better sight costs more than the open lens; the 3x most')

// 2 · M149's fitting: holo on the Backbone + Lance, prism on the Lance + Backbone, neither on the Charred Rifle; the Lance takes no 2x
ok(sightFits('backbone', 'holo') && sightFits('backbone', 'prism') && sightFits('lance', 'prism') && sightFits('lance', 'holo'), 'holo + prism fit the Backbone and the Lance')
ok(!sightFits('charred-rifle', 'holo') && !sightFits('charred-rifle', 'prism') && !sightFits('lance', 'scope2') && !sightFits('lance', 'lens') && !sightFits('repeater', 'holo'), 'not on the Charred Rifle; the Lance takes no 2x / lens; a railless gun takes nothing')
ok(defaultSight('lance') === 'irons' && defaultSight('backbone') === 'irons' && defaultSight('charred-rifle') === 'irons', 'irons are every kit gun\'s default (M178)')

// 3 · buying: charges once, joins that gun's owned set, a second buy is refused and charges nothing
const bb = L(['backbone', 'lance', 'charred-rifle'])
const b1 = buySight(bb, cash(2000), 'ashfeld', 'backbone', 'holo')
ok(b1.ok && b1.ledger.marks === 2000 - SIGHT_PRICES.holo && ownedSights(b1.loadout, 'backbone').includes('holo'), 'Ashfeld: the holo for the Backbone, Marks down by its price once, owned')
const b2 = buySight(b1.loadout, b1.ledger, 'ashfeld', 'backbone', 'holo')
ok(!b2.ok && b2.ledger.marks === b1.ledger.marks, 'a second buy: refused, nothing charged')
ok(!ownedSights(b1.loadout, 'lance').includes('holo'), 'bought FOR the Backbone: the Lance does not own it')
ok(fittedSight(b1.loadout, 'backbone') === 'irons', 'buying does not fit it: the gun stays on its irons')
ok(!buySight(bb, cash(SIGHT_PRICES.prism - 1), 'gale-haven', 'lance', 'prism').ok, 'short Marks: the prism is refused')
ok(!buySight(L(['backbone']), cash(9999), 'gale-haven', 'lance', 'prism').ok, 'no Lance: its prism is refused')
// a forged stock row for a gun that cannot take the sight is still refused by the rail rule
GUNSHOP_STOCK.ashfeld.sights.push({ gun: 'charred-rifle', sight: 'holo' })
ok(!buySight(bb, cash(9999), 'ashfeld', 'charred-rifle', 'holo').ok, 'a stock row for a gun that cannot take the sight: refused')
GUNSHOP_STOCK.ashfeld.sights.pop()

// 4 · fit + unfit, saved per gun
const f1 = fitSight(b1.loadout, 'backbone', 'holo')
ok(f1.ok && fittedSight(f1.loadout, 'backbone') === 'holo', 'fit the holo on the Backbone')
const round = f1.ok ? JSON.parse(JSON.stringify(f1.loadout)) as Loadout : bb
ok(fittedSight(round, 'backbone') === 'holo' && fittedSight(round, 'lance') === 'irons', 'the fitting survives a save round trip, per gun (the Lance untouched)')
const u1 = unfitSight(round, 'backbone')
ok(u1.ok && fittedSight(u1.loadout, 'backbone') === 'irons' && ownedSights(u1.loadout, 'backbone').includes('holo'), 'take it off: back to the irons, still owned')
ok(!fitSight(bb, 'backbone', 'holo').ok, 'an unbought holo cannot be fitted')
const forged: Loadout = { ...bb, fit: { 'charred-rifle': { sight: 'holo', owned: ['holo'] }, lance: { sight: 'scope2', owned: ['scope2'] } } } as Loadout
ok(fittedSight(forged, 'charred-rifle') === 'irons' && fittedSight(forged, 'lance') === 'irons', 'a save naming a sight the gun cannot take draws the irons')
const fx = fitSight(forged, 'charred-rifle', 'holo')
ok(!fx.ok && fx.why === 'not-for-this-gun', 'fitting a sight not allowed for the gun is refused')

// 5 · ADS through a bought sight is that sight's own view (M149 s1 models, 3dc005f8)
const holoM = kitModel('backbone', 'holo'), prismM = kitModel('lance', 'prism')
ok(holoM.optic === 'reddot' && holoM.merge === true && holoM.adsK === 0.62 && holoM.cut === 'dot' && !holoM.lens, 'the holo: a 1x, its mark floating in the window, drawn merged')
ok(prismM.optic === 'prism3' && !!prismM.lens && prismM.cut === 'cross', 'the prism: a 3x with its picture inside the eyepiece, the cross cut')
const base = 75
ok(Math.abs(viewFov(base, OPTICS.prism3) - adsFov(base, { ...OPTICS.prism3, zoom: 1.1 })) < 1e-9 && viewFov(base, OPTICS.prism3) > adsFov(base, OPTICS.prism3) + 10, 'the prism: the keeper\'s view punches in only 1.1x, the 3x lives in the lens')
ok(Math.abs(viewFov(base, OPTICS['irons-long']) - adsFov(base, OPTICS['irons-long'])) < 1e-9, 'irons: the view is the irons\' own zoom (unchanged)')
const dot = holoM.parts.filter(p => p.c === 'dot')
ok(dot.length === 1 && Math.abs(dot[0].o[1] - holoM.eye!) < 1e-9, 'the holo mark sits on the sight line: ADS centres it')
ok(prismM.parts.length === KIT_GUNS.lance.parts.length + KIT_GUNS.lance.rail!.length + KIT_SIGHTS.prism.parts.length, 'the Lance\'s prism rides on its clamp-on mount')
ok(fittedModel(f1.ok ? f1.loadout : bb, 'backbone') === kitModel('backbone', 'holo') || fittedModel(f1.ok ? f1.loadout : bb, 'backbone')?.optic === 'reddot', 'the fitted Backbone draws the holo model')

// 6 · the Lance's irons are s1's exactly (it became a kit gun only to take a bought sight)
const ir = ironsFor(KIT_GUNS.lance.parts, -0.04 + 0.06, 'clean'), li = kitModel('lance', 'irons')
ok(Math.abs(li.eye! - ir.eye) < 1e-9 && Math.abs(li.post![1] - ir.frontZ) < 1e-9 && Math.abs(li.sightZ - ir.rearZ) < 1e-9 && li.optic === 'irons-long', 'the Lance on irons: the same notch, post and 1.3x as s1')
ok(!li.parts.some(p => KIT_GUNS.lance.rail!.includes(p)), 'no mount on the Lance until a sight is bought')

console.log(`sight-shop: ${pass} pass, ${fails.length} fail`)
process.exit(fails.length ? 1 : 0)
