// A spar STUDIES the spirit it was against (2026-09-13). The grimoire's top rung existed with no
// caller; this pins the one call site so the rung cannot go quiet again. Run: npx tsx <this file>
//
// Two halves. The engine half runs the real `markStudied` (seen → studied, element recorded, never
// downgraded). The wiring half reads the host's spar-end block as text, because the block is a React
// callback inside a 10k-line file and there is no cheaper honest oracle: it asserts the call sits
// AFTER the payout and BEFORE the withdrawal, in the same function, so a refactor that moves the
// spar end and forgets the study goes red here and not in a player's book.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSpiritIndex, markSeen, markStudied } from '../engine/spirit-index'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

{
  const ix = createSpiritIndex()
  markSeen(ix, 'fox')
  ok(ix.entries.fox.status === 'seen', 'the mist writes seen')
  markStudied(ix, 'fox', 'storm')
  ok(ix.entries.fox.status === 'studied', 'a spar writes studied')
  ok(ix.entries.fox.elementsStudied.includes('storm'), 'and the element it wore')
  markStudied(ix, 'owl')
  ok(ix.entries.owl.status === 'studied', 'a spar studies a species never seen before too (you met it in the ring)')
  markSeen(ix, 'fox')
  ok(ix.entries.fox.status === 'studied', 'seeing it again never downgrades')
  ok(ix.totalStudied === 2, `two studied (${ix.totalStudied})`)
}

{
  const src = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
  const start = src.indexOf('setSparLedger(sparLedgerLines(applySparPayout(')
  ok(start > 0, 'the spar-end block is where the payout is')
  const end = src.indexOf('recordWithdrawal(mistLedger.current, s.patch', start)
  ok(end > start, 'the withdrawal follows the payout in the same block')
  const block = src.slice(start, end)
  ok(/markStudied\(spiritIndex\.current,\s*e\.species/.test(block), 'every sparred enemy is marked studied between the payout and the withdrawal')
  ok(/for \(const e of s\.enemies\)/.test(block), 'ALL of them — a pair studies both')
  ok(!/if \(outcome === ['"]won['"]\)[^\n]*markStudied/.test(block), 'win or lose: you read it either way')
}

console.log(`spar-studied-wiring: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
