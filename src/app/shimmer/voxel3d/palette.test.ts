// The build palette's reachability oracle. Run: npx tsx src/app/shimmer/voxel3d/palette.test.ts
//
// The catalogue grew to 98 pieces on 2026-08-27 — 14 shapes in 7 materials — and the build bar
// rendered `PIECES`, which is the 14 shapes. So 84 pieces existed, cost real materials, had
// renderers and tests, and could not be selected by any key or click in the game. Nothing was red.
// A piece is not shipped because it is in the array; it is shipped when a player can hold it.
//
// ⚠ SO THIS FILE ASSERTS TWO DIFFERENT THINGS AND BOTH ARE LOAD-BEARING. Sections 1-3 are about
// the derivation: every piece has coordinates on the two axes, and those coordinates are stable.
// Section 4 reads `VoxelWorld.tsx` itself, because a correct derivation the UI does not call is
// exactly the shape that beat a 371-assert oracle in this repo last week — the module and its
// consumer, separated by a gate.

import { readFileSync } from 'node:fs'
import { uiChain, runChain } from './ui-chain'
import { PIECES, ALL_PIECES, PIECE_MATERIALS, pieceVariants, pieceDef, pieceMaterial, basePieceId, pieceItemId, pieceForItem } from '../voxel/pieces'
import { RECIPES, recipeDef, isPieceRecipe } from '../voxel/recipes'
import { iconSourceFor, iconPixelsFor } from './tex/item-icon'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. ★★★ EVERY PIECE THAT EXISTS CAN BE HELD ──────────────────────────────────────────────────
// The bug in one assert. Walk the two axes exactly the way the palette does and collect what comes
// out; it must be the whole catalogue, with nothing left over.
{
  const reachable = new Set<string>()
  for (let shape = 0; shape < PIECES.length; shape++)
    for (let mat = 0; mat < PIECE_MATERIALS.length; mat++) {
      const v = pieceVariants(PIECES[shape].id)[mat]
      if (v) reachable.add(v.id)
    }

  const all = ALL_PIECES.map(p => p.id)
  const unreachable = all.filter(id => !reachable.has(id))
  ok(unreachable.length === 0,
     `every piece in the catalogue is selectable (${unreachable.length} stranded: ${unreachable.slice(0, 6).join(', ')})`)

  const phantom = [...reachable].filter(id => !all.includes(id))
  ok(phantom.length === 0, `and the palette offers nothing that is not a real piece (${phantom.join(', ')})`)

  // 105 since 2026-08-30: the bench (15 base pieces x 7 material variants). ⚠ THIS COUNT IS A
  // TRIPWIRE, NOT A CEILING — it fires whenever the catalogue grows so that growth is a decision
  // somebody wrote down, and it caught the bench within the hour. Bumping it without saying WHY is
  // the only way to use it wrongly.
  ok(reachable.size === 240, `the catalogue is 240 pieces and all 240 are on the axes (saw ${reachable.size})`)   // 240 since 2026-09-13: the doorway family + two doors (20 base × 12)
  ok(all.length === PIECES.length * PIECE_MATERIALS.length,
     '14 shapes x 7 materials, with no shape quietly missing a material')
}

// ── 2. ★ THE MATERIAL INDEX MEANS THE SAME MATERIAL ON EVERY SHAPE ──────────────────────────────
// Muscle memory is the whole reason the axis is usable: press ] twice and you are in Dawnwood, for
// any shape. `ALL_PIECES` puts each base first — a `stair` IS the cut-stone one — so an ordering
// read off THAT array would silently put a different material in slot 0 depending on the shape.
{
  for (let mat = 0; mat < PIECE_MATERIALS.length; mat++) {
    const keys = new Set(PIECES.map(p => pieceMaterial(pieceVariants(p.id)[mat].id)?.key))
    ok(keys.size === 1 && keys.has(PIECE_MATERIALS[mat].key),
       `material slot ${mat} is ${PIECE_MATERIALS[mat].key} for every shape (saw ${[...keys].join('/')})`)
  }
}

// ── 3. THE COORDINATES ROUND-TRIP ───────────────────────────────────────────────────────────────
// Whatever the two indices resolve to must be a real, resolvable piece of the right shape in the
// right material — the palette highlights both rows off this one id, so a bad resolution would
// light up the wrong tile in two places at once and look internally consistent doing it.
{
  for (const shape of PIECES)
    for (let mat = 0; mat < PIECE_MATERIALS.length; mat++) {
      const id = pieceVariants(shape.id)[mat].id
      ok(pieceDef(id) !== undefined, `${id} resolves through pieceDef`)
      ok(basePieceId(id) === shape.id, `${id} reports its shape as ${shape.id}`)
      ok(pieceMaterial(id)?.key === PIECE_MATERIALS[mat].key, `${id} reports material ${PIECE_MATERIALS[mat].key}`)
      ok(pieceDef(id)!.cost[0].itemId === PIECE_MATERIALS[mat].itemId,
         `${id} is paid for in ${PIECE_MATERIALS[mat].itemId}, not its base material`)
    }
}

