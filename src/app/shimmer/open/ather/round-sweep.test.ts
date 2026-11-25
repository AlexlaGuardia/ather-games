// npx tsx src/app/shimmer/open/ather/round-sweep.test.ts
// BETA M175 + M177: a round's WHOLE step is tested against Hollows, up to where it enters the ground (or a wall). Before,
// a round whose step ended underground was stopped BEFORE the hit test, so at a low frame rate (or with a faster round) a
// low crawler right in its path was unhittable; and the near-cull read the step's END, so a body near its START was skipped.
import { wakeChampion, CHAMP } from './champion'
import { newCombat, spawnHollow, stepCombat, groundEntry, throughGround, crawlerScale, CRAWLER, BODY_Y, type Terrain } from './combat'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  x', m) } }
const flat: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
const feet = { x: 0, y: 0, z: 40 }   // the keeper well away (the Hollows here are held, they do not reach)
type C = ReturnType<typeof newCombat>
const shoot = (c: C, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, speed: number) => {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, l = Math.hypot(dx, dy, dz)
  c.rounds.push({ x: from.x, y: from.y, z: from.z, vx: dx / l * speed, vy: dy / l * speed, vz: dz / l * speed, life: 2, dmg: 1000, crit: 1000 } as never)
}
const held = (c: C, T: Terrain, x: number, z: number, kind: 'crawler' | 'shambler' = 'crawler') => { const h = spawnHollow(c, T, x, z, kind); h.state = 'stagger'; h.t = 99; return h }

// 1. M175: a low crawler 6 m off, a round aimed down at its body at 90 m/s; at 20 / 10 / 5 fps a step ends underground past it
for (const dt of [0.05, 0.1, 0.2]) {
  const c = newCombat(1), h = held(c, flat, 0, -6)
  shoot(c, { x: 0, y: 1.5, z: -0.4 }, { x: 0, y: CRAWLER.bodyY * crawlerScale(1), z: -6 }, 90)
  for (let i = 0; i < 10 && c.rounds.length; i++) stepCombat(c, flat, feet, dt)
  ok(h.hp <= 0 || !c.hollows.includes(h), `1. dt ${dt}: the crawler under the round's last step is hit (hp ${h.hp})`)
  ok(c.rounds.length === 0, `   dt ${dt}: the round is spent`)
}
// 2. the ground still shields: a crest between the keeper and a Hollow takes the round, however big the step
{
  const hill: Terrain = { heightAt: (_x: number, z: number) => (z < -3 && z > -5 ? 3 : 0), walkable: () => true } as unknown as Terrain
  for (const dt of [0.02, 0.2]) {
    const c = newCombat(1), h = held(c, hill, 0, -9, 'shambler'), hp = h.hp
    shoot(c, { x: 0, y: 1.5, z: 0 }, { x: 0, y: BODY_Y, z: -9 }, 120)
    for (let i = 0; i < 20; i++) stepCombat(c, hill, feet, dt)
    ok(h.hp === hp, `2. dt ${dt}: a Hollow behind a crest is not hit through it (hp ${hp} -> ${h.hp})`)
  }
}
// 3. the near-cull reads the whole step: a fast round (200 m/s at 10 fps = 20 m) past a body near the step's START hits it
{
  const c = newCombat(1), h = held(c, flat, 0, -2, 'shambler')
  shoot(c, { x: 0, y: BODY_Y, z: -0.4 }, { x: 0, y: BODY_Y, z: -30 }, 200)
  stepCombat(c, flat, feet, 0.1)
  ok(h.hp <= 0 || !c.hollows.includes(h), `3. a body 1.6 m into a 20 m step is hit (hp ${h.hp})`)
}
// 3b. the champion's near-cull the same: one 20 m step past its body 3 m off lands on it (a hit event for the champion, id -1)
{
  const c = newCombat(1)
  wakeChampion(c, flat, { id: 'n', x: 0, z: -3 } as never)
  shoot(c, { x: 0, y: CHAMP.bodyY, z: -0.4 }, { x: 0, y: CHAMP.bodyY, z: -30 }, 200)
  stepCombat(c, flat, feet, 0.1)
  ok(c.events.some(e => e.kind === 'hit' && e.id === -1), `3b. the champion 3 m into a 20 m step is hit (${JSON.stringify(c.events.map(e => e.kind))})`)
}
// 4. groundEntry: where a segment first goes under, refined (null when it stays above)
{
  const t = groundEntry(flat, 0, 2, 0, 0, -2, 10)
  ok(t !== null && Math.abs(t - 0.5) < 0.01, `4. a segment 2 -> -2 enters flat ground half way (t ${t})`)
  ok(groundEntry(flat, 0, 2, 0, 0, 1, 10) === null, '   one that stays above: null')
  ok(throughGround(flat, 0, 2, 0, 0, -2, 10) && !throughGround(flat, 0, 2, 0, 0, 1, 10), '   throughGround agrees')
}
console.log(`round-sweep: ${pass} ok, ${fail} failed`)
if (fail) process.exit(1)
