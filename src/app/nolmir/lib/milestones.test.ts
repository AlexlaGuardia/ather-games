// NOLMIR milestone beats — the pure decision behind the Starforge claim toast.
// Run: npx tsx src/app/nolmir/lib/milestones.test.ts
import { planetMilestone } from './milestones'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
const name = (i: number) => ['Cinder', 'Pale Echo', 'Brundt', 'Veilmoor'][i] ?? `world ${i}`
const F = false, T = true

// arming — the first paint sets the baseline, no retroactive fanfare
ok('null prev → no beat (arms the ref)', planetMilestone(null, [F, F, F, F], name) === null)
ok('loading with worlds already worked → no beat', planetMilestone(null, [T, T, F, F], name) === null)

// first world
{
  const m = planetMilestone([F, F, F, F], [T, F, F, F], name)
  ok('claiming the first world beats', m !== null)
  ok('first world → "First World Claimed"', m?.text === 'First World Claimed')
  ok('first world names the world', m?.sub.includes('Cinder') === true)
  ok('first world is not the full-system fanfare', m?.full === false)
}

// a middle world
{
  const m = planetMilestone([T, F, F, F], [T, T, F, F], name)
  ok('claiming a 2nd world beats', m?.text === 'World Claimed')
  ok('middle world names it + shows the count', m?.sub.includes('Pale Echo') === true && m?.sub.includes('2') === true)
  ok('middle world is not full', m?.full === false)
}

// the full system — the big one
{
  const m = planetMilestone([T, T, T, F], [T, T, T, T], name)
  ok('claiming the last world → "System Claimed"', m?.text === 'System Claimed')
  ok('full system sets full=true (the levelUp fanfare)', m?.full === true)
  ok('full system reports all worlds', m?.sub.includes('all 4 worlds') === true)
}

// no beat on a deepen (mask unchanged) or a decrease
ok('deepening (mask unchanged) → no beat', planetMilestone([T, F, F, F], [T, F, F, F], name) === null)
ok('a decrease (a line lost) → no beat', planetMilestone([T, T, F, F], [T, F, F, F], name) === null)

// only fires for a genuinely NEW world, even if another changed level
ok('same worked-set, different levels → no beat', planetMilestone([T, T, F, F], [T, T, F, F], name) === null)

// missing name falls back gracefully
{
  const m = planetMilestone([F, F], [T, F], () => '')
  ok('empty name falls back to "a new world"', m?.sub.includes('a new world') === true)
}

console.log(`\nMILESTONES: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
