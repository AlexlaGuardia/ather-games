// M109 s3 (sprites, 2026-11-23, owner + ?spirits=3d only): THE PARTY, managed from the grimoire's roster face. No React, no three.
// Canon (Magii RULED 9b4dfe8 / 0aee8bd / e14d48b / 2d9241e): EVERY bloomed spirit lives free in the garden, by temperament.
// The PARTY = up to 8 the keeper has asked along (word ruled: 'party'; 'chord' is the keepers' company, never this). Up to 3
// of the party come along (Follow, spirit-follow.ts FOLLOW_MAX). The grimoire MANAGES, never STORES: it sees every bloomed
// spirit, asks one along / lets one roam, and CALLS ONE HOME (she comes to the keeper on her own legs: spirit-trot call()).
// UI verbs: ask along / let roam / call. Never withdraw / deposit / store: nothing here holds a spirit, only a list of
// planter ids (the same ids Follow and the fed record key on), kept in localStorage.
import { gardenKey } from '@/lib/keeper-local'   // M109 s4: a garden key (the planters are the plot's), per account
import { setFollowing, isFollowing } from './spirit-follow'

export const PARTY_MAX = 8
const KEY = 'ather.spiritParty.v1'
let ids: string[] | null = null
const subs = new Set<() => void>()
function load(): string[] {
  if (ids) return ids
  try { const v = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? '[]'); ids = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, PARTY_MAX) : [] } catch { ids = [] }
  return ids
}
function save(next: string[]) {
  ids = next; try { localStorage.setItem(gardenKey(KEY), JSON.stringify(next)) } catch { /* private mode: this session only */ }
  for (const f of subs) f()
}
export const partyIds = (): readonly string[] => (typeof window === 'undefined' ? [] : load())
export const inParty = (id: string) => partyIds().includes(id)

/** pure: ask `id` along. 'full' = PARTY_MAX others are already in the party (nothing changes). */
export function withAsked(cur: readonly string[], id: string): string[] | 'full' {
  if (cur.includes(id)) return [...cur]
  if (cur.length >= PARTY_MAX) return 'full'
  return [...cur, id]
}
/** ask her along. false = refused: the party is full */
export function askAlong(id: string): boolean {
  const r = withAsked(load(), id); if (r === 'full') return false
  save(r); return true
}
/** let her roam: out of the party (and so no longer walking with the keeper either) */
export function letRoam(id: string) {
  if (isFollowing(id)) setFollowing(id, false)
  save(load().filter(x => x !== id))
}
export const subscribeParty = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

/** planter ids called home this moment: spirit-model.tsx takes one and she walks to the keeper (trot.call) */
export const spiritCall = new Set<string>()
// M124 s1: a spirit out of sight (not her bed's featured one, not in the party) is not drawn. Calling her home draws her
// at her bed for this session and she walks to the keeper the same way (no new mechanism, RULED ce34508 item 2).
let called: ReadonlySet<string> = new Set()   // replaced (never mutated) so a store snapshot sees the change
export const calledIds = (): ReadonlySet<string> => called
export function callHome(id: string) { spiritCall.add(id); if (!called.has(id)) { called = new Set([...called, id]); for (const f of subs) f() } }
