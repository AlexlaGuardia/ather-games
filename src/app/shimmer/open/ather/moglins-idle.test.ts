// Run: npx tsx src/app/shimmer/open/ather/moglins-idle.test.ts
// P1 11-23: recruits with no room stand idle by the planning table; one keeping a raised room is at work, not idle.
import { idleOf, atWork, idleSpot, IDLE_R, idleTalk, IDLE_LINES, type IdleScreen } from './moglins-idle'
import { partWith, adoptVillage, villageCap } from './moglins'
import { stillHome } from './settlement-folk'
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
// the talk: hello -> ask home -> ONE confirm (default answer 'No, stay.') -> part; nothing parts without the confirm
{
  const m = { name: 'Ash', dream: 'to see the sea' }
  let screen = 'hello' as IdleScreen | null, parted = 0
  const act = { go: (s: IdleScreen | null) => { screen = s }, part: () => { parted++ } }
  const h = idleTalk(m, 'hello', act)
  ok(h.line.includes('Ash') && h.line.includes('to see the sea'), 'hello names them and their dream')
  ok(h.options.map(o => o.label).join('|') === `${IDLE_LINES.bye}|${IDLE_LINES.askHome}`, 'hello: bye first, then askHome')
  h.options[1].pick(); ok(screen === 'confirm' && parted === 0, 'asking home opens the confirm, parts nobody yet')
  const c = idleTalk(m, 'confirm', act)
  ok(c.line === IDLE_LINES.confirm && c.options[0].label === IDLE_LINES.no, "confirm: 'No, stay.' is the first (default) answer")
  c.options[0].pick(); ok(screen === 'hello' && parted === 0, 'No, stay. = back to hello, nobody parts')
  idleTalk(m, 'confirm', act).options[1].pick(); ok(parted === 1 && screen === null, 'Yes = they part, the talk closes')
  ok(![...Object.values(IDLE_LINES)].map(x => typeof x === 'function' ? x('Ash') : x).some(l => /\b(fire|fired|dismiss|leave now|get out|collar|punish)\b/i.test(l)), 'guard: no firing / punishment words')
}
// parting in the save: off the map (parted), its old settlement never shows it again, an older save adopts fine
{
  const v0 = { v: 1 as const, moglins: [mog('a', 'carpenter', 'carp'), mog('b', 'cook')], lastTick: 0 }
  const v1 = partWith(v0, 'a')!
  ok(v1.moglins.map(m => m.id).join() === 'b' && v1.parted?.join() === 'a', 'partWith: gone from the village, listed as parted')
  ok(partWith(v0, 'zz') === null, 'partWith: nobody by that id = null')
  ok(partWith(partWith(v1, 'b')!, 'b') === null && partWith(v1, 'b')!.parted!.join() === 'a,b', 'partWith: twice-safe, parted keeps both')
  const folk = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as unknown as Parameters<typeof stillHome>[0]
  ok(stillHome(folk, v1).map(f => f.id).join() === 'c', 'stillHome: the parted one does not reappear at home, the recruited one stays away')
  ok(adoptVillage(JSON.parse(JSON.stringify(v1)), 1).parted?.join() === 'a', 'adoptVillage keeps parted through a save')
  ok(adoptVillage({ v: 1, moglins: [], lastTick: 0 }, 1).parted === undefined, 'an older save: no parted list, nothing breaks')
  ok(villageCap({ rooms: [] }, 1) - v1.moglins.length === 1, 'parting frees a place under the cap')
}
console.log(`moglins-idle: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
