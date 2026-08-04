// cast.ts — the cast layer: LOADOUT SLOT → MOVE → ARCHETYPE.
//
// ── THE CORRECTION THIS FILE IMPLEMENTS (Alex, 2026-08-03) ─────────────────────
// v2 mapped `birthRune → bolt archetype`: your rune WAS your attack. Alex killed that — "the birth
// rune sets the tone, the innate passive. It doesn't decide the tactical or the special." It also
// explained why casting felt redundant next to a gun: a coloured bolt is a worse gun, while
// Stonewall / Shackle / Cordon do what a gun cannot.
//
// The chain is now:
//   rune-inventory (runes you hold) → keeper-moves (the book, derived by inverting rune requirements)
//   → a LOADOUT SLOT (this file) → a cast archetype the sim can run.
//
// ── BOUNDARY ──────────────────────────────────────────────────────────────────
// Move NAMES + EFFECTS + rune requirements are canon (CANON/game/moves.md, transcribed in
// keeper-moves.ts). Which build archetype realises a move, and every number below, are Jin's.
//
// ★ COLOUR IS NOT HERE, ON PURPOSE. moves.md:5 — "Colour is never part of a move. Colour is the
//   mage's own — their soul-frequency — applied when they cast it." v2's CastSpec carried the RUNE's
//   glow, which is drift: two Storm-mages would have run the same Chain Lightning in two colours
//   because of their rune rather than their soul. The caster supplies the colour (SOUL_COLOR in
//   Shimmer3D), so no colour field exists on a CastSpec.
//
// ── HONESTY RULE ──────────────────────────────────────────────────────────────
// Every registered move gets an entry here. A move the sim cannot yet run is archetype 'unbuilt'
// WITH a reason — it is labelled as unbuilt in the HUD rather than silently doing nothing. A silent
// no-op is how the old ward/restore/surge tags read as "cast does nothing, must be a bug." The test
// asserts full coverage, so a newly authored canon move cannot slip through unclassified.

import { KEEPER_MOVES, type KeeperMove, type MoveTier, knownMoves } from './keeper-moves'

/** The archetypes the sim can actually run today, plus the honest 'unbuilt' tag. */
export type CastArchetype =
  | 'projectile'  // a travelling bolt: damage on contact (chains if `chain` > 0)
  | 'restore'     // instant self-heal
  | 'stance'      // a HELD passive — toggled on, pauses mana recovery while up (runes.md economy)
  | 'surge'       // a short self-buff burst (speed / evasion)
  | 'unbuilt'     // registered in canon, no sim behaviour yet — labelled, never a silent no-op

export interface CastSpec {
  /** keeper-moves id this spec realises */
  moveId: string
  /** canon move name, for the HUD */
  label: string
  tier: MoveTier
  archetype: CastArchetype
  manaCost: number
  cooldownMs: number
  // projectile
  damage: number
  projSpeed: number
  projLife: number
  /** extra targets a projectile jumps to on impact (Chain Lightning). 0 = no chain. */
  chain: number
  /** world-unit radius the chain searches from the struck target */
  chainRange: number
  // restore
  heal: number
  // stance
  /** fraction of incoming damage the held stance absorbs (0–1) */
  resist: number
  /** movement multiplier while held (Iron Skin refuses to move under a hit) */
  moveMult: number
  /** cast damage multiplier while held (Flame Manipulation shapes fire by instinct) */
  castMult: number
  /** mana per second the stance itself produces — the one thing that survives the recovery pause */
  manaPerSec: number
  /** canon: holding a passive PAUSES mana recovery. The double edge that makes it a stance. */
  pausesRecovery: boolean
  // surge
  /** seconds the surge lasts */
  surgeSecs: number
  /** speed multiplier during the surge */
  surgeMult: number
  /** why this move has no sim behaviour yet — only set on 'unbuilt' */
  why?: string
}

const BASE: Omit<CastSpec, 'moveId' | 'label' | 'tier' | 'archetype'> = {
  manaCost: 0, cooldownMs: 0,
  damage: 0, projSpeed: 0, projLife: 0, chain: 0, chainRange: 0,
  heal: 0,
  resist: 0, moveMult: 1, castMult: 1, manaPerSec: 0, pausesRecovery: false,
  surgeSecs: 0, surgeMult: 1,
}

/** per-move build spec, keyed by keeper-moves id. Numbers are Jin's and free to tune. */
type Build = Partial<CastSpec> & { archetype: CastArchetype }

