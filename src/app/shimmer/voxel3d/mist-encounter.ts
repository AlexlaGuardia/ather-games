// The mist encounter — who is standing in a patch right now, and what a spar leaves behind.
//
// ★ THE CANON THIS OBEYS (`CANON/game/shimmer-geography.md` › *The mist patches*, ruled 2026-08-09):
//  · A patch's roster describes the GROUND, not the species — see mist-roster.ts.
//  · **A spar TAKES NOTHING.** Spirits manifest via Mana Seeds and are never caught; they retreat,
//    they do not faint. So the fight ends with the other spirit WITHDRAWING into the mist, and this
//    module's whole job on the win path is to record a withdrawal — there is no capture step, no
//    roster addition, no "caught!" anywhere in this file, and there must never be one.
//  · A spar runs the real-time ARENA (`engine/arena.ts`) — the spirit fights on its own instinct and
//    the Keeper coaches. Not a move menu. That is the anti-collar thesis made mechanical.
//
// ★ WITHDRAWAL IS PER-PATCH AND PERSISTED, and re-draws what answers next. A patch you have just
// sparred goes quiet for a while; when its mist gathers again, the ground calls afresh — a
// different kind, often. That is why the ledger stores a COUNT and not just a timestamp: the count
// is the nonce `residentFor` re-rolls on, so "who is here now" stays pure math over (patch, count)
// and needs no stored species. Nothing about a resident is saved except how many times its patch
// has been answered.

import type { Species } from '../spirits/spirit'
import type { MistPatch } from '../voxel/mist'
import { residentFor, residentName, rosterFor, SPECIES_AFFINITY, type ZoneId } from './mist-roster'
import { answersInPair, residentLevel, secondLevel } from './mist-difficulty'
import { keeperKey } from '@/lib/keeper-local'

/** How long a sparred patch stays quiet before its mist gathers a new presence. */
export const WITHDRAW_MS = 10 * 60 * 1000

interface Entry { n: number; until: number }
export type MistLedger = Record<string, Entry>

/** Per keeper: which patches THIS keeper has drawn from. Family prefix, listed in `KEEPER_KEYS`. */
export const MIST_BASE = 'voxel3d:mist:'
const key = (seed: number) => keeperKey(`${MIST_BASE}${seed}`)
export const patchKey = (p: MistPatch): string => `${p.x},${p.z}`

/**
 * Load the ledger. A miss, a parse failure and private-mode all return an EMPTY ledger rather than
 * throwing — an unreadable ledger means "every patch has its first resident", which is the correct
 * degradation (you get an encounter you may have already had), never a crash on a world load.
 */
export function loadMistLedger(seed: number): MistLedger {
  try {
    const raw = localStorage.getItem(key(seed))
    if (!raw) return {}
    const v = JSON.parse(raw) as MistLedger
    return v && typeof v === 'object' ? v : {}
  } catch { return {} }
}

export function saveMistLedger(seed: number, l: MistLedger): void {
  try { localStorage.setItem(key(seed), JSON.stringify(l)) } catch { /* private mode: run unpersisted */ }
}

/** One manifested spirit — what the ground called, and how strongly. */
export interface ResidentForm {
  species: Species
  /** The canon display name — never the species code (the Native-World Law). */
  name: string
  element: 'mana' | 'storm' | 'earth' | 'water'
  /** Absolute, from the region's own band — never the party's average. See mist-difficulty.ts. */
  level: number
}

export interface Resident extends ResidentForm {
  patch: MistPatch
  /**
   * The second spirit that answered this gathering, or null. Decided by the GROUND alone — there is
   * no party-size gate, deliberately (mist-difficulty.ts says why). It is exposed on the resident
   * rather than conjured at spar time so the presence you see and the prompt you read describe the
   * fight you are about to take: a pair renders as two silhouettes and says so before you press E.
   */
  second: ResidentForm | null
}

/**
 * Who stands in this patch right now, or null — because the zone calls nothing (an unruled zone or
 * an unbanded one both fail closed), or because the patch is still quiet after a spar.
 */
export function residentAt(
  patch: MistPatch, zone: ZoneId | null | undefined, ledger: MistLedger, now: number,
): Resident | null {
  const roster = rosterFor(zone)
  if (!roster.length) return null
  const e = ledger[patchKey(patch)]
  if (e && now < e.until) return null                 // withdrawn — the mist has not gathered yet
  const n = e?.n ?? 0
  const species = residentFor(patch, zone, n)
  const level = residentLevel(patch, zone, n)
  if (!species || level === null) return null         // no band is as final as no roster
  const lead = { species, name: residentName(species), element: SPECIES_AFFINITY[species], level }
  return { patch, ...lead, second: secondForm(patch, zone, roster, lead, n) }
}

/**
 * The other one, when the ground calls a pair. Drawn from the SAME roster with a nonce of its own
 * and stepped past the lead's species, so a pair reads as two kinds answering one gathering rather
 * than a spirit and its copy — a roster of one can therefore never pair, which is also what
 * `answersInPair` refuses up front.
 */
function secondForm(
  patch: MistPatch, zone: ZoneId | null | undefined, roster: readonly Species[],
  lead: ResidentForm, nonce: number,
): ResidentForm | null {
  if (!answersInPair(patch, zone, nonce)) return null
  const alt = residentFor(patch, zone, nonce + 7919)
  if (!alt) return null
  const species = alt === lead.species ? roster[(roster.indexOf(alt) + 1) % roster.length] : alt
  return {
    species,
    name: residentName(species),
    element: SPECIES_AFFINITY[species],
    level: secondLevel(patch, zone, lead.level, nonce),
  }
}

/**
 * Record that a spar happened here: the spirit withdraws into the mist and the ground will call
 * afresh when it gathers. Returns a NEW ledger (callers persist it).
 *
 * ⚠ Called on EVERY exit — win, loss and flight alike. The other spirit withdrew in all three
 * cases; only the reason differs. Recording only on a win would leave a beaten keeper standing in
 * front of the spirit that just beat them, able to re-challenge it instantly, which reads as a bug
 * and is also the cheapest possible grind.
 */
export function recordWithdrawal(ledger: MistLedger, patch: MistPatch, now: number): MistLedger {
  const k = patchKey(patch)
  const prev = ledger[k]
  return { ...ledger, [k]: { n: (prev?.n ?? 0) + 1, until: now + WITHDRAW_MS } }
}

/** Minutes until a quiet patch gathers again — for the HUD line. 0 when it is already active. */
export function quietMinutes(ledger: MistLedger, patch: MistPatch, now: number): number {
  const e = ledger[patchKey(patch)]
  if (!e || now >= e.until) return 0
  return Math.max(1, Math.ceil((e.until - now) / 60000))
}
