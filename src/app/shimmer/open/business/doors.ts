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

export type ShopKind = 'tavern' | 'inn' | 'smithy' | 'cafe' | 'books' | 'station' | 'exchange' | 'temple' | 'smokehouse' | 'shipyard'
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
  shipyard: { name: 'The Shipyard', kind: 'shipyard', line: "Kael's yard, left to you with a broken ship." },
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

