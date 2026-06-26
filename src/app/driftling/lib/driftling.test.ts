// DRIFTLING sim sanity — run with: npx tsx src/app/driftling/lib/driftling.test.ts
import {
  makeWorld,
  setHeading,
  tick,
  addCreature,
  apexName, // ensure exports resolve
  LADDER,
  START_TIER,
  APEX_TIER,
  ELEMENTS, // ensure exports resolve
  TARGET_CREATURES,
  type World,
} from './driftling'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
// freeze the field so hand-placed creatures aren't crowded by the spawner
function solo(w: World) { w.creatures = []; w.spawnPaused = true }

// 1. ready → playing on first heading; a zero heading doesn't launch
{
  const w = makeWorld(1)
  ok('starts ready', w.state === 'ready')
  ok('tick no-op while ready', tick(w, 0.1).ate === false && w.state === 'ready')
  setHeading(w, 0, 0)
  ok('zero heading stays ready', w.state === 'ready')
  setHeading(w, 1, 0)
  ok('a real heading launches the drift', w.state === 'playing')
  ok('ocean is seeded with life', makeWorld(1).creatures.length === TARGET_CREATURES)
}

// 2. drift physics — heading eases the body that way, drag bleeds a coast
{
  const w = makeWorld(1); w.state = 'playing'; solo(w)
  setHeading(w, 1, 0); tick(w, 0.1)
  ok('heading right builds +vx', w.vx > 0)
  setHeading(w, 0, 1); const beforeVy = w.vy; tick(w, 0.1)
  ok('heading down builds +vy', w.vy > beforeVy)
  setHeading(w, 0, 0); const coast = Math.hypot(w.vx, w.vy); tick(w, 0.2)
  ok('coasting bleeds speed (drag)', Math.hypot(w.vx, w.vy) < coast)
}

// 3. eat-smaller-grows — overlap a smaller creature → consume + mass up
{
  const w = makeWorld(2); w.state = 'playing'; solo(w)
  addCreature(w, w.x, w.y, 0, 'water') // a mote, well below the start tier
  const ev = tick(w, 1 / 60)
  ok('smaller creature is eaten', ev.ate && w.creatures.length === 0)
  ok('eating adds mass', w.mass > 0 && w.eaten === 1)
}

// 4. eaten-by-bigger-ends — overlap a bigger creature → run ends
{
  const w = makeWorld(2); w.state = 'playing'; solo(w)
  addCreature(w, w.x, w.y, START_TIER + 2, 'storm') // two tiers up = clearly bigger
  const ev = tick(w, 1 / 60)
  ok('bigger creature ends the run', ev.eaten && (w.state as string) === 'dead')
  ok('death scores', w.score > 0)
}

// 5. equal-bumps — overlap a same-size creature → neither eats, they push apart
{
  const w = makeWorld(2); w.state = 'playing'; solo(w)
  const c = addCreature(w, w.x + 1, w.y, START_TIER, 'earth') // same tier = same size
  const ev = tick(w, 1 / 60)
  ok('equal sizes bump, no eat', ev.bumped && !ev.ate && w.state === 'playing')
  ok('bump survives the creature', w.creatures.length === 1)
  ok('bump pushes them apart', Math.hypot(c.x - w.x, c.y - w.y) > 1)
}

// 6. first-eat-locks-fork — the first consumed element locks the branch; later eats don't move it
{
  const w = makeWorld(3); w.state = 'playing'; solo(w)
  ok('branch starts unlocked', w.branch === null && apexName(w) === null)
  addCreature(w, w.x, w.y, 0, 'storm')
  const ev = tick(w, 1 / 60)
  ok('first eat locks the fork', ev.forkLocked === 'storm' && w.branch === 'storm')
  ok('apex resolves from the branch', typeof apexName(w) === 'string')
  addCreature(w, w.x, w.y, 0, 'water')
  const ev2 = tick(w, 1 / 60)
  ok('a later eat does not relock', ev2.ate && ev2.forkLocked === null && w.branch === 'storm')
}

// 7. mass-crosses-threshold-evolves — clearing a tier's mass bar jumps you up a station
{
  const w = makeWorld(4); w.state = 'playing'; solo(w)
  const startSize = w.size
  w.mass = LADDER[START_TIER].evolveAt - 0.01 // one bite shy of evolving
  addCreature(w, w.x, w.y, 0, 'mana')
  const ev = tick(w, 1 / 60)
  ok('crossing the threshold evolves', ev.grew && w.tier === START_TIER + 1)
  ok('evolving grows the body', w.size > startSize && w.size === LADDER[START_TIER + 1].size)
}

// 8. branch-biases-spawn — once locked, the spawn mix leans toward your element
{
  const w = makeWorld(5); w.state = 'playing'
  w.branch = 'mana'
  w.creatures = [] // clear the unbiased seed
  let manaSeen = 0, totalSeen = 0
  // repeatedly drain a third of the field + tick so the spawner refills with biased life,
  // sampling every fresh spawn's element over many top-ups
  for (let i = 0; i < 3000; i++) {
    w.creatures = w.creatures.filter((_, idx) => idx % 3 !== 0)
    const before = w.nextId
    tick(w, 1 / 60)
    for (const c of w.creatures) {
      if (c.id >= before) { totalSeen++; if (c.element === 'mana') manaSeen++ }
    }
  }
  const frac = manaSeen / Math.max(1, totalSeen)
  ok('branch element is over-represented in spawns', totalSeen > 500 && frac > 0.4) // vs 0.25 unbiased
}

// 9. determinism — same seed, same world; different seed differs
{
  const a = makeWorld(2024), b = makeWorld(2024), c = makeWorld(2025)
  ok('same seed → same first creature', a.creatures[0].x === b.creatures[0].x && a.creatures[0].element === b.creatures[0].element)
  const differs = a.creatures.some((cr, i) => cr.x !== c.creatures[i].x)
  ok('different seed → different field', differs)
  // run both a + b identically → identical state
  a.state = b.state = 'playing'
  for (let i = 0; i < 120; i++) { setHeading(a, 1, 0.5); setHeading(b, 1, 0.5); tick(a, 1 / 60); tick(b, 1 / 60) }
  ok('identical runs stay identical', a.x === b.x && a.mass === b.mass && a.creatures.length === b.creatures.length)
}

// 10. apex tier caps — mass cannot evolve past the apex station
{
  const w = makeWorld(6); w.state = 'playing'; solo(w)
  w.tier = APEX_TIER; w.size = LADDER[APEX_TIER].size; w.mass = 99999
  addCreature(w, w.x, w.y, 0, 'earth')
  tick(w, 1 / 60)
  ok('apex is the ceiling', w.tier === APEX_TIER)
}

console.log(`\nDRIFTLING sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
