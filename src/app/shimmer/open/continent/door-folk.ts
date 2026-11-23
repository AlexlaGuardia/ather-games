// ── TALKERS STAND OUTSIDE THEIR DOORS (BETA M26, Alex 11-18) ─────────────────────────────────────────────────────────
// "while we are still working things out to keep it simple on nyx side all buildings can be menus like we established but
// if there's an npc the player speaks with we put them right outside the building for now". So every door that TALKS
// (door-talk.ts: a runesmith's counter, the Enchant Temple's Idony, the Co.'s clerk) gets the Alkin rig
// (shared/folk-model.tsx) standing a step out from its door, facing the street; the talk bubble and the camera aim at
// that body's head. Pure: placement only (door-folk.test.ts); door-folk-scene.tsx draws it.
import { doorsCached, type Door } from '../business/doors'
import { FOLK_HEIGHT, FOLK_EYE_Y } from '../shared/folk-model'
import type { Region } from '../region'

/** The doors that open a conversation, not a panel (the same three continent/page.tsx openDoor routes to talk). */
// M73 s3: Veyra, the harbor-master, stands at the Travelers Station (she talks there while the opening chain has lines for her)
export const isTalkDoor = (key: string) => key.startsWith('smith:') || key === 'front:enchant-temple' || key === 'front:trade-co' || key === 'front:station'
/** Where the talker stands (m): BESIDE the door, not in it. The keeper walks up to the door to press E, so a talker in
 *  the doorway put the keeper (and the talk camera) inside their body (the first devwin shot, 11-18). OUT = a little in
 *  front of the wall, SIDE = to the door's left (from the street), clear of the doorway and the frame's lantern. */
export const STAND_OUT = 0.8, STAND_SIDE = 1.5
/** The spot the talker turns toward: where a keeper stands to talk (a step out from the door). */
export const KEEPER_OUT = 1.6

export interface Talker { key: string; look: string; name: string; x: number; y: number; z: number; yaw: number }

/** Where a door's talker stands: beside the door, turned to the keeper standing in front of it. */
export function standOf(d: Pick<Door, 'key' | 'b' | 'at' | 'name'>): Talker {
  const dx = d.at.x - d.b.x, dz = d.at.z - d.b.z, l = Math.hypot(dx, dz) || 1
  const ux = dx / l, uz = dz / l, lx = -uz, lz = ux   // u: out of the building; l: along the wall
  const look = d.key === 'front:enchant-temple' ? 'idony' : d.key === 'front:trade-co' ? 'co-clerk' : d.key === 'front:station' ? 'veyra' : `runesmith-${d.key.slice('smith:'.length)}`
  const name = d.key === 'front:enchant-temple' ? 'Idony' : d.key === 'front:trade-co' ? 'Clerk' : d.key === 'front:station' ? 'Veyra' : d.name
  const x = d.at.x + ux * STAND_OUT + lx * STAND_SIDE, z = d.at.z + uz * STAND_OUT + lz * STAND_SIDE
  const kx = d.at.x + ux * KEEPER_OUT, kz = d.at.z + uz * KEEPER_OUT
  return { key: d.key, look, name, x, y: d.at.y, z, yaw: Math.atan2(kx - x, kz - z) }
}
/** The talk bubble's anchor: over the talker's head. */
export const headOf = (t: Talker) => ({ x: t.x, y: t.y + FOLK_HEIGHT + 0.45, z: t.z })
/** Where the talk camera looks: the talker's face (the bubble sits above it; aiming at the bubble put the face at the frame's foot). */
export const faceOf = (t: Talker) => ({ x: t.x, y: t.y + FOLK_EYE_Y, z: t.z })

/** Every talker on the continent (cached per region). */
const cache = new WeakMap<Region, Talker[]>()
export function talkersOf(R: Region): Talker[] {
  let t = cache.get(R)
  if (!t) { t = R.meta.places.flatMap(p => doorsCached(R, p.id).filter(d => isTalkDoor(d.key)).map(standOf)); cache.set(R, t) }
  return t
}
