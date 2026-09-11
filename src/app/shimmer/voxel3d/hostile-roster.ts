// Which hostile bodies a stretch of GROUND can yield — the `ZoneId → hostile roster` (#294 (c),
// row #1112, 2026-09-11). Before this file nothing on the enemy side read `zoneAt`: Hollows keyed
// off `greyness` alone and patrols off `HOLDS`, so the only thing that made the Thicket's night
// differ from the Outfields' was how much grey the terrain happened to pool there.
//
// ★★★ A ROSTER IS A FILTER, NEVER A SOURCE. Canon's one line on Hollows (shimmer-geography.md ›
// THE HOLLOWS) is *"it forms only where the ground was already drained"*, and the build's ruling is
// `hollowEligible` — drained + dark + dry. This table can only NARROW that: which of the three forms
// the grey here may wear, and how large a pack. It can refuse a body on eligible ground; it can
// never admit one on ground the ruling refused. The spawner asks the ruling FIRST and this table
// SECOND, and `hollow-wiring.test.ts` asserts that order, because the reverse — a zone table that
// says "wardens here" being read as "spawn wardens here" — is the 2026-06-16 failure (a Hollow on
// untouched ground) wearing a lookup table.
//
// ★ MEASURED, NOT ASSUMED (grid sweep, step 24, seed 1337 — `hostile-roster.test.ts` re-runs it):
// Hollow-grade grey (`greyness ≥ HOLLOW_GREY_MIN`) lives in wild country (11.7% of cells), the
// Outfields (5.7% core / 12.9% edge), the Thicket's edge band (9.2%) and the fringes of the Garden
// (2.8%) and Moonwell (1.3%). EVERY fully tended core is 0.0% — `greyAllowance` zeroes the grey
// there — so most of this table acts on a zone's EDGE BAND, where membership has begun to fade,
// and the `wild` entry is the bulk of every night. The three holds all stand in wild country
// (thistle grey 0.00 · vetch 0.67 · brack 1.00): the hold chain walks INTO the grey.
//
// ★ THE PATROL HALF IS DERIVED, NOT LISTED. `holdsOn(ground)` asks `zoneAt` where each hold stands.
// A listed copy ("wild: thistle, vetch, brack") would be true today and silently false the day a
// hold node moves — the same reason `mist-difficulty.ts` READS its bands out of `ENCOUNTER_TABLES`
// instead of transcribing them.
//
// ★ WHAT IS CANON HERE AND WHAT IS NOT. Canon's scope line hands Jin *"whether/when Hollows appear,
// their forms, tiers, difficulty, how many"* — so every number and form below is TUNING, changeable
// without a ruling. What is NOT mine: making a Hollow form on tended ground (refused above), and
// anything this table says about a *spirit* — it says nothing; wild spirits are `mist-roster.ts`
// and the quarry layer (#1114), which this file must never grow into.
//
// ★ FAIL CLOSED. A ground this table has no entry for yields NOTHING — no default, no nearest
// neighbour. `HOSTILE_ROSTERS` is a full `Record`, so a new `ZoneAnchor` id is a compile error
// here rather than a zone that quietly spawns the wild mix.

import type { HollowForm } from './hollows'
import { FORM_ORDER, PACK_MAX } from './hollows'
import type { ZoneId } from './mist-roster'
import { zoneAt } from '../voxel/zones'
import { greyness } from '../voxel/biome'
import { HOLDS, type HoldSpec } from '../voxel/holds'

/** Ground between the zones. Explicit rather than `null` so a lookup cannot mistake "unknown" for "wild". */
export const WILD = 'wild' as const
export type HostileGround = ZoneId | typeof WILD

export interface HostileRoster {
  /** Which Hollow forms the grey HERE may wear. Empty = this ground yields no Hollow, ever. */
  forms: readonly HollowForm[]
  /** Pack ceiling on this ground, 1..PACK_MAX; 0 iff `forms` is empty. The spawner takes
   *  `min(packSize(roll), pack)` — the roll's shape is untouched, only its top is. */
  pack: number
}

