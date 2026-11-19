// node test: npx tsx src/app/shimmer/open/shared/fight-share.test.ts (BETA M28 slice 2)
import { hostOf, sharing, encodeSnap, applySnap, SNAP_MAX, type NetHollow } from './fight-share'
import { newCombat, spawnHollow, stepCombat, type Terrain } from '../ather/combat'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const T: Terrain = { heightAt: () => 0, walkable: () => true }

// who hosts
ok(hostOf('p_m', ['p_z', 'p_c']) === 'p_c' && hostOf('p_a', ['p_z']) === 'p_a', 'host = the lowest id present, me included')
ok(hostOf('p_c', ['p_m', 'p_z']) === hostOf('p_m', ['p_c', 'p_z']), 'every client computes the SAME host from the same roster')
ok(!sharing(null, ['p_z']) && !sharing('ABCD', []) && sharing('ABCD', ['p_z']), 'sharing only in a party with someone here')

// the snapshot round-trips: same ids, same places, nearest first, capped
const host = newCombat(7)
for (let i = 0; i < 50; i++) spawnHollow(host, T, (i % 10) * 5, Math.floor(i / 10) * 5, i % 7 === 0 ? 'floater' : 'shambler')
const snap = encodeSnap(host, { x: 0, z: 0 })
ok(snap.h.length === SNAP_MAX, `capped at ${SNAP_MAX} (${snap.h.length})`)
ok(JSON.stringify(snap).length < 2048, `fits the server's 2 KB relay cap (${JSON.stringify(snap).length} bytes)`)
const guest = newCombat(99); guest.remote = true
applySnap(guest, T, snap)
ok(guest.hollows.length === SNAP_MAX && guest.hollows.every(h => host.hollows.some(o => o.id === h.id && Math.abs(o.x - h.x) < 0.11 && Math.abs(o.z - h.z) < 0.11 && o.kind === h.kind)), 'the guest has the host\'s Hollows: same ids, kinds, places')

// a remote guest: no AI (they do not chase the guest), they ease to the host's word
const g0 = guest.hollows[0] as NetHollow
host.hollows.find(h => h.id === g0.id)!.x += 3
applySnap(guest, T, encodeSnap(host, { x: 0, z: 0 }))
const before = g0.x
for (let i = 0; i < 30; i++) stepCombat(guest, T, { x: 100, y: 0, z: 100 }, 1 / 30)
ok(Math.abs(g0.x - (before + 3)) < 0.2, `eases to the host's new spot (${before.toFixed(1)} -> ${g0.x.toFixed(1)})`)
ok(guest.hollows.every(h => h.state !== 'chase' || host.hollows.find(o => o.id === h.id)?.state === 'chase'), 'no local AI: states are the host\'s')

// a guest's round: a flash + a queued hit, never local damage
const tgt = guest.hollows.find(h => h.kind === 'shambler')!, hp0 = tgt.hp   // a floater hovers above a 0.85 m round
guest.rounds.push({ x: tgt.x, y: 0.85, z: tgt.z - 1, vx: 0, vy: 0, vz: 60, life: 1, dmg: 12, crit: 19 } as never)
stepCombat(guest, T, { x: 100, y: 0, z: 100 }, 1 / 30)
ok(tgt.hp === hp0 && (guest.netHits?.length ?? 0) === 1 && guest.netHits![0].id === tgt.id, `a guest's hit is queued for the host, hp unchanged (${hp0} -> ${tgt.hp}, queued ${guest.netHits?.length ?? 0})`)

// a Hollow the host no longer has goes away
host.hollows = host.hollows.slice(1)
applySnap(guest, T, encodeSnap(host, { x: 0, z: 0 }))
ok(!guest.hollows.some(h => h.id === g0.id), 'gone from the host = gone from the guest')

console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
