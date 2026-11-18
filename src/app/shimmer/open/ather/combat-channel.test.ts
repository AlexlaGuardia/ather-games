// npx tsx src/app/shimmer/open/ather/combat-channel.test.ts  (M15c: channel + veil casts in the open world)
import { newCombat, spawnHollow, stepCombat, type Terrain } from './combat'
import { runCast, beginChannel, channelTick } from './combat-casts'
import { castForMove } from '../../play3d/cast'
import { castsHere } from '../shared/casting'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
const eye = { x: 0, y: 1.6, z: 0 }, fwd = { x: 0, y: 0, z: -1 }
ok(castsHere(castForMove('meltbore')) && castsHere(castForMove('heat-mirage')), 'channel and veil are in the open world\'s runnable set')

// CHANNEL: billed per second while held, credits only what was paid, stops on release
{
  const sp = castForMove('meltbore'); let run = beginChannel(sp), mana = 50
  for (let i = 0; i < 20; i++) { const r = channelTick(run, 0.05, mana, true); run = r.run; mana = r.mana; ok(r.ended === null, 'held: ended early') }
  ok(Math.abs(mana - (50 - sp.sustainDrain)) < 1e-6, `1 s held bills sustainDrain (${sp.sustainDrain}): mana ${mana}`)
  ok(Math.abs(run.sustain.held - 1) < 1e-6, `1 s credited (${run.sustain.held})`)
  const r = channelTick(run, 0.05, mana, false)
  ok(r.ended === 'released' && r.mana === mana && r.run.sustain.held === run.sustain.held, 'release: stops, bills nothing more')
}
// out of mana: the last partial second is paid and credited partially, then it stops
{
  const sp = castForMove('meltbore'); let run = beginChannel(sp), mana = 2, ended: string | null = null
  for (let i = 0; i < 40 && !ended; i++) { const r = channelTick(run, 0.05, mana, true); run = r.run; mana = r.mana; ended = r.ended }
  ok(ended === 'dry' && mana === 0, `dry pool ends it (${ended}, mana ${mana})`)
  ok(Math.abs(run.sustain.held - 2 / sp.sustainDrain) < 1e-6, `only the paid time is credited (${run.sustain.held})`)
  ok(channelTick(run, 0.05, 0, true).ended === 'dry', 'empty pool: cannot start another second')
}
// VEIL: Hollows go for the decoy, then the keeper once it is gone
{
  const sp = castForMove('heat-mirage'), c = newCombat(1)
  const feet = { x: 0, y: 0, z: 0 }
  const h = spawnHollow(c, T, 10, 10); h.state = 'chase'
  runCast(c, T, eye, { x: 1, y: 0, z: 0 }, sp)
  ok(!!c.decoy && Math.abs(c.decoy.x - sp.decoyOffset) < 1e-6, `decoy stands decoyOffset out (${JSON.stringify(c.decoy)})`)
  // park the keeper far from the Hollow and the decoy next to it: it must walk at the decoy
  c.decoy = { ...c.decoy!, x: 20, z: 10, until: 100 }
  const d0 = Math.hypot(h.x - 20, h.z - 10), k0 = Math.hypot(h.x - feet.x, h.z - feet.z)
  for (let i = 0; i < 20; i++) stepCombat(c, T, feet, 0.05)
  ok(Math.hypot(h.x - 20, h.z - 10) < d0 - 0.5, 'while it lasts, the Hollow closes on the decoy')
  ok(Math.hypot(h.x - feet.x, h.z - feet.z) > k0 - 0.3, 'while it lasts, the Hollow does not close on the keeper')
  c.decoy.until = 0   // expired
  const z0 = Math.hypot(h.x - feet.x, h.z - feet.z)
  for (let i = 0; i < 20; i++) stepCombat(c, T, feet, 0.05)
  ok(Math.hypot(h.x - feet.x, h.z - feet.z) < z0 - 0.5, 'after it expires, the Hollow turns to the keeper')
}
// a floater spits at the decoy: the round leaves toward it, not toward the keeper
{
  const c = newCombat(1), feet = { x: 0, y: 0, z: 0 }
  const h = spawnHollow(c, T, 0, 8, 'floater'); h.state = 'charge'; h.t = 0
  c.decoy = { x: 6, z: 8, y: 0, until: 100, moveId: 'heat-mirage' }
  stepCombat(c, T, feet, 0.05)
  const s = c.spits[0]
  ok(!!s && s.vx > 0 && Math.abs(s.vz) < Math.abs(s.vx) * 0.2, `spit flies at the decoy (${s ? `${s.vx.toFixed(1)},${s.vz.toFixed(1)}` : 'none'})`)
}
console.log(fail ? `FAIL ${fail}` : `PASS ${pass}`); process.exit(fail ? 1 : 0)
