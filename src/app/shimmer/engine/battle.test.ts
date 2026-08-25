// Run: npx tsx src/app/shimmer/engine/battle.test.ts
//
// endOfTurn used to emit a KO for ANY combatant at hp<=0, unconditionally. A combatant already
// KO'd by a MOVE this turn (its KO already emitted in executeAction) got a SECOND KO here — the
// battle log printed "fainted!" twice and the ~1.1s KO delay fired twice before the end screen.
// The fix snapshots who was standing at entry and only emits for a death caused BY the status
// tick. Restore the bug (drop the aliveAtEntry guard) and case 1 goes red.

import { createBattle, endOfTurn, type BattleState } from './battle'
import { createSpirit } from '../spirits/spirit'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const mk = (): BattleState => createBattle(createSpirit('fox', 'p', 0, 0), createSpirit('rabbit', 'e', 0, 0))
const koCount = (b: BattleState, target: string) =>
  b.events.filter(e => e.type === 'KO' && (e as { target: string }).target === target).length

console.log('the bug — a move-kill must not re-emit KO at end of turn')
{
  const b = mk()
  b.enemy.hp = 0        // as executeAction leaves the loser after a lethal move
  b.events = []         // the move already flushed its own KO event
  endOfTurn(b)
  check('move-killed enemy → no duplicate KO', koCount(b, 'enemy') === 0, `emitted ${koCount(b, 'enemy')}`)
}

console.log('the other side of the fix — a tick-death still emits exactly one KO')
{
  const b = mk()
  b.enemy.hp = 1
  b.enemy.status = 'ignition'   // ticks ~maxHp/12, lethal at 1 hp
  b.enemy.statusTurns = 2
  b.events = []
  endOfTurn(b)
  check('ignition tick kills enemy → exactly one KO', koCount(b, 'enemy') === 1, `emitted ${koCount(b, 'enemy')}, hp=${b.enemy.hp}`)
}

console.log('nobody dies → no KO at all')
{
  const b = mk()
  b.events = []
  endOfTurn(b)
  check('both alive → zero KO events', koCount(b, 'player') + koCount(b, 'enemy') === 0)
}

console.log(`\nbattle endOfTurn: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
