/**
 * Where the block-texture spike samples its patch from.
 *
 * ★ ITS OWN MODULE SO A GUARD CAN IMPORT IT RATHER THAN READ IT. `TexSpike.tsx` pulls in React,
 * three and r3f at module scope, so a test cannot import the page to learn this — and the
 * alternative, a regex over the source, is the standing-claim-about-a-file-you-do-not-own shape
 * this repo has been bitten by repeatedly: a pattern that stops matching returns nothing and throws
 * nothing, so the guard would go quiet exactly when the constant moved. One definition, two
 * consumers, no text scraping.
 *
 * ⚠ (0, 0) IS NOT A VALID VALUE HERE. The origin is the fold's HOLLOW — no ground at any altitude —
 * and this page spent an unknown stretch rendering a blue screen because of it, printing "0 quads"
 * as a statistic while a keeper was asked to judge textures on it. See `spike-origin.test.ts`.
 */
export const SPIKE_ORIGIN_X = 1536
export const SPIKE_ORIGIN_Z = 2048
/** 8x8 columns = a 128-block patch — the size the guard measures, so both agree by construction. */
export const SPIKE_PATCH = 8
export const SPIKE_SEED = 1337