// ── 4. ★★ AND THE GAME HAS TO ACTUALLY USE ALL OF THAT ──────────────────────────────────────────
// Sections 1-3 would stay green with a craft panel still rendering 14 rows and 14 recipes.
// ★ THE CONSUMER MOVED ON 2026-09-12: build mode went, and the two axes now live in the CRAFT
// PANEL (a material strip picks the column, the shape rows show it) — a piece is crafted into the
// bag and placed from the hotbar like a block. Same derivation, new host. Sections 4a-4d ask each
// layer a piece has to cross to be held: the recipe, the item, the icon, and the panel.
{
  const src = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')

  // 4a. the panel walks the same two axes this file does, and highlights off the material KEY.
  ok(/const pieceRows = PIECES\.map\(pc => pieceVariants\(pc\.id\)\.find\(v => pieceMaterial\(v\.id\)\?\.key === pieceMat\) \?\? pc\)/.test(src),
     'the craft panel derives its shape rows through pieceVariants in the chosen material')
  ok(/PIECE_MATERIALS\.map\(m => \{\n\s*const on = m\.key === pieceMat/.test(src),
     'the material strip is rendered from the full material table and highlights off the key')
  ok(/onCraft\(pieceItemId\(pc\.id\)\)/.test(src), 'a shape row crafts the resolved variant, not its base')
  ok(/craftSurface\(have, station\)\.filter\(r => !isPieceRecipe\(r\)\)/.test(src),
     'Refine excludes the piece rows — 98 of them would bury the planks')

  // 4b. the old consumer is GONE, not merely unwired: no palette state, no mode, no Tab.
  ok(!/const \[build, setBuild\]/.test(src), 'build mode state survives in the host')
  ok(!/setPieceIdx|setMatIdx|const pieceId = /.test(src), 'the palette indices survive in the host')
  ok(!/toggleBuild|materialNext|materialPrev/.test(src), 'a build-mode verb survives in the host')
  ok(/const heldPiece = selItem \? pieceForItem\(selItem\) : undefined/.test(src),
     'the world resolves the held piece from the SELECTED SLOT, the way a block is')
  ok(/intent === 'place' && pieceTarget/.test(src), 'the piece is placed by the same right-click intent a block is')
  ok(/give\(inv\.current!, pieceItemId\(fdef\.id\), 1\)/.test(src), 'taking a piece back refunds the ITEM, not its planks')
}

// ── 4c. ★★ EVERY PIECE IS A RECIPE AND AN ITEM WITH AN ICON SOURCE ───────────────────────────────
// Derived, so this is the assert that a shape added to `pieces.ts` is craftable the same day.
{
  for (const def of ALL_PIECES) {
    const item = pieceItemId(def.id)
    const r = recipeDef(item)
    ok(r !== undefined && r.output.itemId === item && r.output.count === 1, `${def.id} has a recipe that yields one ${item}`)
    ok(r !== undefined && r.station === 'hand', `${def.id} is hand work — mining is the gate, not furniture`)
    ok(r !== undefined && r.input.length === def.cost.length && r.input.every((i, k) => i.itemId === def.cost[k].itemId && i.count === def.cost[k].count),
       `${def.id}'s recipe costs exactly what the piece table says`)
    ok(pieceForItem(item)?.id === def.id, `${item} resolves back to ${def.id}`)
    ok(iconSourceFor(item) === 'piece', `${item} has an icon source (saw ${iconSourceFor(item)})`)
  }
  ok(pieceForItem('piece_nope') === undefined, 'an unknown piece item resolves to nothing, not a throw')
  ok(pieceForItem('goldwood_plank') === undefined, 'a plank is not a piece')
  ok(RECIPES.filter(isPieceRecipe).length === ALL_PIECES.length, 'exactly one piece recipe per piece')
  // ⚠ Rendered, not merely sourced: a 'piece' source whose renderer returns an empty buffer is an
  // invisible icon that passes every check above. One real render of the tallest and the flattest.
  for (const id of ['doorway', 'half_slab']) {
    const px = iconPixelsFor(pieceItemId(id), 48)
    ok(!!px && px.some((v, i) => i % 4 === 3 && v > 0), `${id}'s icon has opaque pixels`)
  }
}

// ── 4d. ★ THE ONE BUILDING VERB LEFT IS GATED ON THE HELD PIECE ─────────────────────────────────
// Asked THROUGH the shared verb chain, because that is what both devices walk. With an empty hand
// R would change a number nobody can see — the same argument the material keys used to make.
{
  const fired: string[] = []
  const hit = (n: string) => () => { fired.push(n) }
  const spy = {
    openConsole: hit('openConsole'), closeSurfaces: hit('closeSurfaces'),
    toggleSettings: hit('toggleSettings'), toggleCraft: hit('toggleCraft'), toggleMap: hit('toggleMap'),
    toggleBag: hit('toggleBag'), interact: hit('interact'), toggleDrawn: hit('toggleDrawn'),
    cycleWeapon: hit('cycleWeapon'), rotatePiece: hit('rotatePiece'),
  }
  const base = { consoleOpen: false, dialogueOpen: false, craftOpen: false, bagOpen: false,
                 showSettings: false, cursorUIOpen: false, drawn: false }
  const press = (holdsPiece: boolean) => {
    fired.length = 0
    runChain(uiChain({ ...base, holdsPiece }, spy), a => a === 'build.rotate', { consoleSeed: '' })
    return [...fired]
  }
  ok(press(true).includes('rotatePiece'), 'R does not turn the piece in hand')
  ok(press(false).length === 0, 'R turns something with an empty hand — invisible state change')
}

// ── 5. THE RETIRED KEYS ARE RETIRED ──────────────────────────────────────────────────────────────
{
  const actions = readFileSync(new URL('../../../lib/input/actions.ts', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  ok(!/'ui\.build'|'build\.materialNext'|'build\.materialPrev'|'build\.tierUp'|'build\.tierDown'/.test(actions),
     'a build-mode binding survives in the registry (comments aside)')
  ok(/'build\.rotate':\s*\{\s*keys: \['KeyR'\]/.test(actions), 'R is still the quarter-turn')
  ok(/actions: \['build\.rotate'\]/.test(actions), 'and it is in the settings panel, so the key is discoverable')
}

console.log(`palette: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
