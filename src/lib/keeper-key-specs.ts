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
  // ── the OPEN WORLD's keeper things (M12 step 1, 2026-11-17): the pack, the hotbar/loadout, the learned skills ──
  { base: 'open.inv.v1',             worldTied: false },  // the whole pack + hotbar slots
  { base: 'open.loadout.v1',         worldTied: false },  // the stance / worn vessel loadout
  { base: 'open.fleet.v1',           worldTied: false },  // the coursers they own + the one they drive (M14 lots), 11-18
  { base: 'open.keeper.name.v1',      worldTied: false },  // the name the player gave this keeper (Character tab › Keepers, M66 s3). Rides swaps + the cloud like any keeper key
  { base: 'open.pack.v1',            worldTied: false },  // the backpack a fallen keeper left in the Wilds (M20, 11-18): what they carried + when
  { base: 'open.rinquest.v1',        worldTied: false },  // the first-rinstick quest (M22, 11-18): none / active / done; no flag = born before it
  { base: 'open.look.v1',            worldTied: false },  // the keeper's look from the creator (M29, 11-19): frame, face, hair, colours
  { base: 'open.sights.v1',          worldTied: false },  // each gun's etched sight mark + tint (canon: look, never power), 11-18
  { base: 'open.skills.v1',          worldTied: false },  // forestry skill XP
  { base: 'open.chain.v1',           worldTied: false },  // the opening chain, Ather to Nyx (BETA M73, 11-23): the note read, the first death, Morel's ping once
  { base: 'open.repair.v1',          worldTied: false },  // Kael's ship repair (BETA M108, 11-23): the cell housing quoted at Hollis, stage 1 paid + fitted
]

// ── THE GARDEN: what the account's plot owns, shared by every keeper on it (M12 step 1, 2026-11-17) ───────────
// Scoped per ACCOUNT with the same `u:<id>:` front marker as a keeper key (see gardenKey in keeper-local.ts); the
// split from KEEPER_KEY_SPECS only matters once an account holds several keepers. Never worldTied: the open world
// has no epoch sweep. Open-save-registry derives the cloud-save garden whitelist from this list.
export const GARDEN_KEY_SPECS: readonly { base: string; worldTied: boolean }[] = [
  { base: 'ather.garden.v1',          worldTied: false },  // the plot
  { base: 'ather.fog.v2',             worldTied: false },  // the explored map
  { base: 'open.journal.v1',          worldTied: false },  // journal progress
  { base: 'ather.waymarks.v1',        worldTied: false },
  { base: 'open.pruned.v1',           worldTied: false },  // forestry world state
  { base: 'open.mined.v1',            worldTied: false },  // prospecting world state
  { base: 'ather.nodes.v2',           worldTied: false },  // node spread state
  { base: 'ather.nodes.skew',         worldTied: false },
  { base: 'open.tycoon.v1',           worldTied: false },  // businesses
  { base: 'open.errand.v1',           worldTied: false },
  { base: 'open.blueprints.v1',       worldTied: false },
  { base: 'open.pitstops.v1',         worldTied: false },
  { base: 'ather:trade:trial-ledger', worldTied: false },  // the trade ledger
  { base: 'open.companion.v1',        worldTied: false },  // the Moglins
  { base: 'open.works.v1',            worldTied: false },  // the workshop rooms (ather/rooms.ts)
  { base: 'ather.grimoire.v1',        worldTied: false },  // M76: the grimoire's pages, the spirit planters' pots, the Anemonyx visits met (ather/grimoire-book.ts)
  { base: 'ather.spiritFollow.v1',    worldTied: false },  // M109 s1: the planter ids of the spirits walking with the keeper, max 3 (ather/spirit-follow.ts)
  { base: 'ather.spiritFed.v1',       worldTied: false },  // M109 s2: each planter's fed record, counts up only (ather/spirit-feed.ts)
  { base: 'ather.spiritParty.v1',     worldTied: false },  // M109 s3: the party, the planter ids of up to 8 asked along (ather/spirit-party.ts)
  { base: 'ather.planterBox.v1',      worldTied: false },  // M113 s1: each Planter Box's potted sapling + when it went in (ather/planter-box.ts)
  { base: 'ather.spiritStats.v1',     worldTied: false },  // M110 s1: each planter's stat gains from play at training furniture, never past the form cap (ather/spirit-stats.ts)
  { base: 'open.tutorial.v1',         worldTied: false },  // M68: the Glade tutorial: Greg's chain, the four heard, gifts given once, Fennel's jar day (ather/glade-tutorial.ts)
  { base: 'open.tools.v1',            worldTied: false },  // a keeper's equipped tools: rinsticks (ather/rinsticks.ts)
  { base: 'open.buffs.v1',            worldTied: false },  // a keeper's potion buffs, until-times (ather/alchemy.ts)
  { base: 'open.deeds-told.v1',      worldTied: false },
  { base: 'open.co-office.v1',       worldTied: false },  // the Co. clerk's greeting was heard + visit count (business/co-lines.ts)  // BETA M6d: the deeds journal line was told (business/deed-pointer.ts)
  { base: 'open.village.v1',          worldTied: false },  // the garden village's Moglins (ather/moglins.ts)
  { base: 'open.trust.v1',            worldTied: false },  // recruiting: goods brought to each settlement Moglin (ather/settlement-folk.ts)
  { base: 'open.farm.v1',            worldTied: false },  // the Farm room's beds + composter charge (ather/farmroom.ts)
  { base: 'open.water.v1',           worldTied: false },  // the water tap's tanks: level + when (ather/water.ts)
  { base: 'open.bank.v1',             worldTied: false },  // the garden bank (ather/garden-bank.ts): every keeper on the account
  { base: 'open.deed.shipyard.v1',    worldTied: false },  // Kael's small yard (M49 s1-s3, retired s4: read once to hand its pieces back to the bag)
  { base: 'open.deed.shipyard:',      worldTied: false },  // a BOUGHT shipyard's small yard (M49 s3, retired s4: read once to hand its pieces back)
  { base: 'open.deed.plot:',          worldTied: false },  // a shipyard PLOT's deed, per shipyard (business/shipyards.ts › plotStoreBase, M49 s4)
  { base: 'open.garage:',             worldTied: false },  // a shipyard's GARAGE: which courser stands in which bay (business/shipyards.ts › garageStoreBase, M49 s5)
]