const BUILDS: Record<string, Build> = {
  // ── Passives → stances. Held; each pauses mana recovery (runes.md's mana economy). ────────────
  barrier:   { archetype: 'stance', resist: 0.35, pausesRecovery: true, cooldownMs: 500 },
  bulwark:   { archetype: 'stance', resist: 0.55, moveMult: 0.9, pausesRecovery: true, cooldownMs: 500 },
  'flame-manipulation': { archetype: 'stance', castMult: 1.3, pausesRecovery: true, cooldownMs: 500 },
  // The one stance that FEEDS you: canon has it drawing water from the air over time. It still pauses
  // ordinary recovery (it is a passive) but produces its own slower trickle — held, you gain less than
  // standing idle would give you, which is the honest reading of both lines at once.
  'moisture-gathering': { archetype: 'stance', manaPerSec: 0.8, pausesRecovery: true, cooldownMs: 500 },
  'iron-skin': { archetype: 'stance', resist: 0.45, moveMult: 0.85, pausesRecovery: true, cooldownMs: 500 },
  'bind-mastery': { archetype: 'unbuilt', why: 'gatecraft + manatech — no runtime system yet' },
  'herbal-knowledge': { archetype: 'unbuilt', why: 'out-of-combat medicine; no combat behaviour' },

  // ── Tacticals ────────────────────────────────────────────────────────────────────────────────
  'static-burst': { archetype: 'surge', manaCost: 10, cooldownMs: 4500, surgeSecs: 2.5, surgeMult: 1.7 },
  firewall:       { archetype: 'unbuilt', why: 'needs a persistent area entity (area-denial volume)' },
  'flame-infusion': { archetype: 'unbuilt', why: 'needs a weapon-damage infusion hook' },
  mend:      { archetype: 'restore', manaCost: 22, cooldownMs: 6000, heal: 35 },
  'ice-dart': { archetype: 'projectile', manaCost: 7, cooldownMs: 650, damage: 18, projSpeed: 52, projLife: 1.4 },
  enlighten: { archetype: 'unbuilt', why: 'needs a blind/disorient status on the AI' },
  stonewall: { archetype: 'unbuilt', why: 'needs runtime terrain (a raised collidable volume)' },
  shackle:   { archetype: 'unbuilt', why: 'needs a root/disarm status on the AI' },
  'living-architecture': { archetype: 'unbuilt', why: 'needs runtime structures' },

  // ── Ultimates ────────────────────────────────────────────────────────────────────────────────
  'chain-lightning': { archetype: 'projectile', manaCost: 34, cooldownMs: 9000, damage: 26, projSpeed: 70, projLife: 1.2, chain: 3, chainRange: 9 },
  'flame-barrage': { archetype: 'unbuilt', why: 'needs independently tracking projectiles' },
  gate:      { archetype: 'unbuilt', why: 'needs a two-point bind + warp on a placed anchor' },
  'healing-grove': { archetype: 'unbuilt', why: 'needs a persistent area entity (heal-over-time volume)' },
  cordon:    { archetype: 'unbuilt', why: 'needs runtime terrain + a metal-lock status' },
  'grey-arena': { archetype: 'unbuilt', why: 'canon requires manatech (a drain-engine) the player has no access to' },

  // ── Combos — never solo-castable. Canon requires a second mage in sync. ──────────────────────
  counterpoint: { archetype: 'unbuilt', why: 'needs a second same-frequency mage running Barrier' },
  vaporscreen:  { archetype: 'unbuilt', why: 'needs a second mage supplying the other rune' },
}

const MOVE_BY_ID = new Map<string, KeeperMove>(KEEPER_MOVES.map((m) => [m.id, m]))

export const NO_CAST: CastSpec = { ...BASE, moveId: '', label: '', tier: 'tactical', archetype: 'unbuilt', why: 'empty slot' }

/** Resolve a move id to its cast spec. Unknown id → an empty spec (never throws in the frame loop). */
export function castForMove(moveId: string | null | undefined): CastSpec {
  if (!moveId) return NO_CAST
  const move = MOVE_BY_ID.get(moveId)
  const build = BUILDS[moveId]
  if (!move || !build) return { ...NO_CAST, moveId: moveId ?? '', label: move?.name ?? moveId, why: 'no build spec' }
  return { ...BASE, ...build, moveId, label: move.name, tier: move.tier }
}

/** Does the sim actually do something with this move today? */
export function isBuilt(moveId: string | null | undefined): boolean {
  return castForMove(moveId).archetype !== 'unbuilt'
}

// ── The loadout ────────────────────────────────────────────────────────────────
//
// Shape mirrors the authoring target the canon pass is aimed at: each keeper-reachable rune should
// own 1 passive + 2 tacticals + 1 ultimate. So the slots ARE those tiers — the loadout is typed, not
// four interchangeable holes, and the input maps to canon's own vocabulary (a held stance behaves
// nothing like a signature).
//
// 'combo' is not a slot kind: canon requires a second mage in sync, so it can never be a solo bind.

export type SlotKind = Exclude<MoveTier, 'combo'>
export const CAST_SLOTS: readonly SlotKind[] = ['passive', 'tactical', 'tactical', 'ultimate'] as const
/** keyboard bind per slot, in slot order. G holds the stance; Z/X throw tacticals; C is the signature. */
export const SLOT_KEYS: readonly string[] = ['g', 'z', 'x', 'c'] as const

/** Moves the keeper can run right now that fit a slot kind. Built ones first — the rest are honest but dead. */
export function eligibleMoves(owned: string[], kind: SlotKind): KeeperMove[] {
  const known = knownMoves(owned).filter((m) => m.tier === kind)
  return [...known].sort((a, b) => Number(isBuilt(b.id)) - Number(isBuilt(a.id)))
}

/**
 * The loadout a keeper starts with: the first ELIGIBLE move per slot, preferring ones the sim can
 * actually run, and never the same move twice. Slots with nothing to put in them stay null — an
 * empty ultimate slot is the coverage gap rendered, not a bug.
 */
export function defaultLoadout(owned: string[]): (string | null)[] {
  const used = new Set<string>()
  return CAST_SLOTS.map((kind) => {
    const pick = eligibleMoves(owned, kind).find((m) => !used.has(m.id))
    if (pick) used.add(pick.id)
    return pick?.id ?? null
  })
}

/** Is this move legal in this slot? Slot kind must match the move's tier, and you must own its runes. */
export function canSlot(owned: string[], slot: number, moveId: string): boolean {
  const kind = CAST_SLOTS[slot]
  if (!kind) return false
  return eligibleMoves(owned, kind).some((m) => m.id === moveId)
}
