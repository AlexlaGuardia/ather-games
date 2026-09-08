// The sky's palette — the numbers, with nothing that renders them.
//
// ★ PURE. No react, no three, no DOM. Colours as hex strings and intensities as numbers, so a
// module that has to AGREE with the sky can read the same values without importing the rig.
//
// ── ★★ WHY THIS IS A FILE AND NOT A BLOCK AT THE TOP OF `day-night.tsx` (2026-09-08) ──────────
// `sky-env.ts` builds the environment a Hollow borrows from, and canon requires that what it
// borrows be THE ROOM — *"it never carries a hue the scene did not already have"*. That is only
// true if the environment and the visible sky are built from ONE set of numbers. Restating the
// zenith beside the dome's zenith is the hand-kept mirror this repo has been bitten by twice
// (2026-08-22, and again in `dev/hollow`'s six local lighting values on 09-06): a copy and its
// original agree until they don't, and agreement between them is not evidence about either.
//
// ⚠ `day-night.tsx` RE-EXPORTS `DAY` and `NIGHT`, so the six existing `from '../../voxel3d/day-night'`
// import sites are unchanged by the move. Import them from wherever reads better; there is one
// definition either way. `GLOOM` and `MIST` deliberately did NOT move — those are rig BEHAVIOUR
// (cuts, lifts, smoothing rates), not the palette, and nothing outside the rig needs them.

export const SKY = {
  day: { zenith: '#6f9fd0', horizon: '#c9dff0' },
  night: { zenith: '#101a33', horizon: '#2a3a63' },
  sunHigh: '#fff4d6', sunLow: '#ffb45e',
}

// Day = the pre-clock look, verbatim. Night = the Ather's own hour: darker than the garden's
// Moonwell blue (this is untended country and darkness is about to mean something), but with a
// real floor — hemisphere and ambient never reach zero, because "you can't see" is a fail state
// the SPAWN layer is allowed to threaten and the renderer is not.
/** ⚠ EXPORTED 2026-08-27 so `dev/ring` can hang the SHIPPED fog in its preview, and so the ring's
 *  fade-in distance is read off the real fog rather than copied beside it. A preview lit by
 *  different numbers than the world is the "preview that re-derives" trap `dev/seam` warns about. */
export const DAY = {
  bg: '#8fb7d9', fogNear: 80, fogFar: 200,
  hemiSky: '#cfe6ff', hemiGround: '#3b3a4a', hemiIntensity: 1.5,
  sun: '#ffffff', sunIntensity: 1.5,
  ambient: 0.4,
}
/** ⚠ EXPORTED 2026-09-06 for the same reason DAY was: `dev/hollow` was restating all six of its
 *  lighting values locally and every one of them differed from the world's, so the bench Alex has
 *  made every Hollow look call on was running at ~55% of the world's daylight. A preview lit by
 *  different numbers than the world is the "preview that re-derives" trap, and it had already
 *  produced one wrong diagnosis: "the Hollow reads too dark" was the ROOM, not the creature. */
export const NIGHT = {
  bg: '#16223f', fogNear: 55, fogFar: 165,   // the dark stands closer — same world, smaller circle
  hemiSky: '#8ea8d8', hemiGround: '#252c47', hemiIntensity: 0.55,
  // ⚠ NOT A MOON. The Ather has no moon (Alex ruling 2026-08-08). This is the night's silver —
  // an authored illumination floor, because "you can't see" belongs to the spawn layer, never the
  // renderer. What the silver IS in-fiction (starlight? the Shimmer?) is an open canon gap.
  silver: '#cfe0ff', silverIntensity: 0.4,
  ambient: 0.15,
}
