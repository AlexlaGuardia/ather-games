# M153 Place mode: the design cut (Alex, live, 2026-11-25)

**What it is.** In the World Builder's Fly view, the owner places, moves and removes pieces on a map's draft. Players see nothing
until Publish. Same store as terrain (draft, autosave, versions, roll back): the layer gains one list, `props`, present only when
it holds something, so a layer without it stays byte-identical. Desktop, owner only.

**Three kinds of placed things**
1. **Scenery**: trees, bushes, props, furniture. Nothing to gather. Every map.
2. **Tutorial nodes** (Glade): real trees and crystals, gathered with the keeper's own tool, normal drops. Per keeper, 24 h real
   regrow, editable per node. The regrow timer runs from FIRST TOUCH (channel.ts): a newcomer who runs out of mana halfway must
   still be able to finish. Otto's stone by Otto, Bonn's tree by Bonn (Alex places).
3. **Wilds nodes**: normal regrow (s3).

**Controls** (worktable creative grammar): crosshair, hotbar of nine, E inventory, left pick up / remove, right place, wheel scale,
G snap (1 / 0.5 / 0.25 / free), T turn step, R turn, undo, select + move, delete. Pieces sit on the ground and follow a terrain edit.

**Alex's calls**
- Scenery: ship with what exists (tree, 3 bushes, crystal bodies, props, 37 furniture pieces), then a small slice of new filler in
  code: rocks, logs, fences, signs, reeds, flower clumps.
- Moonwell pool and the Glade's gate: FIXED. (Pool fix = M157.)
- Houses, stations and people move SEPARATELY, each its own piece.
- Rooms in the gardens: palette pieces Alex places, display only in the Glade (Bonn Carpentry, Otto Stonery, Tess Rinnshop, Greg
  Cooking: Magii 69b8b7d, Alex confirmed 11-25).

**Hub defaults (told to Alex, no objection; say so to change)**
- Scenery scales 0.5 to 2; nodes keep true size. Trunks and big props block, bushes do not; a toggle per piece.
- Kind + cooldown per node; Goldwood + raw crystal as the start pair.
- Anything not moved stays where it is today (published spot, else the code's spot).
- Publish refuses a person, newborn spot or node in the void, in water, or not reachable on foot from the newborn spot.

**Slices**
| s | what | done when |
|---|---|---|
| s1a | Place mode + scenery in Fly, Glade; today's folk, houses, pool, gate drawn as fixed ghosts | owner places a tree and a prop, draft only; Publish: a fresh keeper sees and bumps the trunk; roll back removes it |
| s1a+ | filler scenery in code | each piece in the palette, on a sheet Alex OKs |
| s1b | tutorial nodes | fresh keeper gathers one, 24 h wait shown, another keeper's copy is fresh; out of mana halfway can finish |
| s1c | people, newborn spot, houses, stations, rooms movable | move Greg + Bonn in the draft, Publish, a newborn does First Steps on the new spots; refusals fire; roll back restores |
| s2 | settlement zones: parts placed in 3D in Fly, stand points, roofs | Alex lays one settlement end to end |
| s3 | the rest of the Wilds, then Nyx; Wilds nodes | same checks per map |

M155 (guided tour) follows s1c, so its markers read the placed spots. The edge to watch: spots read once at module load
(glade-cluster-view.tsx KEEPERS / GREG, page.tsx GLADE_FRIENDS_AT) and the map / tour readers must all move to one resolver.
