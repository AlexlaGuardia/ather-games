# Shipyards: what one IS (M49)

> Alex 11-21 ~13:30 ET, from his own words: *"a ship yard is basically ~100x100 plot with a landing zone, then depending on the
> location since they do cost more for more utility but we can have some with garages that can store 4-12 coursers, and a ship
> dock some need water others just need somewhere to tie em down ..and last but not least a home of some kind mixed into it all"*
>
> Canon it builds on (read-only, Magii's): `athernyx/CANON/game/ather-rework-2026-11.md` §2. The shipyard is the keeper's home
> base (Kael's, by the road over the mountain above Rune Hold); the places a keeper BUYS are shipyards, not city homes (11-20);
> Nyx-side ground is held by DEED, a grid to place things in, the structure comes built (11-20). Skyships moor at sky-ports;
> water craft are local (rinning boats, barges) (`world/transportation.md`). Coursers are the wheeled manalic vehicles.
> Sizes, counts, prices and layout below are BUILD (Jin's). Items marked **DEFAULT** are the hub's pick: Alex corrects them.

## The shape
A shipyard is its own fenced **plot, about 100 x 100 m**, standing on its own ground by a road (NOT a building inside a town).
Every shipyard has, mixed together on that plot:

1. **Landing zone**: a pad the keeper's skyship sets down on (canon's "launch pad").
2. **Garages**: store the keeper's **coursers**. Capacity is what a dearer yard buys: **4 / 8 / 12** bays. *DEFAULT tiers.*
3. **Ship dock**, by location:
   - **Water berth** where the plot touches water (coast, lake, river): the ship ties up afloat.
   - **Tie-down** (mooring posts / a mast) on dry ground: the ship is tied down, no water needed.
4. **A home**: a dwelling of some kind on the plot (quarters, a cabin, a house over the workshop). Size grows with the tier.
5. **The deed**: the rest of the plot is the keeper's DEED grid (1 m cells, M49 s1/s2's model): the yard comes BUILT
   (pad, garages, dock, home, fence, gate); the keeper PLACES things in it, never builds walls on it (canon 11-20).

## Tiers (DEFAULT: Alex tunes)
| shipyard | where | price (Marks) | garage | dock | home |
|---|---|---|---|---|---|
| Kael's (inherited) | road above Rune Hold | free | 4 | tie-down | Kael's house |
| Gale Haven | by road e40, 390 m N of town (hub 11-21: dry site, less decking) | 250,000 | 8 | tie-down | cabin |
| Veradyn | isle site 290 m from town, no road (isle city): reached by water or by air | 300,000 | 8 | water berth | house |
| the Citadel | outskirts | 400,000 | 12 | tie-down | large house |

## What already exists (11-21)
- s1 555b5fa2 / s2 da5a7872: a 12 x 8 m deed yard (deck, fence, gate ramp, look board, placing) behind Kael's shipyard.
- s3a e3bafa0e: buyable shipyard doors in Gale Haven / Veradyn / Citadel, ownership (Ledger.shipyards), per-shipyard store,
  unowned = shut, ?own=all. **Carries over:** ownership, the per-key store, the placing model, the buy price ladder.
  **Superseded:** the 12 x 8 yard behind a town building is the wrong scale; it becomes the plot's deed ground.

## Slices (each ships alone, each with a prod check)
- **s4 the plot**: every shipyard (Kael's + 3) gets its ~100 x 100 m fenced site on its own ground by a road, levelled
  (terraced/decked where the ground falls), with BLOCKOUT pieces: landing pad, garage block (bays per tier), dock (berth on
  water or tie-down posts), home (blockout house you can walk into later), gate; the open ground = the deed grid.
  Check: walk each yard on prod, every piece present per the tier table, the deed places, 0 errors.
- **s5 garages**: park a courser in a free bay, take it out again; capacity enforced; saved.
- **s6 the dock**: the keeper's ship sits at its own yard's dock (berth or tie-down); the landing zone takes the skyship.
- **s7 the buy** (was s3b): E at an unowned shipyard's gate -> buy panel at its price, spends Marks, owns it.
- Later: the home's interior is furnished by deed (interiors were deferred 11-16; ask before building).

## Open (Alex)
- Tier numbers / which town gets water: the table above is a DEFAULT.
- Kael's shipyard re-shaped to this plot too (DEFAULT yes: it is the home base the game opens on).