export const HOSTILE_ROSTERS: Record<HostileGround, HostileRoster> = {
  // The bulk of every night. All three forms, the full pack: this is the mix `pickForm`'s weights
  // were tuned for and the one `hollows.test.ts` pins.
  wild: { forms: FORM_ORDER, pack: PACK_MAX },
  // The garden's frayed edge, where the greying feeds out. Guttering grey yields thin, hungry
  // shapes: the ambush and the sap. No warden — a wall is pooled drain given mass, and the
  // Outfields' grey is failing ground, not a pool. The hardest night in the garden by omission of
  // the one form you can solve by backing away.
  'the-outfields': { forms: ['stalker', 'caster'], pack: PACK_MAX },
  // Closed canopy, dim floor, blind spots everywhere: the Thicket's edge is the stalker's ground
  // and nothing else's. A caster needs a clearing to hold its line across; a warden needs a road
  // to stand in. Smaller packs — three stalkers in the dark is already the lesson.
  'twilight-thicket': { forms: ['stalker'], pack: 3 },
  // The tended heart's fringe (2.8% of its edge band, 0% of its core). A fresh keeper's first
  // night: ONE warden, slow enough to walk around, solid enough that you must. The tutorial-grade
  // Hollow, by shape rather than by a level number.
  garden: { forms: ['warden'], pack: 1 },
  // Spawn's glade. Same fringe rule as the garden: one warden at most, at the very edge.
  'moonwell-glade': { forms: ['warden'], pack: 1 },
  // Open rolling ground under open sky — the wall on the road. Its edge band is 0.1% grey, so
  // this entry acts on almost nothing; it is kept NARROW rather than empty so the few cells that
  // yield today keep yielding, and the guard prints how little ground it stands on.
  'spirit-meadow': { forms: ['warden'], pack: 2 },
  // Terraces and hot water: the one form that floats, over ground you cannot stand a wall on.
  // 0.3% of its edge band — same caveat as the Meadows.
  'mana-springs': { forms: ['caster'], pack: 2 },
  // A passage, and measured 0.0% grey at core and edge. Explicitly empty: if a terrain retune
  // ever greys the road, the guard flags ground with no roster and the answer is a deliberate
  // line here, not the wild mix arriving on the way to the Meadows.
  'mycelial-path': { forms: [], pack: 0 },
  // Lived-in ground. Empty for the same reason its mist roster is empty (canon: a village is not
  // left ground), and measured 0.0% grey besides.
  'gloview-village': { forms: [], pack: 0 },
}

/** Which ground a point stands on — the zone that owns it, or `wild` between zones. */
export function groundAt(x: number, z: number, seed: number): { ground: HostileGround; t: number } {
  const za = zoneAt(x, z, seed)
  return { ground: za.zone ? za.zone.id : WILD, t: za.t }
}

/** The roster for a ground. Unknown/unlisted → EMPTY (fail closed), never the wild mix. */
export function hostileRosterFor(ground: HostileGround | null | undefined): HostileRoster {
  if (!ground) return EMPTY
  return HOSTILE_ROSTERS[ground] ?? EMPTY
}
const EMPTY: HostileRoster = { forms: [], pack: 0 }

/** The holds standing on this ground — DERIVED from where each hold's node sits, never listed. */
export function holdsOn(ground: HostileGround, seed: number): HoldSpec[] {
  return HOLDS.filter(h => groundAt(h.x, h.z, seed).ground === ground)
}

/**
 * The `/hostiles` line: what THIS ground can yield, read at the keeper's feet. An instrument, not
 * a player verb — it prints the zone, how deep in it you stand, the grey under you against the
 * Hollow floor, the roster, the holds on this ground, and what is live. The point of printing
 * `grey` next to `forms` is that they are two different questions: a roster is what the ground
 * MAY wear, the grey is whether it is drained enough to wear anything.
 */
export function hostileReadout(
  x: number, z: number, seed: number, greyMin: number,
  live: { hollows: number; foes: number },
): string {
  const { ground, t } = groundAt(x, z, seed)
  const r = hostileRosterFor(ground)
  const g = greyness(x, z, seed)
  const where = ground === WILD ? 'wild country' : `${ground} (membership ${t.toFixed(2)})`
  const forms = r.forms.length ? `${r.forms.join(' · ')} · pack ≤ ${r.pack}` : 'nothing — this ground yields no Hollow'
  const drained = g >= greyMin ? 'drained enough' : 'NOT drained enough'
  const holds = holdsOn(ground, seed).map(h => h.id.replace('-hold', ''))
  return [
    `ground   ${where}`,
    `grey     ${g.toFixed(2)} vs floor ${greyMin.toFixed(2)} — ${drained} to wear a body here`,
    `hollows  ${forms}`,
    `holds    ${holds.length ? holds.join(' · ') : 'none on this ground'} — patrols come out of these`,
    `live     ${live.hollows} hollow(s) · ${live.foes} collared foe(s) in the loaded world`,
  ].join('\n')
}
