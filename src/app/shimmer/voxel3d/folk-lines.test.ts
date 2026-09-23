// folk-lines.ts is a COPY of the locked Beat 0½ script. This re-parses the canon file the way
// `scripts/folk-lines-gen.py` does and fails on one changed character — so a re-ruled line is a
// red test, not a stale copy. Same discipline creature-size.ts's sizes copy learned (canon-drift).
//
// ⚠ It reads /root/athernyx directly, like passage.test.ts reads calendar.md: on this box the
// canon repo is always beside the game repo. A missing file FAILS rather than skips — an instrument
// that goes quiet when its subject is absent reports green for the wrong reason.
import { readFileSync } from 'node:fs'
import { SCRIPT, type Beat } from './folk-lines'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const CANON = '/root/athernyx/CANON/game/shimmer-quests-mainmap.md'

// The same two blocks the generator copies — see BLOCKS in scripts/folk-lines-gen.py.
const BLOCKS: [string, string][] = [
  ['### Beat 0½', '[trigger: resume-Beat-1'],
  ['### The return beat — Yarrow', '**LOCKED 2026-09-22'],
]
function parse(src: string): Record<string, Beat[]> {
  const out: Record<string, Beat[]> = {}
  for (const [a, b] of BLOCKS) {
    const start = src.indexOf(a), end = src.indexOf(b, start)
    ok(start >= 0 && end > start, `the canon file has the block starting '${a}'`)
    Object.assign(out, parseBlock(src.slice(start, end)))
  }
  return out
}
function parseBlock(block: string): Record<string, Beat[]> {
  const out: Record<string, Beat[]> = {}
  let trig: string | null = null
  for (const line of block.split('\n')) {
    let m = /^\[trigger: ([^\s\]|]+)/.exec(line)
    if (m) { trig = m[1]; out[trig] = []; continue }
    if (!trig) continue
    if ((m = /^\[SCENE: (.*)\]$/.exec(line))) { out[trig].push({ scene: m[1] }); continue }
    if ((m = /^([A-Z]+): (.*)$/.exec(line))) { out[trig].push({ who: m[1] as never, text: m[2] }); continue }
    if ((m = /^> (.*)$/.exec(line))) { out[trig].push({ option: m[1] }); continue }
  }
  return out
}

const canon = parse(readFileSync(CANON, 'utf8'))
const ours = SCRIPT as Record<string, readonly Beat[]>

ok(Object.keys(canon).length === Object.keys(ours).length,
   `same trigger count as canon (canon ${Object.keys(canon).length}, ours ${Object.keys(ours).length})`)
for (const k of Object.keys(canon)) {
  ok(k in ours, `trigger '${k}' is transcribed`)
  if (!(k in ours)) continue
  ok(JSON.stringify(canon[k]) === JSON.stringify(ours[k]), `'${k}' matches canon verbatim`)
}
for (const k of Object.keys(ours)) ok(k in canon, `'${k}' exists in canon (not a line written here)`)

// The script's own rule: cozy register, no em dashes in a spoken line.
for (const [k, bs] of Object.entries(ours))
  for (const b of bs) if ('text' in b) ok(!b.text.includes('—'), `'${k}' has no em dash: ${b.text.slice(0, 40)}`)

// The choice carries exactly the two answers the machine routes on.
const opts = ours.choice.filter(b => 'option' in b).map(b => (b as { option: string }).option)
ok(opts.length === 2 && opts.some(o => /not yet/i.test(o)) && opts.some(o => /staying/i.test(o)),
   `choice offers 'staying' and 'not yet' (${opts.join(' / ')})`)

console.log(`folk-lines: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
