// VAULT authored-level verification — bake a finite level from the procedural stream,
// then play it back with streaming OFF. Guards the /vault/dev editor's data path.
// Run: npx tsx src/app/vault/lib/vault.authored.test.ts
import {
  makeWorld, makeAuthoredWorld, bakeLevel, tick, pressJump, releaseJump, speedOf,
  STEP_UP, FOE_W, levelCfg, type World, type AuthoredLevel, type BoundState,
} from './vault'

const PLAYING: BoundState = 'playing' // widen so TS doesn't narrow w.state to the literal (tick() mutates it)
const stateOf = (w: World): BoundState => w.state // read across a fn boundary so a preceding loop can't narrow it

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

// competent hop-only bot (same shape as the levels oracle), but plays a GIVEN world
function botBeats(w: World, maxT = 160): { won: boolean; maxSegs: number; genX0: number; genXEnd: number } {
  pressJump(w)
  let holding = false, releaseX = -Infinity
  const dt = 1 / 60
  let t = 0
  const genX0 = w.genX
  let maxSegs = w.segs.length
  while (w.state === 'playing' && t < maxT) {
    maxSegs = Math.max(maxSegs, w.segs.length)
    const dist = w.dist
    const speed = speedOf(w, dist)
    const cur = w.segs.find((s) => dist >= s.x0 && dist <= s.x1)
    const next = w.segs.filter((s) => s.x0 > dist).sort((a, b) => a.x0 - b.x0)[0]
    const targets: { x: number; clearX: number; high: boolean }[] = []
    if (cur && next && next.x0 > cur.x1 + 1) targets.push({ x: cur.x1, clearX: next.x0 + 4, high: next.top < cur.top - STEP_UP })
    const haz = [...w.foes.filter((f) => !f.dead && f.x > dist), ...w.spikes.filter((s) => s.x > dist)].map((o) => o.x).sort((a, b) => a - b)[0]
    if (haz != null) targets.push({ x: haz, clearX: haz + FOE_W + 18, high: false })
    targets.sort((a, b) => a.x - b.x)
    const tg = targets[0]
    if (w.grounded || w.coyote > 0) {
      const lead = Math.max(8, speed * (tg?.high ? 0.06 : 0.04))
      if (tg && tg.x - dist <= lead) { pressJump(w); holding = true; releaseX = tg.clearX + (tg.high ? 45 : 0) }
    } else if (holding) {
      if (dist > releaseX) { releaseJump(w); holding = false }
    }
    tick(w, dt); t += dt
  }
  return { won: w.state === 'won', maxSegs, genX0, genXEnd: w.genX }
}

const cfg = levelCfg(1, 4) // a mid-ladder movement (has foes/spikes, finite goal)

// ── bake produces a well-formed finite level ──────────────────────────────────
{
  const lvl = bakeLevel(12345, cfg, 6000)
  chk('bake sets the end', lvl.end === 6000)
  chk('bake produced segments', lvl.segs.length >= 3)
  chk('all segs within [.., end]', lvl.segs.every((s) => s.x0 < 6000 && s.x1 <= 6000))
  chk('foes within the level', lvl.foes.every((f) => f.x < 6000))
  chk('spikes within the level', lvl.spikes.every((s) => s.x < 6000))
  chk('motes within the level', lvl.motes.every((m) => m.x < 6000))
  chk('segs cover most of the span (few holes)', lvl.segs.reduce((a, s) => a + (s.x1 - s.x0), 0) > 6000 * 0.55)
}

// ── authored world plays back WITHOUT streaming ───────────────────────────────
{
  const lvl = bakeLevel(777, cfg, 5200)
  const w = makeAuthoredWorld(lvl)
  chk('authored flag set', w.authored === true)
  chk('loaded the authored segs', w.segs.length === lvl.segs.length)
  const r = botBeats(w)
  chk('no streaming: genX never advanced', r.genXEnd === r.genX0)
  chk('no streaming: seg count never grew', r.maxSegs === lvl.segs.length)
  chk('a competent bot clears the baked level', r.won, JSON.stringify({ segs: lvl.segs.length }))
}

// ── determinism: same level + same input → identical run ──────────────────────
{
  const lvl = bakeLevel(2024, cfg, 4000)
  const play = () => { const w = makeAuthoredWorld(lvl); const r = botBeats(w); return `${r.won}:${Math.round(w.dist)}:${w.score}` }
  chk('authored playback is deterministic', play() === play())
}

