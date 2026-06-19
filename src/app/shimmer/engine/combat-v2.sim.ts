// PROTOTYPE — physical/special split stat model, proven headless before any engine wiring.
// Run: npx tsx src/app/shimmer/engine/combat-v2.sim.ts [level]
//
// Goal (Alex, 2026-06-19): split attack/defense into PHYSICAL and SPIRIT (non-physical)
// so every spirit has a niche if played right — a skill gap, no strictly-dominated units.
// A physical wall folds to spirit moves and vice-versa; the skill = read the foe's weaker
// defense and hit it. This file is a sandbox: new stat lines + damage math + an AI that
// plays the split correctly, graded by the same round-robin matrix as species-balance.sim.
//
// Nothing here touches battle.ts / party-battle.ts yet — we tune the numbers in isolation,
// get Alex's taste-nod on the archetypes, THEN integrate.

type Species =
  | 'fox' | 'axolotl' | 'owl' | 'frog' | 'firefly'
  | 'rabbit' | 'water-bear' | 'hummingbird' | 'turtle' | 'bat'

const SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
const ABBR: Record<Species, string> = {
  fox: 'fox', axolotl: 'axo', owl: 'owl', frog: 'frog', firefly: 'ffly', rabbit: 'rbbt',
  'water-bear': 'wbr', hummingbird: 'hmbd', turtle: 'trtl', bat: 'bat',
}

interface Stats { pwr: number; grd: number; foc: number; res: number; agi: number; vig: number }

// ── First-draft archetypes (the taste-call layer — Alex edits these) ──
// pwr/grd = physical atk/def · foc/res = spirit atk/def · agi = speed+evasion · vig = HP
// Each line is a ROLE; the comment names the niche it should hold.
const BASE: Record<Species, Stats> = {
  // role                              pwr grd foc res agi vig
  fox:           s('balanced phys skirmisher', 55, 40, 35, 35, 55, 42),
  axolotl:       s('spirit sustain wall',       25, 45, 48, 55, 30, 62),
  owl:           s('spirit attacker / caster',  30, 35, 65, 45, 45, 42),
  frog:          s('physical sweeper',          60, 32, 28, 30, 60, 40),
  firefly:       s('spirit glass cannon',       28, 22, 70, 26, 60, 30),
  rabbit:        s('evasive physical bruiser',  48, 38, 30, 42, 66, 46),
  'water-bear':  s('physical wall',             30, 70, 26, 48, 16, 66),
  hummingbird:   s('hyper-fast mixed evader',   50, 22, 46, 26, 72, 32),
  turtle:        s('spirit wall / pivot',       35, 55, 36, 66, 16, 60),
  bat:           s('fast spirit skirmisher',    42, 30, 56, 36, 60, 40),
}
function s(_role: string, pwr: number, grd: number, foc: number, res: number, agi: number, vig: number): Stats {
  return { pwr, grd, foc, res, agi, vig }
}

const LEVEL = Number(process.argv[2]) || 25
const RUNS = 200

// Softer curve than the live model (no harsh 50 cap that flattened everyone) — specialization survives.
// HP scaling kept LEAN so time-to-kill is short enough that speed + evasion + hitting the weak
// defense actually decide fights (fat HP pools drown offense and hand the game to sustain walls).
function derive(b: Stats): Stats & { hp: number } {
  const k = 1 + LEVEL / 60
  const d = (v: number) => Math.round(v * k)
  const vig = d(b.vig)
  return { pwr: d(b.pwr), grd: d(b.grd), foc: d(b.foc), res: d(b.res), agi: d(b.agi), vig, hp: Math.round(vig * 1.6 + 15) }
}

// Two move categories. In the real game these come from MoveState (solid/compact = physical,
// ignite/flow/scatter/expanding/bind = spirit). Here: one representative move of each + a weak Strike.
type Cat = 'phys' | 'spirit'
interface Move { name: string; power: number; cat: Cat }
const PHYS: Move = { name: 'Strike-heavy', power: 68, cat: 'phys' }
const SPIRIT: Move = { name: 'Spirit-burst', power: 68, cat: 'spirit' }

interface Fighter { sp: Species; st: Stats & { hp: number }; hp: number }
function mk(sp: Species): Fighter { const st = derive(BASE[sp]); return { sp, st, hp: st.hp } }

