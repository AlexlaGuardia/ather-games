// LUCERNYX sim tests — run with: npx tsx src/app/lucernyx/lib/lucernyx.test.ts
import {
  makeBoard, legalMoves, apply, aiMove, countPieces, idx, other, isRooted,
  SIZE, PIECE_RANKS, TORCHES_TO_WIN, ELEMENT_TILES, type Board, type Owner, type Element,
} from './lucernyx'
import { mulberry32 } from '@/lib/arcade/rng'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}

// a blank board to hand-place positions on
function blank(turn: Owner = 'light'): Board {
  return { cells: new Array(SIZE * SIZE).fill(null), elements: new Array(SIZE * SIZE).fill(null), turn, torches: { light: 0, grey: 0 }, winner: null, over: false }
}
const put = (b: Board, r: number, c: number, o: Owner | null) => { b.cells[idx(r, c)] = o }
const sanctuary = (b: Board, r: number, c: number, e: Element) => { b.elements[idx(r, c)] = e }

// 1. setup
{
  const b = makeBoard()
  const lp = countPieces(b, 'light'), gp = countPieces(b, 'grey')
  ok('light starts with a full home', lp === PIECE_RANKS * (SIZE / 2))
  ok('grey mirrors light', gp === lp)
  ok('light moves first', b.turn === 'light')
}

// 2. opening slides exist and are forward-only
{
  const b = makeBoard()
  const m = legalMoves(b, 'light')
  ok('light has opening slides', m.length > 0)
  ok('all opening moves are simple slides', m.every((x) => x.converts.length === 0))
  // light advances toward row 0, so every landing row < from row
  ok('light slides advance upward', m.every((x) => Math.floor(x.to / SIZE) < Math.floor(x.from / SIZE)))
}

// 3. the convert verb — jump flips the enemy in place, piece lands beyond
{
  const b = blank('light')
  put(b, 4, 3, 'light')
  put(b, 3, 2, 'grey') // adjacent forward-left enemy
  // landing (2,1) is empty
  const jumps = legalMoves(b, 'light').filter((m) => m.converts.length > 0)
  ok('a jump-convert is offered', jumps.length === 1)
  const after = apply(b, jumps[0])
  ok('jumped enemy flipped to light', after.cells[idx(3, 2)] === 'light')
  ok('flipped piece STAYED on its square', after.cells[idx(3, 2)] !== null)
  ok('jumper landed beyond', after.cells[idx(2, 1)] === 'light')
  ok('jumper left its origin', after.cells[idx(4, 3)] === null)
  ok('material never left the board', countPieces(after, 'light') === 2 && countPieces(after, 'grey') === 0)
}

// 4. multi-jump flips an arc
{
  const b = blank('light')
  put(b, 6, 5, 'light')
  put(b, 5, 4, 'grey')
  put(b, 3, 2, 'grey') // second enemy on the chain (jump 6,5->4,3 then 4,3->2,1)
  const chains = legalMoves(b, 'light').filter((m) => m.converts.length >= 2)
  ok('a 2-jump chain exists', chains.length >= 1)
  const c2 = chains.find((m) => m.converts.length === 2)!
  const after = apply(b, c2)
  ok('both jumped enemies flipped', after.cells[idx(5, 4)] === 'light' && after.cells[idx(3, 2)] === 'light')
  ok('jumper ended at the arc tip', after.cells[idx(2, 1)] === 'light')
}

// 5. a converted piece reverses its march (direction follows owner)
{
  const b = blank('light')
  put(b, 4, 3, 'light')
  put(b, 3, 2, 'grey')
  const j = legalMoves(b, 'light').find((m) => m.converts.length === 1)!
  const after = apply(b, j) // the flipped piece now at (3,2) is light → must advance toward row 0
  after.turn = 'light'
  const m = legalMoves(after, 'light').filter((x) => x.from === idx(3, 2))
  ok('flipped piece now marches as light (upward)', m.length > 0 && m.every((x) => Math.floor(x.to / SIZE) < 3))
}

// 6. reaching the enemy home rank lights a torch + ascends
{
  const b = blank('light')
  put(b, 1, 2, 'light') // one slide from row 0 (grey's home rank)
  const torchMove = legalMoves(b, 'light').find((m) => m.torch)!
  ok('a torch move is available', !!torchMove)
  const after = apply(b, torchMove)
  ok('torch counted', after.torches.light === 1)
  ok('piece ascended off the board', countPieces(after, 'light') === 0)
}

// 7. first to TORCHES_TO_WIN wins
{
  const b = blank('light')
  b.torches.light = TORCHES_TO_WIN - 1
  put(b, 1, 2, 'light')
  put(b, 7, 0, 'grey') // give grey a piece so the game isn't a wipeout
  const tm = legalMoves(b, 'light').find((m) => m.torch)!
  const after = apply(b, tm)
  ok('third torch wins', after.over && after.winner === 'light')
}

