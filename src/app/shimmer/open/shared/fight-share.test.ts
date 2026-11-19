// node test: npx tsx src/app/shimmer/open/shared/fight-share.test.ts (BETA M28 slice 2)
import { hostOf, sharing, encodeSnap, applySnap, SNAP_MAX, encodeHits, decodeHits, newDrops, decodeKills, layDrop, encodeHurt, decodeHurt, type NetHollow } from './fight-share'
import { newCombat, spawnHollow, stepCombat, applyNetHit, applyNetHurt, blowCost, SHAMBLER, type Terrain } from '../ather/combat'
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

// ── slice 3: a guest's hit reaches the host; kills become drops, ONE each; guests lay their own copy ──
{
  const H = newCombat(3); const victim = spawnHollow(H, T, 50, 50); const seen = new Set<number>()
  ok(newDrops(H, seen, true).length === 0, 'the drop-watch\'s first look sends nothing')
  const wire = decodeHits(JSON.parse(JSON.stringify(encodeHits([{ id: victim.id, dmg: 12 }]))))
  for (const [id, dmg] of wire) applyNetHit(H, id, dmg)
  ok(victim.hp === victim.maxHp - 12, `the host applies a guest's hit (${victim.maxHp} -> ${victim.hp})`)
  for (const [id] of wire) applyNetHit(H, id, 999)   // over the cap: ignored
  ok(victim.hp === victim.maxHp - 12, 'an absurd hit (> 200) is ignored')
  for (let i = 0; i < 3; i++) applyNetHit(H, victim.id, 12)   // the killing blows land between steps
  stepCombat(H, T, { x: 0, y: 0, z: 0 }, 1 / 30)
  const kills = H.events.filter(e => e.kind === 'hit' && e.killed).length
  const rows = newDrops(H, seen, false)
  ok(kills === 1 && H.drops.length === 1 && rows.length === 1, `a guest's kill: ONE kill event, ONE drop, ONE broadcast row (${kills}/${H.drops.length}/${rows.length})`)
  ok(newDrops(H, seen, false).length === 0, 'the same drop is never re-sent')
  const G = newCombat(4); G.remote = true
  for (const k of decodeKills(JSON.parse(JSON.stringify({ k: rows })))) layDrop(G, T, k)
  ok(G.drops.length === 1 && Math.abs(G.drops[0].x - H.drops[0].x) < 0.11 && G.drops[0].amount === H.drops[0].amount, 'the guest lays its OWN copy of the drop (same place, same amount)')
  ok(decodeKills({ k: [[1, 2, 99], ['x', 1, 1]] }).length === 0 && decodeHits({ h: 'nope' }).length === 0, 'junk on the wire is refused')
}

// ── #1651: the host's Hollows hunt the NEAREST keeper; what reaches a guest is an event for that guest, never the host's hp ──
{
  const H = newCombat(11); const h = spawnHollow(H, T, 0, 0, 'shambler'); const me = { x: 30, y: 0, z: 0 }
  H.others = [{ id: 'p_g', x: 5, y: 0, z: 0 }]
  for (let i = 0; i < 6; i++) stepCombat(H, T, me, 1 / 30)
  ok(h.state === 'chase' && h.x > 0, `a Hollow chases the NEAREST keeper, the guest (${h.state}, x ${h.x.toFixed(2)})`)
  const hp0 = H.keeper.hp; let other = 0
  H.others = [{ id: 'p_g', x: h.x + 1, y: 0, z: h.z }]
  for (let i = 0; i < 90 && !other; i++) { stepCombat(H, T, me, 1 / 30); other += H.events.filter(e => e.kind === 'hurt-other' && e.id === 'p_g').length; H.others = [{ id: 'p_g', x: h.x + 1, y: 0, z: h.z }] }
  ok(other === 1 && H.keeper.hp === hp0, `its lunge reaches the guest: ONE 'hurt-other' for p_g, the host's hp untouched (${other}, ${hp0} -> ${H.keeper.hp})`)
  const S = newCombat(12); const s1 = spawnHollow(S, T, 0, 0, 'shambler')
  for (let i = 0; i < 6; i++) stepCombat(S, T, me, 1 / 30)
  ok(s1.state === 'wander', `solo (no others): a keeper 30 m off is not noticed, as before (${s1.state})`)
  // the guest's side: raw damage, its own frame; nothing while down; junk refused
  const G = newCombat(13); G.keeper.takes = 0.9
  const wire = decodeHurt(JSON.parse(JSON.stringify(encodeHurt(SHAMBLER.damage))))!
  applyNetHurt(G, wire)
  ok(G.keeper.hp === G.keeper.maxHp - blowCost(G.keeper, SHAMBLER.damage) && blowCost(G.keeper, SHAMBLER.damage) < SHAMBLER.damage && G.events.some(e => e.kind === 'hurt'), `the guest takes it with ITS frame (Large x0.9: ${G.keeper.maxHp} -> ${G.keeper.hp}) + a hurt event`)
  G.keeper.hp = 0; G.events = []; applyNetHurt(G, wire)
  ok(G.keeper.hp === 0 && !G.events.length, 'a hurt that lands while down is dropped (no double death)')
  ok(decodeHurt({ d: 999 }) === null && decodeHurt({ d: -1 }) === null && decodeHurt('x') === null, 'junk hurt on the wire is refused')
}
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
