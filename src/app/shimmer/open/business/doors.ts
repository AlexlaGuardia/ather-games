// THE DOORS YOU CAN E on the waking continent (play lane, 2026-11-16). PURE (node-safe): which buildings carry a lit
// door and what is behind each. MarketView (market-view.tsx) draws them and handles reach; the page routes the key:
//   · a market lot (key = its lot id) → the deed card
//   · a canon storefront (key `front:<id>`) → its panel (shop-panel.tsx)
//   · a school seat's runesmith (key `smith:<seat>`) → the runesmith's counter (smith-panel.tsx)
import type { Region } from '../region'
import { cachedPlan } from '../foot-solids'
import type { Building } from '../towns/plan'
import { shopDoorPoint } from '../towns/shop-door'
import { marketFor, type Offer } from './market'
import { SEATS, type Seat } from './letters'
import { makeOfTown } from './courser-lot'

export type ShopKind = 'tavern' | 'inn' | 'smithy' | 'cafe' | 'books' | 'station' | 'exchange' | 'temple' | 'smokehouse' | 'shipyard' | 'trade-co' | 'gunshop' | 'courseryard' | 'courserlot' | 'corkhouse'
export const FRONT_SHOPS: Record<string, { name: string; kind: ShopKind; line?: string }> = {
  'kindled-mug': { name: 'The Kindled Mug', kind: 'tavern', line: 'A tavern on the square.' },
  'forgelight-inn': { name: 'The Forgelight Inn', kind: 'inn', line: 'Iron fixtures and forge-warmed walls.' },
  smithy: { name: 'The Smithy', kind: 'smithy', line: 'Steam and the smell of hot metal.' },
  'spirit-corner': { name: 'The Spirit Corner', kind: 'cafe' },
  bookstore: { name: "Eyuun's Bookstore", kind: 'books', line: "The house of tales. The world's stories, read and heard." },
  station: { name: 'Travelers Station', kind: 'station' },
  'enchant-temple': { name: 'Enchant Temple', kind: 'temple', line: 'Permanent imbuing, by twin hands.' },
  'grand-exchange': { name: 'The Grand Exchange', kind: 'exchange', line: 'The trade at the centre of the capital.' },
  // THE SMOKEHOUSE (RULED 11-17, world/cuisine.md): farmed meat by the bundle, one name across the continent's towns. It has
  // no facade in the town kit: like a runesmith it takes a plain building near the town's heart (doorsOf). Stock: ather/cooking.ts.
  smokehouse: { name: 'The Smokehouse', kind: 'smokehouse', line: 'Farmed meat by the bundle, smoked and wrapped for the road.' },
  // THE SHIPYARD (canon timeline 1672: the keeper inherits the shipyard, a broken ship, the Charred Rifle and Kael's ledger;
  // CANON_GAPS 11-15: Kael leaves the rifle there). Alex 11-18: it hands over the keeper's first weapons. Rune Hold only.
  shipyard: { name: 'The Shipyard', kind: 'shipyard', line: "Kael's yard. A broken ship in the slip." },   // @lark draft 11-18, awaiting Alex sign-off
  // THE CO.'S CITADEL OFFICE (Alex 11-18; Magii 49d8a0f AFK, world/gates.md: the door reads the house's own name, an Alkin clerk at
  // the counter, Lingston stays the HQ). Its panel is the contract board (continent/page.tsx), not a ShopPanel. Citadel only.
  'trade-co': { name: 'Ather Trading Co.', kind: 'trade-co', line: 'Haul contracts posted within. Goods paid in Marks.' },   // line: SIGNED 11-18 (athernyx c953f92, clerk script §1; business/co-lines.ts CO_SIGN_SMALL)
  // THE GUN SHOP (RULED 11-15, world/rune-hold.md): sells the five base guns at a counter; more of them in other towns. No proper
  // name, no keeper: the UI says "The gun shop". Like the smokehouse it takes a plain building (doorsOf). Stock: business/gun-shop.ts.
  gunshop: { name: 'The gun shop', kind: 'gunshop' },
  // THE COURSER YARD (BETA M14, Magii RULED 11-18: a town craft-shop of the courser trade, no named maker, a plain trade name; it
  // sells the Core / Trim / Rune part ladders). Every town with a gun shop. Stock: business/courser-yard.ts.
  courseryard: { name: 'The courser yard', kind: 'courseryard' },
  // THE COURSER LOT (BETA M14, Alex 11-18; makes + models RULED 11-18, athernyx 3846c94: the lot keeps a plain trade name).
  // One per make, in its town (business/courser-lot.ts MAKES): whole coursers for Marks.
  courserlot: { name: 'The courser lot', kind: 'courserlot' },
  // THE CORKHOUSE (RULED 11-21, game/alchemy.md › THE ALCHEMY SET): the continent's potion shop, one name in every town that has
  // one; the ONLY place a keeper sells bottles. The first stands in Rune Hold, by the shipyard; the rest are Jin's to place (later).
  // No door line yet (none is signed). Buys: business/corkhouse.ts.
  corkhouse: { name: 'The Corkhouse', kind: 'corkhouse' },
}