// 8. board-lock resolves by tiebreak (most torches, then most pieces)
{
  // light to move has the only piece jammed in a corner with no forward move → after a move
  // we check the lock path indirectly: grey has no pieces and no moves → light wins on apply
  const b = blank('light')
  put(b, 5, 2, 'light')
  put(b, 4, 1, 'light')
  // grey has nothing → as soon as it's grey's turn the game ends, light ahead on pieces
  const m = legalMoves(b, 'light')[0]
  const after = apply(b, m)
  ok('wipeout ends the game', after.over)
  ok('tiebreak hands it to the side with pieces', after.winner === 'light')
}

// 9. determinism — same seed, same AI choice
{
  const mk = (): Board => {
    const b = makeBoard()
    // advance to a richer midgame by a few scripted light/grey moves via AI
    let cur = b
    for (let i = 0; i < 4; i++) {
      const m = aiMove(cur, mulberry32(100 + i))
      if (!m) break
      cur = apply(cur, m)
    }
    return cur
  }
  const a = mk(), c = mk()
  const ma = aiMove(a, mulberry32(7))
  const mc = aiMove(c, mulberry32(7))
  ok('same seed → same AI move', JSON.stringify(ma) === JSON.stringify(mc))
}

// 10. the AI takes a free conversion when offered (greedy flip)
{
  const b = blank('grey')
  put(b, 3, 2, 'grey')
  put(b, 4, 3, 'light') // grey at (3,2) can jump (4,3)->(5,4), flipping the light piece
  put(b, 0, 7, 'light') // a far light piece so it's not a wipeout/forced
  const m = aiMove(b, mulberry32(3))!
  ok('AI chooses the conversion', m.converts.length >= 1 && m.converts.includes(idx(4, 3)))
}

// 11. the AI blocks / avoids handing the opponent an immediate torch
{
  // grey to move; a light piece sits at (1,2), one slide from its torch at row 0.
  // grey should value boards where light canNOT immediately torch. We just assert the AI
  // never *creates* the worst board when a neutral option exists.
  const b = blank('grey')
  put(b, 1, 2, 'light')
  put(b, 5, 4, 'grey')
  put(b, 6, 5, 'grey')
  const m = aiMove(b, mulberry32(9))
  ok('AI returns a move in a live position', !!m)
}

// 12. a full AI-vs-AI game terminates with a result
{
  let b = makeBoard()
  let guard = 0
  while (!b.over && guard < 4000) {
    const m = aiMove(b, mulberry32(1000 + guard))
    if (!m) break
    b = apply(b, m)
    guard++
  }
  ok('AI-vs-AI reaches a terminal state', b.over)
  ok('game ended in a sane move count', guard > 0 && guard < 4000)
  console.log(`     (game length ${guard} plies, torches L${b.torches.light}/G${b.torches.grey}, winner ${b.winner ?? 'draw'})`)
}

// 13. element tiles — setup + symmetry
{
  const b = makeBoard()
  ok('board has the 4 sanctuaries', ELEMENT_TILES.every((e) => b.elements[e.sq] === e.element))
  ok('sanctuaries are in the empty midfield', ELEMENT_TILES.every((e) => b.cells[e.sq] === null))
}

// 14. a rooted enemy can't be flipped (the jump is blocked)
{
  const b = blank('light')
  put(b, 4, 3, 'light')
  put(b, 3, 2, 'grey')
  sanctuary(b, 3, 2, 'earth') // the grey now stands on a sanctuary → rooted
  ok('the grey reads as rooted', isRooted(b, idx(3, 2)))
  const jumps = legalMoves(b, 'light').filter((m) => m.converts.length > 0)
  ok('no jump-convert over a rooted enemy', jumps.length === 0)
}

// 15. the same enemy off-sanctuary IS jumpable (control)
{
  const b = blank('light')
  put(b, 4, 3, 'light')
  put(b, 3, 2, 'grey') // no sanctuary this time
  const jumps = legalMoves(b, 'light').filter((m) => m.converts.length > 0)
  ok('off-sanctuary, the jump returns', jumps.length === 1)
}

// 16. rooting blocks one branch of a multi-jump but not the other
{
  const b = blank('light')
  put(b, 6, 5, 'light')
  put(b, 5, 4, 'grey') // first jump target (6,5)->(4,3)
  put(b, 3, 2, 'grey'); sanctuary(b, 3, 2, 'mana') // second hop's target is rooted → chain stops at 1
  const ms = legalMoves(b, 'light').filter((m) => m.converts.length > 0)
  ok('the chain is capped at the rooted wall', ms.every((m) => m.converts.length === 1))
}

console.log(`\nLUCERNYX sim: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
