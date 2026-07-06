// MANA'NANA quest-engine verification — run: npx tsx src/app/manana/lib/quests.test.ts
import { W, H, idx, gem, swapped, resolve, type Cell, type ResolveStep } from './match3'
import { LEVELS, levelAt, isLastLevel, trackStep, goalMet, goalProgress, goalLabel, type Goal } from './quests'

let seed = 424242
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

// a minimal fake step exposing only what trackStep reads
const step = (o: Partial<ResolveStep>): ResolveStep => ({
  matched: [], spawned: [], fired: [], blasts: [], fallen: [], gained: 0, mult: 1, puffs: 0,
  colorCounts: new Array(6).fill(0), ...o,
})

// ── ladder shape ────────────────────────────────────────────────────────────
chk('ladder has levels', LEVELS.length >= 10)
chk('ids are 1..N in order', LEVELS.every((l, i) => l.id === i + 1))
chk('every level has a positive move budget', LEVELS.every((l) => l.moves > 0))
chk('collect levels name a colour', LEVELS.filter((l) => l.goal.kind === 'collect').every((l) => l.goal.color != null))
chk('levelAt clamps', levelAt(-5).id === 1 && levelAt(999).id === LEVELS.length)
chk('isLastLevel', isLastLevel(LEVELS.length - 1) && !isLastLevel(0))

// ── collect goal: only the goal colour counts ───────────────────────────────
{
  const goal: Goal = { kind: 'collect', target: 10, color: 1 } // Water
  let got = 0
  got = trackStep(got, goal, step({ colorCounts: [3, 4, 0, 0, 0, 0] })) // 4 Water
  got = trackStep(got, goal, step({ colorCounts: [0, 5, 2, 0, 0, 0] })) // 5 Water
  chk('collect tallies only goal colour', got === 9, `got ${got}`)
  chk('collect not met at 9/10', !goalMet(got, goal, 0))
  got = trackStep(got, goal, step({ colorCounts: [0, 2, 0, 0, 0, 0] }))
  chk('collect met at 11/10', goalMet(got, goal, 0))
  chk('progress caps at target', goalProgress(got, goal, 0) === 10)
}

// ── bloom goal counts spawned specials ──────────────────────────────────────
{
  const goal: Goal = { kind: 'bloom', target: 3 }
  let got = 0
  got = trackStep(got, goal, step({ spawned: [{ i: 0, kind: 'surgeH' }, { i: 1, kind: 'star' }] }))
  chk('bloom counts spawns', got === 2)
  got = trackStep(got, goal, step({ spawned: [{ i: 2, kind: 'prism' }] }))
  chk('bloom met at 3', goalMet(got, goal, 0))
}

// ── puffs goal counts burst puffs ───────────────────────────────────────────
{
  const goal: Goal = { kind: 'puffs', target: 4 }
  let got = trackStep(0, goal, step({ puffs: 2 }))
  got = trackStep(got, goal, step({ puffs: 3 }))
  chk('puffs accumulate + met', goalMet(got, goal, 0) && got === 5)
}

// ── score goal reads the running score, not `got` ───────────────────────────
{
  const goal: Goal = { kind: 'score', target: 3500 }
  chk('score not met below', !goalMet(0, goal, 3000))
  chk('score met at/above', goalMet(0, goal, 3600))
  chk('score label', goalLabel(goal) === 'Reach 3500')
}

chk('collect label reads element', goalLabel({ kind: 'collect', target: 22, color: 1 }) === 'Clear 22 Water')

// ── resolve actually reports colour counts that match the clear ─────────────
{
  // a guaranteed horizontal 3-run of colour 2 at row 0
  const b: Cell[] = Array.from({ length: W * H }, () => gem(5))
  b[idx(0, 0)] = gem(2); b[idx(1, 0)] = gem(2); b[idx(3, 0)] = gem(2)
  // swap (2,0)<->(3,0)? need a real match — place so a swap makes the run:
  b[idx(2, 0)] = gem(0); b[idx(2, 1)] = gem(2)
  const nb = swapped(b, idx(2, 0), idx(2, 1)) // brings a colour-2 into (2,0) → 3-run of colour 2
  const res = resolve(nb, rng, { swapAt: idx(2, 0) })
  const totalColor2 = res.steps.reduce((a, s) => a + s.colorCounts[2], 0)
  chk('resolve tallies colour-2 clears (>=3)', totalColor2 >= 3, `got ${totalColor2}`)
  const sumMatched = res.steps.reduce((a, s) => a + s.matched.length, 0)
  const sumColors = res.steps.reduce((a, s) => a + s.colorCounts.reduce((x, y) => x + y, 0), 0)
  chk('colour totals ≤ matched totals (puffs excluded)', sumColors <= sumMatched)
}

console.log(`\nquests: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