// Damage: category picks the atk/def pair. Pokémon-shape formula. Same element → no STAB/eff noise.
function damage(atk: Fighter, def: Fighter, mv: Move, rng: () => number): number {
  const a = mv.cat === 'phys' ? atk.st.pwr : atk.st.foc
  const d = mv.cat === 'phys' ? def.st.grd : def.st.res
  const base = ((2 * LEVEL / 5 + 2) * mv.power * (a / Math.max(1, d))) / 50 + 2
  return Math.max(1, Math.round(base * (0.85 + rng() * 0.15)))
}

// AGI gives evasion: a faster defender dodges sometimes (caps at 30%). This is what keeps the
// fast-but-frail archetypes (firefly/hummingbird) alive if played right.
function evades(atk: Fighter, def: Fighter, rng: () => number): boolean {
  const gap = def.st.agi - atk.st.agi
  const chance = Math.max(0, Math.min(0.40, gap * 0.009))
  return rng() < chance
}

// Smart AI = the skill expression: hit the foe's WEAKER defense (pick the category that does more).
function bestMove(atk: Fighter, def: Fighter): Move {
  const phys = atk.st.pwr / Math.max(1, def.st.grd)
  const spirit = atk.st.foc / Math.max(1, def.st.res)
  return spirit > phys ? SPIRIT : PHYS
}

function duel(aSp: Species, bSp: Species, rng: () => number): boolean {
  const a = mk(aSp), b = mk(bSp)
  // initiative by agi; on a tie, coin-flip per turn (no fixed side bias)
  let guard = 0
  while (a.hp > 0 && b.hp > 0 && guard < 500) {
    const aFirst = a.st.agi !== b.st.agi ? a.st.agi > b.st.agi : rng() < 0.5
    const order: [Fighter, Fighter][] = aFirst ? [[a, b], [b, a]] : [[b, a], [a, b]]
    for (const [atk, def] of order) {
      if (atk.hp <= 0 || def.hp <= 0) continue
      if (evades(atk, def, rng)) continue
      def.hp -= damage(atk, def, bestMove(atk, def), rng)
    }
    guard++
  }
  return a.hp > 0 && b.hp <= 0
}

// deterministic-ish RNG per pairing so reruns are stable (vary by indices, no Date/Math.random global seed)
function makeRng(seed: number) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296 } }

const win: Record<string, Record<string, number>> = {}
for (let ai = 0; ai < SPECIES.length; ai++) {
  const a = SPECIES[ai]; win[a] = {}
  for (let bi = 0; bi < SPECIES.length; bi++) {
    const b = SPECIES[bi]
    if (a === b) { win[a][b] = 50; continue }
    const rng = makeRng((ai + 1) * 7919 + (bi + 1) * 104729)
    let w = 0
    for (let i = 0; i < RUNS; i++) if (duel(a, b, rng)) w++
    win[a][b] = (w / RUNS) * 100
  }
}

console.log(`\n=== Combat v2 (phys/spirit split) — L${LEVEL}, ${RUNS}/pair, smart category targeting + agi evasion ===\n`)
console.log('vs    ' + SPECIES.map(x => ABBR[x].padStart(5)).join(''))
for (const a of SPECIES) {
  console.log(ABBR[a].padEnd(6) + SPECIES.map(b => (a === b ? '  -  ' : win[a][b].toFixed(0).padStart(5))).join(''))
}

console.log('\n=== Marginal win% (avg vs field) — balanced = tight band near 50 ===\n')
const marg = SPECIES.map(a => {
  const opp = SPECIES.filter(b => b !== a)
  return { a, avg: opp.reduce((s, b) => s + win[a][b], 0) / opp.length }
}).sort((x, y) => y.avg - x.avg)
for (const { a, avg } of marg) console.log(`${ABBR[a].padEnd(6)} ${avg.toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(avg / 2))}`)
const spread = marg[0].avg - marg[marg.length - 1].avg
console.log(`\nspread: ${spread.toFixed(1)} pts  ${spread < 22 ? '→ well balanced' : spread < 35 ? '→ close, minor tuning' : '→ keep tuning'}`)

// Niche check: every spirit should beat SOMETHING decisively (>60%) — proof it's not dead weight.
console.log('\n=== Niche check — each spirit\'s best matchups (played right, who do they beat?) ===\n')
for (const a of SPECIES) {
  const beats = SPECIES.filter(b => b !== a && win[a][b] >= 60).sort((x, y) => win[a][y] - win[a][x])
  const tag = beats.length ? beats.slice(0, 4).map(b => `${ABBR[b]} ${win[a][b].toFixed(0)}%`).join(', ') : '⚠ beats nobody >60% — dead unit'
  console.log(`${ABBR[a].padEnd(6)} → ${tag}`)
}
console.log('')