// ── bake is deterministic (same seed → same level) ────────────────────────────
{
  const a = bakeLevel(555, cfg, 3000), b = bakeLevel(555, cfg, 3000)
  chk('bake is deterministic', JSON.stringify(a) === JSON.stringify(b))
}

// ── THE HIGH ROAD: authored multi-surface branching (2026-07-21) ──────────────
// Baking from a ledged cfg captures the high road; it survives bake → load into the
// same w.ledges the resolver already reads, so authored levels branch high/low too.
const ledgedCfg = { ...cfg, ledges: true }
{
  const lvl = bakeLevel(4242, ledgedCfg, 6000)
  chk('bake captured a high road', (lvl.ledges?.length ?? 0) > 0, JSON.stringify({ ledges: lvl.ledges?.length }))
  chk('ledges within [.., end]', (lvl.ledges ?? []).every((s) => s.x0 < 6000 && s.x1 <= 6000))
  chk('ledges sit above the ground track', (lvl.ledges ?? []).every((s) => s.top < 224)) // TOP_MAX; a ledge is higher (smaller y) than default ground
  const w = makeAuthoredWorld(lvl)
  chk('authored world loaded the high road', w.ledges.length === (lvl.ledges?.length ?? 0))
  const r = botBeats(w)
  chk('no streaming with a high road present', r.genXEnd === r.genX0)
  // (a ground-blind bot may die on the high road — landing up top then walking off a gap it meant to
  //  clear is CORRECT multi-surface behavior, not a failure. Branching is proven directly below.)
}
// ── DIRECT branching proof: same x, two surfaces, both reachable ──────────────
// A flat low road the whole way + one easy-hop ledge over the middle. Never jumping →
// stay on the low road to the finish. Hop over the ledge span → the resolver stands the
// runner ON the authored ledge (onLedge set, feet at its top). That is the branch.
{
  const flat = (end: number): AuthoredLevel => ({
    seed: 1, end,
    segs: [{ x0: -200, x1: end + 1200, top: 212 }], // TOP_BASE ground, gap-free, extends past the goal
    ledges: [{ x0: 900, x1: 1500, top: 176 }],       // ~36px up — a comfortable hop, long enough to stand on
    foes: [], spikes: [], motes: [],
  })
  // low road: never touch jump → finish grounded on the ground track, never on a ledge
  {
    const w = makeAuthoredWorld(flat(2400))
    w.state = PLAYING // start the run without any input (pressJump would buffer a hop)
    let everHigh = false
    for (let t = 0; t < 30 && w.state === 'playing'; t += 1 / 60) { tick(w, 1 / 60); if (w.onLedge) everHigh = true }
    chk('low road: reaches the finish without jumping', stateOf(w) === 'won', stateOf(w))
    chk('low road: never stood on the high road', !everHigh)
  }
  // high road: hop while crossing the ledge span → the resolver lands the runner on the authored ledge
  {
    const w = makeAuthoredWorld(flat(2400))
    w.state = PLAYING
    let landedHigh = false, landedTop = 0
    for (let t = 0; t < 30 && w.state === 'playing'; t += 1 / 60) {
      if (w.grounded && w.dist > 780 && w.dist < 1400) pressJump(w) // hop up onto the ledge as it arrives
      tick(w, 1 / 60)
      if (w.onLedge) { landedHigh = true; landedTop = w.y }
    }
    chk('high road: the runner stood on the authored ledge', landedHigh)
    chk('high road: feet sat at the ledge top (176)', landedHigh && Math.abs(landedTop - 176) < 1, String(landedTop))
  }
}
// back-compat: a pre-high-road level (no `ledges` field) loads with an empty high road and still plays.
{
  const base = bakeLevel(88, cfg, 4000)
  const legacy: AuthoredLevel = { seed: base.seed, end: base.end, segs: base.segs, foes: base.foes, spikes: base.spikes, motes: base.motes }
  const w = makeAuthoredWorld(legacy)
  chk('legacy level → empty high road (no crash)', w.ledges.length === 0)
  chk('legacy level still clears', botBeats(w).won)
}
// bake with a high road is deterministic (same seed → identical ledges)
{
  const a = bakeLevel(999, ledgedCfg, 3000), b = bakeLevel(999, ledgedCfg, 3000)
  chk('ledged bake is deterministic', JSON.stringify(a.ledges) === JSON.stringify(b.ledges))
}

console.log(`\nvault authored: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
