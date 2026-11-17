// ── THE KEEPER KEY REGISTRY, importable from the SERVER (no 'use client') ─────────────────────────────────────
// Moved out of keeper-local.ts 2026-11-17 (Jin hub): keeper-local is 'use client', and a route handler that imports
// it gets a client-reference stub, so `KEEPER_KEY_SPECS.map` threw at `next build` ("Failed to collect page data for
// /api/saves/open"). tsx ignores the directive, so the route's own test passed. The list and its doc stay one list:
// keeper-local.ts re-exports it; read the long comment above its re-export for what each field means.
export const KEEPER_KEY_SPECS: readonly { base: string; worldTied: boolean }[] = [
  // ── the character itself: cleared by the epoch today, by literal, and that is settled ──────────
  { base: 'ather:shimmer:birthRune', worldTied: true },   // ★ the ritual, and the affinity a keeper is born with
  { base: 'ather:shimmer:runes',     worldTied: true },   // what they have collected since
  { base: 'ather:shimmer:side',      worldTied: true },   // which dimension they last stood in — the front door reads it (2026-09-15)
  { base: 'ather:shimmer:book',      worldTied: false },  // the moves they have learned — deliberately survives
  { base: 'ather:shimmer:loadout',   worldTied: false },  // the cast slots they have set
  { base: 'ather:shimmer:gems',      worldTied: false },  // the rune-gems in the bag — letters, counted (2026-09-03)
  { base: 'ather:shimmer:vessels',   worldTied: false },  // the bracelet + focus and what is set in them
  { base: 'ather:shimmer:stowed',     worldTied: false },  // the vessels owned but not worn — each with its own gems and word (2026-09-03)
  { base: 'ather:shimmer:worn-tier',  worldTied: false },  // the TIER (material) of the worn bracelet + focus — the one field the two live keys do not carry (2026-09-04)
  { base: 'ather:shimmer:worn-word',  worldTied: false },  // the WORD the worn bracelet + focus were cut for — the band is a binding, the vessel bears its word (2026-09-09)
  { base: 'ather:shimmer:greg-imbued', worldTied: false },  // the word the Enchant Temple imbued Greg's bracelet for; the ONE word the seat-gem exception covers (2026-09-28)
  { base: 'ather:shimmer:vessel-pieces', worldTied: false },  // pieces of a season's vessel carried out of the Breach; the cutter finishes three (2026-09-27)
  { base: 'ather:shimmer:vessel-dry',   worldTied: false },  // rounds since the last vessel piece, across runs — the Breach's pity counter (2026-09-27)
  { base: 'ather:shimmer:trials',     worldTied: false },  // how many times each trial was cleared — the WON door's ledger (first clear = a sure prize) (2026-09-05)
  { base: 'ather:shimmer:parked',    worldTied: false },  // ⚠ LEGACY: the retired 09-03 PAIRS. `vessels.ts` reads it once, migrates it, removes it
  { base: 'ather:shimmer:hold:best', worldTied: false },  // the hold's best round — a keeper's own record, survives like the ledger (2026-09-24)
  { base: 'ather:mp:id',             worldTied: false },  // ★ the peer other players see — two accounts were ONE peer
  { base: 'ather:mp:name',           worldTied: false },  // and this MIRRORS the signed-in username, so B announced A's name
  // ── dynamic tails: no suffix can match these, so the epoch matches them by PREFIX ─────────────
  { base: 'ather:shimmer:seen:',     worldTied: false },  // ⚠ OPEN: the map of a world that no longer exists
  { base: 'voxel3d:tutorial:',       worldTied: true },   // ★ dynamic tail: seed. Reborn keeper must retake it —
                                                          //   `done` + a one-way gate already spent = no way out
  { base: 'voxel3d:recipes:',        worldTied: true },   // the recipe book (recipe-book.ts): tied like the tutorial,
                                                          //   because Yarrow's page lives in the tutorial and a reborn keeper meets her again
  { base: 'voxel3d:mist:',           worldTied: false },  // ⚠ OPEN: patches drawn from, in a regenerated world
  { base: 'voxel3d:pots:',           worldTied: false },  // ⚠ OPEN: clocks on blocks that no longer stand
  { base: 'voxel3d:saplings:',       worldTied: false },  // ⚠ OPEN
  { base: 'voxel3d:grown:',          worldTied: false },  // ⚠ OPEN, same call as saplings: trees grown from them (ground-light sources)
  { base: 'voxel3d:leafdecay:',      worldTied: false },  // ⚠ OPEN
]
