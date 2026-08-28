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
import { PIECES, ALL_PIECES, PIECE_MATERIALS, pieceVariants, pieceDef, pieceMaterial, basePieceId } from '../voxel/pieces'

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

  ok(reachable.size === 98, `the catalogue is 98 pieces and all 98 are on the axes (saw ${reachable.size})`)
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
// Sections 1-3 would stay green with the build bar still rendering 14 tiles and placing 14 pieces.
{
  const src = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')

  ok(/const pieceId = /.test(src), 'VoxelWorld resolves a single selected piece id')
  ok(/pieceDef\(pieceId\)/.test(src), 'and places THAT piece — not PIECES[pieceIdx]')
  ok(!/pieceDef\(PIECES\[pieceIdx\]/.test(src), 'the old shape-only resolution is gone from the placement site')

  // ⚠⚠ THIS ASSERT USED TO GREP THIS FILE FOR `build.materialNext` AND IT WENT RED ON 2026-08-28,
  // CORRECTLY. The two keys' priority and gating moved into `ui-chain.ts` when the UI verbs were
  // lifted so a controller could reach them, and a text search over `VoxelWorld.tsx` could no
  // longer see a thing that had not broken. ★ It is rewritten rather than REPOINTED at the new
  // file, because a regex over ui-chain.ts would be the same standing claim about a file this
  // test does not own, one move behind again. Ask the chain the game actually walks.
  ok(!/build\.tierUp|build\.tierDown/.test(src), 'the dead tier branch that occupied those keys is gone')
  ok(/materialNext: \(\) =>[^\n]*setMatIdx/.test(src), 'the next-material body no longer lives in VoxelWorld')
  ok(/materialPrev: \(\) =>[^\n]*setMatIdx/.test(src), 'the prev-material body no longer lives in VoxelWorld')

  // ⚠ The palette must highlight off the resolved id. Highlighting off the pair is a SECOND
  // derivation of "what is selected", and two derivations agree until they do not.
  ok(/pieceMaterial\(pieceId\)/.test(src), 'the material row highlights off the resolved piece')
  ok(/basePieceId\(pieceId\)/.test(src), 'the shape row highlights off the resolved piece')
  ok(!/i === pieceIdx/.test(src), 'no tile is highlighted by index any more')

  // The material row is a row: it renders every material, not the ones one shape happens to have.
  ok(/PIECE_MATERIALS\.map\(/.test(src), 'the material strip is rendered from the full material table')
}
// ── 4b. ★★ BOTH MATERIAL KEYS REACH THE AXIS, AND ONLY INSIDE BUILD MODE ───────────────────────
// Asked THROUGH the shared verb chain, in both states, because that is what both the keydown
// handler and the frame loop walk. Outside the palette these keys would silently change something
// with nothing on screen to show it, which is the gate this proves is still there.
{
  const fired: string[] = []
  const hit = (n: string) => () => { fired.push(n) }
  const spy = {
    openConsole: hit('openConsole'), closeSurfaces: hit('closeSurfaces'),
    toggleSettings: hit('toggleSettings'), toggleCraft: hit('toggleCraft'), toggleMap: hit('toggleMap'),
    toggleBag: hit('toggleBag'), interact: hit('interact'), toggleDrawn: hit('toggleDrawn'),
    cycleWeapon: hit('cycleWeapon'), toggleBuild: hit('toggleBuild'), rotatePiece: hit('rotatePiece'),
    materialNext: hit('materialNext'), materialPrev: hit('materialPrev'),
  }
  const base = { consoleOpen: false, dialogueOpen: false, craftOpen: false, bagOpen: false,
                 showSettings: false, cursorUIOpen: false, drawn: false }
  const press = (id: 'build.materialNext' | 'build.materialPrev', build: boolean) => {
    fired.length = 0
    runChain(uiChain({ ...base, build }, spy), a => a === id, { consoleSeed: '' })
    return [...fired]
  }
  ok(press('build.materialNext', true).includes('materialNext'), '] does not reach the material axis inside build mode')
  ok(press('build.materialPrev', true).includes('materialPrev'), '[ does not reach the material axis inside build mode')
  ok(press('build.materialNext', false).length === 0, '] walks the material axis OUTSIDE build mode — invisible state change')
  ok(press('build.materialPrev', false).length === 0, '[ walks the material axis OUTSIDE build mode — invisible state change')
}

// ── 5. THE KEYS EXIST AND NOTHING ELSE CLAIMS THEM ──────────────────────────────────────────────
{
  const actions = readFileSync(new URL('../../../lib/input/actions.ts', import.meta.url), 'utf8')
  ok(/'build\.materialNext':\s*\{\s*keys: \['BracketRight'\]/.test(actions), '] is bound to the next material')
  ok(/'build\.materialPrev':\s*\{\s*keys: \['BracketLeft'\]/.test(actions), '[ is bound to the previous material')
  ok(!/'build\.tierUp'|'build\.tierDown'/.test(actions.replace(/\/\/[^\n]*/g, '')),
     'the two bindings that configured nothing are retired from the registry (comments aside)')
  ok(/'build\.materialNext', 'build\.materialPrev'/.test(actions),
     'and they appear in the settings panel, so the keys are discoverable')
}

console.log(`palette: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
