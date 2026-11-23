// Run: npx tsx src/app/shimmer/open/ather/moglins-idle.test.ts
// P1 11-23: recruits with no room stand idle by the planning table; one keeping a raised room is at work, not idle.
import { idleOf, atWork, idleSpot, IDLE_R } from './moglins-idle'
import { TABLE, type Works } from './rooms'
import type { MoglinRecord } from './moglins'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const mog = (id: string, profession: string, room?: string) => ({ id, name: id, profession, room, recruitedAt: 0 }) as unknown as MoglinRecord
const W = { v: 1, rooms: [{ id: 'carp', kind: 'carpentry', doneAt: 0 }, { id: 'up', kind: 'farm', doneAt: 1e15 }], chests: [], pieces: [] } as unknown as Works
const ms = [mog('a', 'carpenter', 'carp'), mog('b', 'cook'), mog('c', 'smith', 'up'), mog('d', 'cook', 'gone')]
ok(atWork(ms[0], W, 5) && !atWork(ms[1], W, 5), 'a carpenter in a raised room is at work; a roomless cook is not')
ok(idleOf(ms, W, 5).map(m => m.id).join() === 'b,c,d', 'idle: no room, a room still raising, a room that is gone')
ok(idleOf([], W).length === 0, 'an empty village: nobody idle')
for (const n of [1, 2, 6]) {
  const sp = Array.from({ length: n }, (_, k) => idleSpot(k, n))
  ok(sp.every(s => Math.abs(Math.hypot(s.x - TABLE.x, s.z - TABLE.z) - IDLE_R) < 1e-9), `${n} idle: all on the arc round the table`)
  ok(sp.every((s, i) => sp.every((t, j) => i === j || Math.hypot(s.x - t.x, s.z - t.z) > 1.5)), `${n} idle: none closer than 1.5 m`)
  ok(sp.every(s => { const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw); return fx * (TABLE.x - s.x) + fz * (TABLE.z - s.z) > 0 }), `${n} idle: each faces the table`)
}
console.log(`moglins-idle: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
