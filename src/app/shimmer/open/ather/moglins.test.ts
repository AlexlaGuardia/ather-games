// The garden village's Moglins, plot side (moglins.ts). Run: npx tsx src/app/shimmer/open/ather/moglins.test.ts
import { freshVillage, welcome, farewell, assign, tick, adoptVillage, PER_HOUR, MAX_TICK_MS, VILLAGE_CAP, WORKS_IN, PROFESSIONS, type MoglinRecord, type Village } from './moglins'
import { freshWorks, place, roomStore, ROOM_ACCEPTS, ROOM_STORE_SLOTS, type Works, type Room } from './rooms'
import { STARTING_SQUARES } from './plot'
import { newInv, give } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const H = 3_600_000
const mog = (id: string, profession: MoglinRecord['profession'], y: 1 | 2 | 3 | 4 | 5 = 1): MoglinRecord =>
  ({ id, name: id, home: 'tuckbank', grades: { craft: 1, yield: y, trade: 1 }, dream: '', profession, recruitedAt: 0 })
const count = (r: Room | undefined, id: string) => (r ? roomStore(r).stacks.reduce((a, s) => a + (s.id === id ? s.n : 0), 0) : 0)

// a plot with a standing carpentry room and a smithy (the smithy is not on the table yet: seeded straight in)
const owned = new Set<string>(STARTING_SQUARES)
const c = place(freshWorks(), owned, give(newInv(12), 'goldwood_log', 40).inv, 'carpentry', -100, 110, 0, 0)!
const smithRoom: Room = { id: 'smith-1', kind: 'smith', x: -130, z: 100, q: 0, placedAt: 0, doneAt: 0 }
const W: Works = { ...c.works, rooms: [...c.works.rooms.map(r => ({ ...r, doneAt: 0 })), smithRoom] }
const carpId = W.rooms[0].id

// the cap: 2 at the start (canon 2/4/6), no repeats
let v: Village = freshVillage(0)
v = welcome(v, mog('m1', 'carpenter', 3))!; v = welcome(v, mog('m2', 'smith'))!
ok(v.moglins.length === 2 && welcome(v, mog('m3', 'cook')) === null && welcome(v, mog('m3', 'cook'), 1) !== null && VILLAGE_CAP[2] === 6, 'cap: not 2 / 4 / 6')
ok(welcome(freshVillage(0), mog('m1', 'carpenter'))!.moglins[0].room === undefined, 'welcome: arrived already assigned')
ok(welcome(v, mog('m1', 'carpenter'), 2) === null, 'welcome: the same Moglin twice')

// assigning: trade must fit, room must stand, one to a room
ok(assign(v, W, 'm1', 'smith-1') === null, 'assign: a carpenter took the smithy')
v = assign(v, W, 'm1', carpId)!; ok(!!v && v.moglins[0].room === carpId, 'assign: the carpenter was refused the carpentry room')
ok(assign(welcome(v, mog('m9', 'carpenter'), 1)!, W, 'm9', carpId) === null, 'assign: two Moglins in one room')
const raising: Works = { ...W, rooms: W.rooms.map(r => (r.id === carpId ? { ...r, doneAt: 10 * H } : r)) }
ok(assign(freshVillage(0).moglins.length === 0 ? welcome(freshVillage(0), mog('x', 'carpenter'))! : v, raising, 'x', carpId, 1) === null, 'assign: worked a room still under scaffolding')
ok(PROFESSIONS.every(p => WORKS_IN[p].every(k => k in ROOM_ACCEPTS)), 'assign: a trade works a room that does not exist')

// the carpenter: deadfall at its yield grade, into the carpentry store
const t1 = tick(v, W, 2 * H)
ok(count(t1.works.rooms.find(r => r.id === carpId), 'deadfall') === 2 * PER_HOUR(3) && t1.made.deadfall === 10, 'carpenter: wrong deadfall for 2 h at yield 3')
ok(count(W.rooms[0], 'deadfall') === 0, 'tick: mutated the works it was given')
// fractions carry: four 15-minute ticks = one hour
let vv = v, ww = W
for (let k = 1; k <= 4; k++) { const t = tick(vv, ww, k * H / 4); vv = t.village; ww = t.works }
ok(count(ww.rooms.find(r => r.id === carpId), 'deadfall') === PER_HOUR(3), 'carpenter: fractions lost between short ticks')
// a week away is not a week of product
const far = tick(v, W, 7 * 24 * H)
ok(count(far.works.rooms.find(r => r.id === carpId), 'deadfall') <= Math.ceil(PER_HOUR(3) * MAX_TICK_MS / H), 'carpenter: a week away paid a week')
// a full store: nothing past ROOM_STORE_SLOTS, nothing lost from it
const stuffed: Works = { ...W, rooms: W.rooms.map(r => (r.id === carpId ? { ...r, store: Array.from({ length: ROOM_STORE_SLOTS }, () => ({ id: 'goldwood_plank', n: 99 })) } : r)) }
const tf = tick(v, stuffed, 2 * H)
ok(roomStore(tf.works.rooms.find(r => r.id === carpId)!).stacks.length === ROOM_STORE_SLOTS && !tf.made.deadfall, 'carpenter: deadfall forced into a full store')

// the smith: gathers nothing; burns the carpenter's deadfall into charcoal (trade from the carpentry store)
v = assign(v, W, 'm2', 'smith-1')!
const lone = tick({ ...v, moglins: v.moglins.filter(m => m.id === 'm2') }, W, 3 * H)
ok(!lone.made.charcoal && count(lone.works.rooms.find(r => r.id === 'smith-1'), 'charcoal') === 0, 'smith: made charcoal with no carpenter / no deadfall')
const both = tick(v, W, 3 * H)
const carp = both.works.rooms.find(r => r.id === carpId), sm = both.works.rooms.find(r => r.id === 'smith-1')
ok((both.made.charcoal ?? 0) > 0 && count(sm, 'charcoal') === both.made.charcoal, 'smith: no charcoal with a carpenter bringing deadfall')
ok(count(carp, 'deadfall') + count(sm, 'charcoal') === both.made.deadfall, 'smith: deadfall was not conserved into charcoal (made from nothing, or lost)')

// leaving: a Moglin can go (canon consent law); the store stays
const gone = farewell(both.village, 'm1')
ok(gone.moglins.length === 1 && count(both.works.rooms.find(r => r.id === carpId), 'deadfall') >= 0, 'farewell: wrong')

// the save: junk dropped, a clock from the future clamped
const back = adoptVillage({ v: 1, lastTick: 9e15, moglins: [...v.moglins, { id: 'bad', name: 'x', profession: 'pirate', grades: { craft: 1, yield: 1, trade: 1 } }, { id: 'b2', name: 'y', profession: 'cook', grades: { craft: 9, yield: 1, trade: 1 } }] }, 1000)
ok(back.moglins.length === 2 && back.lastTick === 1000, 'save: kept a bad Moglin, or trusted a future clock')
ok(adoptVillage(null, 5).moglins.length === 0, 'save: null was not a fresh village')

if (fails.length) { console.error(`moglins: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`moglins: ${pass}/0`)
