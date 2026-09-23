// The Core, as numbers — where it hangs and how far it has banked. The dome and the rig both read
// this, so the disc you look at and the light that throws your shadow cannot disagree.
//
// ★ PURE: three + the day cycle. No react, no DOM. Testable under node.
//
// ── ★★ CANON (`world/ather.md` › *The sky, looked at*, RULED 2026-09-23, /magii + Alex) ─────────
// The Core NEVER crosses the sky and NEVER sets — down in the Ather means inward toward the Silt,
// so there is no horizon for it to go behind. Day and night happen IN PLACE: it banks like a coal,
// the whole body at once (blaze → ember → dark coal with live veins and a warm rim), and it never
// phases, flickers or gutters. The build's old east→west sun path was a quiet contradiction and is
// gone. WHERE overhead it hangs, its size and the curve are build calls (Jin), set below.
import * as THREE from 'three'
import { daylight } from '../engine/day-cycle'

/**
 * Where the Core hangs — fixed, all day and all night. It is the old NOON sun's exact spot
 * (elevation ~72°, leaning toward +z), chosen so a clear noon is unchanged to the last digit: the
 * hour reference (`hour-light.ts`) is built at noon, and every lit face in the world was tuned there.
 * Not the zenith on purpose: straight down lights every side face of a block identically and the
 * voxels go flat.
 */
export const CORE_POSITION = new THREE.Vector3(0, 270, 90)
export const CORE_DIR = CORE_POSITION.clone().normalize()

/** Apparent radius of the disc, radians (~3.2°, a dozen suns): it is a world's heart, not a star. */
export const CORE_RADIUS = 0.056

/**
 * How far the Core has banked: 1 = the blaze (day), 0 = the coal (night). It is the daylight curve
 * itself, so the gold⇄silver palette, the light's strength and the disc can never disagree about
 * the hour. Canon: "one journey, run both ways" — dusk and dawn are the same curve.
 */
export const coreBank = (progress: number): number => daylight(progress)

/**
 * The slow, even breath of the night coal — allowed by canon ("a slow, even breath is fine"), and
 * ⛔ nothing faster: anything uneven reads as the balance tearing. A pure sine, ±7% over 9 seconds.
 */
export const BREATH = { periodS: 9, depth: 0.07 }

/**
 * The Core TURNS (canon keeps the word) — seen at night as its veins drifting round, one full turn
 * per `TURN_S` real seconds. Slow enough to notice only if you stand and watch, which is the point.
 */
export const TURN_S = 600
