// ── BETA M114 s2: THE GAME READS A PUBLISHED ZONE'S TAG (pure; zone-tags.test.ts). Glade only, like M84 s3. ──
// Alex 11-23: "a home ... who's with a dropdown, a shop with a dropdown, a supplier with a dropdown, or other for buildings that should
// be locked and empty inside". The tag (world/builder-zones.ts ZoneTag) rides in the published layer; this file turns it into ONE E point:
//   · There is no door piece among the zone build parts (furniture.ts has walls, floors, furniture, no door), so each tagged zone gets
//     ONE E point at its FRONT EDGE: the middle of that side, ZONE_DOOR_OUT m outside the rectangle (open ground, clear of the build).
//     M114 s3: the front is picked per zone in the tag popup (N/E/S/W); no pick = +z (S).
//   · OTHER    -> locked: E says so (a plain placeholder line), nothing to enter.
//   · SHOP     -> E opens THAT storefront's existing panel (business/shop-panel.tsx ShopPanel, the one its continent door opens).
//   · HOME     -> E shows "<Resident>'s home" and, when that NPC is in the Glade, opens their existing talk (homeTalk). NPCs do not move.
//   · SUPPLIER -> no supplier panel exists yet (M115): E shows "Supplier: <stand-in>" and nothing else.
// An untagged zone, or a tag whose shop / name is unknown, gets no E point (nothing true to say).
import { FRONT_SHOPS } from '../business/doors'
import { GOODS } from '../trade'
import type { Zone, ZoneTag } from '../../world/builder-zones'

export type ZoneUse =
  | { kind: 'locked' }
  | { kind: 'shop'; id: string; name: string }
  | { kind: 'home'; ref?: string; name: string }
  | { kind: 'supplier'; name: string }

/** how far outside the front edge the E point stands (m) */
export const ZONE_DOOR_OUT = 0.6

/** the zone's one E point: the middle of its FRONT edge, just outside. M114 s3: the front is the tag's picked edge (builder-zones
 *  ZoneFront: n = -z, e = +x, s = +z, w = -x); no pick = 's' (+z), where s2 put every E point. */
export function zoneDoor(z: Pick<Zone, 'x0' | 'x1' | 'z0' | 'z1'> & { tag?: Pick<ZoneTag, 'front'> | null }): { x: number; z: number } {
  const f = z.tag?.front ?? 's', mx = (z.x0 + z.x1) / 2, mz = (z.z0 + z.z1) / 2
  return f === 'n' ? { x: mx, z: z.z0 - ZONE_DOOR_OUT } : f === 'e' ? { x: z.x1 + ZONE_DOOR_OUT, z: mz } : f === 'w' ? { x: z.x0 - ZONE_DOOR_OUT, z: mz } : { x: mx, z: z.z1 + ZONE_DOOR_OUT }
}

/** what E does at a zone, from its tag (null = no E point) */
export function zoneUse(z: Pick<Zone, 'tag'>): ZoneUse | null {
  const t = z.tag
  if (!t) return null
  if (t.kind === 'other') return { kind: 'locked' }
  if (t.kind === 'shop') { const s = t.ref ? FRONT_SHOPS[t.ref] : undefined; return s && t.ref ? { kind: 'shop', id: t.ref, name: s.name } : null }
  if (t.kind === 'home') { const name = t.name?.replace(/\s*\([^)]*\)$/, '').trim();   // M84 s3b: a Wilds pick reads 'Name (Settlement)': the label is the name
    return name ? { kind: 'home', ...(t.ref ? { ref: t.ref } : {}), name } : null }
  if (t.kind === 'supplier') { const name = t.name?.trim() || (t.ref ? (GOODS as Record<string, { name: string } | undefined>)[t.ref]?.name : undefined); return name ? { kind: 'supplier', name } : null }
  return null
}

/** the E prompt at the zone's point */
export function zonePrompt(u: ZoneUse): string {
  return u.kind === 'locked' ? 'E · the door'
    : u.kind === 'shop' ? `E · ${u.name}`
    : u.kind === 'home' ? `E · ${u.name}'s home`
    : `E · Supplier: ${u.name}`
}

/** the message line E leaves (null = the shop: its panel says it) */
export function zoneSay(u: ZoneUse): string | null {
  return u.kind === 'locked' ? 'The door is locked.'
    : u.kind === 'home' ? `${u.name}'s home`
    : u.kind === 'supplier' ? `Supplier: ${u.name}`
    : null
}

/** whose existing talk a home's resident opens, given who stands in this map right now (null = nobody here: the label only) */
export type HomeTalk = { kind: 'greg' } | { kind: 'friend'; f: string } | { kind: 'fennel' } | { kind: 'folk' }
export function homeTalk(ref: string | undefined, here: { greg: boolean; friends: readonly string[]; fennel: string | null; folk: readonly string[] }): HomeTalk | null {
  if (!ref) return null
  if (ref === 'greg') return here.greg ? { kind: 'greg' } : null
  if (here.friends.includes(ref)) return { kind: 'friend', f: ref }
  if (here.fennel && ref === here.fennel) return here.folk.includes(ref) ? { kind: 'fennel' } : null
  if (here.folk.includes(ref)) return { kind: 'folk' }
  return null
}
