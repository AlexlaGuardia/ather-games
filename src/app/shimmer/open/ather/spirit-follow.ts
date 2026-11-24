// M109 s1 (sprites, 2026-11-23): FOLLOW state + the live garden-spirit registry. No React, no three.
// Canon RULED 8b45c92: a keeper's spirits may walk with them anywhere in the Ather, never the mortal side. s1 = within the
// garden plot (the follow trot is held by the plot's own nav); leaving the plot is a later slice.
//  - FOLLOW: which planters' spirits walk with the keeper, by planter id, kept in localStorage (survives a reload).
//    Stores no spirit (glossary > Grimoire: a keeper knows spirits, never stores them): only "this one walks with me".
//  - KEEPER: where the keeper stands, written by the page's frame loop; the follow trot reads it.
//  - LIVE: where each drawn 3D spirit is this frame (by planter id), written by spirit-model.tsx; the page's E pick reads it.
//    Empty unless the owner + ?spirits=3d models are mounted, so nobody else ever gets a spirit talk.
import { gardenKey } from '@/lib/keeper-local'   // M109 s4: a garden key (the planters are the plot's), per account
import type { Species } from '../../spirits/spirit'
import { GROWN } from '../../sprites/creature-size'
import { bodyRadius } from './obstacles'
import { keeperTrail } from '../shared/keeper-trail'

const KEY = 'ather.spiritFollow.v1'
let ids: string[] | null = null
const subs = new Set<() => void>()
function load(): string[] {
  if (ids) return ids
  try { const v = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? '[]'); ids = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { ids = [] }
  return ids
}
export const followIds = (): readonly string[] => (typeof window === 'undefined' ? [] : load())
export const isFollowing = (id: string) => followIds().includes(id)
/** Alex 11-23 (hub): up to 3 spirits walk with the keeper at once; a 4th Follow is refused */
export const FOLLOW_MAX = 3
export const followFull = () => followIds().length >= FOLLOW_MAX
/** false = refused (already FOLLOW_MAX others follow) */
export function setFollowing(id: string, on: boolean): boolean {
  const cur = load()
  if (on && !cur.includes(id) && cur.length >= FOLLOW_MAX) return false
  const next = on ? [...cur.filter(x => x !== id), id] : cur.filter(x => x !== id)
  ids = next; try { localStorage.setItem(gardenKey(KEY), JSON.stringify(next)) } catch { /* private mode: this session only */ }
  for (const f of subs) f()
  return true
}
export const subscribeFollow = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

export const keeperAt = { x: 0, z: 0, yaw: 0, at: 0 }
/** `feet` (M126): the keeper's feet and whether they stand, noted on their trail (shared/keeper-trail.ts) */
export function setKeeperAt(x: number, z: number, yaw: number, feet?: number, grounded = true) {
  keeperAt.x = x; keeperAt.z = z; keeperAt.yaw = yaw; keeperAt.at = Date.now()
  if (feet !== undefined) keeperTrail.note(x, feet, z, grounded)
}

export type LiveSpirit = { id: string; sp: Species; x: number; y: number; z: number; h: number; at: number }
export const spiritLive = new Map<string, LiveSpirit>()
/** the spirits drawn in the last half second (an unmounted one drops out on its own) */
export const liveSpirits = (now = Date.now()) => [...spiritLive.values()].filter(s => now - s.at < 500)

/** M126 s4: the E pick's radius = her body's (long as well as tall), so a low long body is as easy to press E on as a tall one */
export const spiritPickR = (sp: Species, h: number) => Math.max(0.25, h * 0.6, bodyRadius(GROWN[sp] ?? { height: h }))

/** M109: the spirit a talk is on stands still (she listens) until the talk or her panel closes */
export const spiritHeld: { id: string | null } = { id: null }