/** a door you can E: a market lot (key = lot id → the deed card) or a canon storefront (key = `front:<id>` → its panel) */
export interface Door { key: string; b: Building; name: string; at: { x: number; y: number; z: number }; offer?: Offer }

/** every door in a town: its market's lots + the storefronts the town kit stands (not the Fallen Cap: its own hall) */
function doorsOf(R: Region, townId: string): Door[] {
  const i = R.meta.places.findIndex(p => p.id === townId)
  const out: Door[] = marketFor(R, townId).map(o => ({ key: o.lot.id, b: o.b, name: o.name, at: shopDoorPoint(o.b), offer: o }))
  if (i >= 0) for (const b of cachedPlan(R, i).buildings) if (b.front && FRONT_SHOPS[b.front]) out.push({ key: `front:${b.front}`, b, name: FRONT_SHOPS[b.front].name, at: shopDoorPoint(b) })
  // a RUNESMITH at a school's seat (business/letters.ts SEATS): the town's building nearest its heart that is not already
  // a storefront or a market lot (Veradyn: nearest the Barrier Temple's isle). Jin's placement; Alex can pick another.
  const seat = (Object.keys(SEATS) as Seat[]).find(k => k !== 'enchant' && SEATS[k].place === townId)
  if (seat && i >= 0) {
    const plan = cachedPlan(R, i), taken = new Set(out.map(d => d.b))
    const at = plan.temple ?? { x: plan.buildings.length ? plan.buildings.reduce((a, b) => a + b.x, 0) / plan.buildings.length : R.meta.places[i].x, z: plan.buildings.length ? plan.buildings.reduce((a, b) => a + b.z, 0) / plan.buildings.length : R.meta.places[i].z }
    const b = plan.buildings.filter(x => !x.front && !taken.has(x)).sort((p, q) => Math.hypot(p.x - at.x, p.z - at.z) - Math.hypot(q.x - at.x, q.z - at.z))[0]
    if (b) out.push({ key: `smith:${seat}`, b, name: `${SEATS[seat].name} runesmith`, at: shopDoorPoint(b) })
  }
  // THE SMOKEHOUSE in every town (one name across towns, canon): the plain building nearest the town's heart that nothing
  // else holds (after the runesmith, so a seat town's runesmith keeps the door it had). Jin's placement.
  if (i >= 0) {
    const plan = cachedPlan(R, i), taken = new Set(out.map(d => d.b))
    const free = plan.buildings.filter(x => !x.front && !taken.has(x))
    if (free.length) {
      const at = plan.temple ?? { x: free.reduce((a, b) => a + b.x, 0) / free.length, z: free.reduce((a, b) => a + b.z, 0) / free.length }
      const b = free.sort((p, q) => Math.hypot(p.x - at.x, p.z - at.z) - Math.hypot(q.x - at.x, q.z - at.z))[0]
      out.push({ key: `front:smokehouse:${townId}`, b, name: FRONT_SHOPS.smokehouse.name, at: shopDoorPoint(b) })
    }
  }
  // THE GUN SHOP in every town that has a smokehouse except the Passage (its shop is in its cave): the free plain building nearest
  // the heart that nothing else holds, computed after the smokehouse so it takes a different building. Jin's placement.
  if (i >= 0 && townId !== 'passage' && out.some(d => d.key === `front:smokehouse:${townId}`)) {
    const plan = cachedPlan(R, i), taken = new Set(out.map(d => d.b))
    const free = plan.buildings.filter(x => !x.front && !taken.has(x))
    if (free.length) {
      const at = plan.temple ?? { x: free.reduce((a, b) => a + b.x, 0) / free.length, z: free.reduce((a, b) => a + b.z, 0) / free.length }
      const b = free.sort((p, q) => Math.hypot(p.x - at.x, p.z - at.z) - Math.hypot(q.x - at.x, q.z - at.z))[0]
      out.push({ key: `front:gunshop:${townId}`, b, name: FRONT_SHOPS.gunshop.name, at: shopDoorPoint(b) })
    }
  }
  // THE SHIPYARD: Rune Hold only (where the keeper arrives, canon), on the town's OUTSKIRTS: the free plain building farthest
  // from its heart. Jin's placement; Alex can pick another.
  if (i >= 0 && townId === 'rune-hold') {
    const plan = cachedPlan(R, i), taken = new Set(out.map(d => d.b))
    const free = plan.buildings.filter(x => !x.front && !taken.has(x))
    if (free.length) {
      const at = plan.temple ?? { x: R.meta.places[i].x, z: R.meta.places[i].z }
      const b = free.sort((p, q) => Math.hypot(q.x - at.x, q.z - at.z) - Math.hypot(p.x - at.x, p.z - at.z))[0]
      out.push({ key: 'front:shipyard', b, name: FRONT_SHOPS.shipyard.name, at: shopDoorPoint(b) })
    }
  }
  // THE COURSER YARD in every town with a gun shop, on the town's EDGE (a yard wants room for coursers): the free plain building
  // farthest from the heart that nothing else holds, computed after the shipyard so Rune Hold's outskirts stay Kael's. Jin's placement.
  if (i >= 0 && out.some(d => d.key === `front:gunshop:${townId}`)) {
    const plan = cachedPlan(R, i), taken = new Set(out.map(d => d.b))
    const free = plan.buildings.filter(x => !x.front && !taken.has(x))
    if (free.length) {
      const at = plan.temple ?? { x: R.meta.places[i].x, z: R.meta.places[i].z }
      const b = free.sort((p, q) => Math.hypot(q.x - at.x, q.z - at.z) - Math.hypot(p.x - at.x, p.z - at.z))[0]
      out.push({ key: `front:courseryard:${townId}`, b, name: FRONT_SHOPS.courseryard.name, at: shopDoorPoint(b) })
    }
  }
  // THE COURSER LOT in its make's town (MAKES), on the town's edge like the yard: the next free plain building farthest from the
  // heart, computed after the yard. Jin's placement.
  if (i >= 0 && makeOfTown(townId)) {
    const plan = cachedPlan(R, i), taken = new Set(out.map(d => d.b))
    const free = plan.buildings.filter(x => !x.front && !taken.has(x))
    if (free.length) {
      const at = plan.temple ?? { x: R.meta.places[i].x, z: R.meta.places[i].z }
      const b = free.sort((p, q) => Math.hypot(q.x - at.x, q.z - at.z) - Math.hypot(p.x - at.x, p.z - at.z))[0]
      out.push({ key: `front:courserlot:${townId}`, b, name: FRONT_SHOPS.courserlot.name, at: shopDoorPoint(b) })
    }
  }
  // THE CO.'S OFFICE: the Citadel only, the free plain building NEAREST the Grand Exchange (the Co. → GE spine, canon). Jin's
  // placement; Alex can pick another.
  if (i >= 0 && townId === 'citadel') {
    const plan = cachedPlan(R, i), taken = new Set(out.map(d => d.b))
    const ge = plan.buildings.find(x => x.front === 'grand-exchange')
    const free = plan.buildings.filter(x => !x.front && !taken.has(x))
    if (ge && free.length) {
      const b = free.sort((p, q) => Math.hypot(p.x - ge.x, p.z - ge.z) - Math.hypot(q.x - ge.x, q.z - ge.z))[0]
      out.push({ key: 'front:trade-co', b, name: FRONT_SHOPS['trade-co'].name, at: shopDoorPoint(b) })
    }
  }
  // THE CORKHOUSE: Rune Hold, BY THE SHIPYARD (canon): the free plain building nearest Kael's yard, computed AFTER every other door
  // so none of them moves. Jin's placement; Alex can pick another. (M49 s4 8f828e9e deleted this with the bought-shipyard block; restored 11-22.)
  if (i >= 0 && townId === 'rune-hold') {
    const plan = cachedPlan(R, i), taken = new Set(out.map(d => d.b)), yard = out.find(d => d.key === 'front:shipyard')
    const free = plan.buildings.filter(x => !x.front && !taken.has(x))
    if (yard && free.length) {
      const b = free.sort((p, q) => Math.hypot(p.x - yard.b.x, p.z - yard.b.z) - Math.hypot(q.x - yard.b.x, q.z - yard.b.z))[0]
      out.push({ key: 'front:corkhouse', b, name: FRONT_SHOPS.corkhouse.name, at: shopDoorPoint(b) })
    }
  }
  return out
}
const doorCache = new WeakMap<Region, Map<string, Door[]>>()
export function doorsCached(R: Region, townId: string): Door[] {
  let m = doorCache.get(R); if (!m) doorCache.set(R, m = new Map())
  let d = m.get(townId); if (!d) m.set(townId, d = doorsOf(R, townId))
  return d
}
export function doorByKey(R: Region, key: string): Door | undefined {
  const town = key.startsWith('front:') || key.startsWith('smith:') ? undefined : key.split(':')[0]
  if (town) return doorsCached(R, town).find(d => d.key === key)
  for (const p of R.meta.places) { const d = doorsCached(R, p.id).find(x => x.key === key); if (d) return d }
  return undefined
}

