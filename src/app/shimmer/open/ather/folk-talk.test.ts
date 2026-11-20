// folk-talk.ts: a settlement Moglin's conversation is one screen per answer, lark's lines only, game logic via the acts.
import { folkTalk, folkStart, ASK, FOLK_NO_ROOM, FOLK_EMPTY, giveLabel, goodsText, type FolkTalkState } from './folk-talk'
import { helloFor, _resetHeard } from './folk-talk'
import { GLADE_STATION_LINES } from './moonwell-glade'
import { folkOf, freshTrust, bring, stillHome } from './settlement-folk'
import { talkLine, DREAMS } from './folk-lines'
import type { Settlement } from './network'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const S: Settlement = { id: 's1-0', name: 'Test', x: 0, z: 0, biome: 'woods' }
let folk = folkOf(S, 1)
for (let k = 0; k < 60 && !(folk.some(f => f.employed) && folk.some(f => !f.employed)); k++) folk = folkOf({ ...S, id: `s1-${k}` }, 1)
const emp = folk.find(f => f.employed)!, free = folk.find(f => !f.employed)!
const home = folk
const log: string[] = []
let cur: FolkTalkState | null = null
const acts = { go: (s: FolkTalkState) => { cur = s }, give: (f: { id: string }, id: string, n: number) => log.push(`give ${f.id} ${id} ${n}`), recruit: (f: { id: string }) => log.push(`recruit ${f.id}`), bye: () => log.push('bye') }
const ctx = (o: object = {}) => ({ folk, home, trust: freshTrust(), have: () => 0, room: 3, ...o })
const labels = (n: { options: { label: string }[] }) => n.options.map(o => o.label)

// hello: ONE Moglin's dream in the bubble, a short answer list (never every Moglin at once)
const h = folkTalk(ctx(), { fid: emp.id, screen: 'hello' }, acts)
ok(h.line === emp.dream && !h.line.includes(free.dream), 'hello is this Moglin\'s own dream, nothing of the others')
ok(labels(h).join('|') === [ASK.needs, ASK.room, ASK.others, ASK.bye].join('|'), 'a Moglin with work: needs, room, others, goodbye')
const fh = folkTalk(ctx(), { fid: free.id, screen: 'hello' }, acts)
ok(!labels(fh).includes(ASK.needs), 'a free Moglin has no needs answer')
ok(folkStart(home).fid === home[0].id && folkStart([]).fid === '', 'start = the first Moglin at home')
// others: turns to a DIFFERENT Moglin, wraps
for (const f of home) { folkTalk(ctx(), { fid: f.id, screen: 'hello' }, acts).options.find(o => o.label === ASK.others)!.pick(); ok(cur!.fid !== f.id && cur!.screen === 'hello', `others from ${f.name} turns to another`) }
const lone = folkTalk(ctx({ home: [free] }), { fid: free.id, screen: 'hello' }, acts)
ok(!labels(lone).includes(ASK.others), 'no "who else" when alone')
// needs: its goods named by lark's trustFirst, a give answer only for goods in the bag
const w = emp.wants[0]
let n = folkTalk(ctx(), { fid: emp.id, screen: 'needs' }, acts)
ok(n.line === talkLine('trustFirst', emp.id, goodsText(emp.wants)), 'needs: lark\'s trustFirst line')
ok(labels(n).join('|') === ASK.back, 'nothing in the bag = no give answers')
n = folkTalk(ctx({ have: (id: string) => id === w.id ? 99 : 0 }), { fid: emp.id, screen: 'needs' }, acts)
ok(labels(n)[0] === giveLabel(w.n, w.id), 'a give answer for goods the keeper holds')
n.options[0].pick(); ok(log.pop() === `give ${emp.id} ${w.id} ${w.n}`, 'give goes through the act')
// asking for a room before trusted = the needs screen, no recruit
folkTalk(ctx(), { fid: emp.id, screen: 'hello' }, acts).options.find(o => o.label === ASK.room)!.pick()
ok(cur!.screen === 'needs' && !log.some(l => l.startsWith('recruit')), 'room before trust opens the needs, never recruits')
// trusted: recruit, lark's line
let t = freshTrust(); for (const x of emp.wants) t = bring(t, emp, x.id, x.n).trust
folkTalk(ctx({ trust: t }), { fid: emp.id, screen: 'hello' }, acts).options.find(o => o.label === ASK.room)!.pick()
ok(log.pop() === `recruit ${emp.id}` && cur!.line === talkLine('trusted', emp.id), 'trusted: recruit + lark\'s trusted line')
folkTalk(ctx(), { fid: free.id, screen: 'hello' }, acts).options.find(o => o.label === ASK.room)!.pick()
ok(log.pop() === `recruit ${free.id}` && cur!.line === talkLine('yes', free.id), 'free: recruit + lark\'s yes line')
// no room
folkTalk(ctx({ room: 0 }), { fid: free.id, screen: 'hello' }, acts).options.find(o => o.label === ASK.room)!.pick()
ok(cur!.line === FOLK_NO_ROOM && log.length === 0, 'no room: says so, no recruit')
// after recruiting the Moglin has left home: its line stays, no Back to a gone Moglin
const gone = folkTalk(ctx({ home: home.filter(f => f.id !== free.id) }), { fid: free.id, screen: 'said', line: 'x' }, acts)
ok(gone.line === 'x' && !labels(gone).includes(ASK.back) && labels(gone).includes(ASK.bye), 'recruited Moglin: its line stays, only others/goodbye')
// empty settlement
ok(folkTalk(ctx({ home: [], folk: [] }), folkStart([]), acts).line === FOLK_EMPTY, 'everyone gone: one line + goodbye')
// goodbye
h.options[h.options.length - 1].pick(); ok(log.pop() === 'bye', 'goodbye closes')
// copy law on every label + stock line
const bad = /\b(duty|assign|staff|hire|your moglins|it)\b/i
ok(![...Object.values(ASK), FOLK_NO_ROOM, FOLK_EMPTY].some(x => bad.test(x)), 'copy law: no duty/assign/staff/hire/it/your Moglins in the placeholders')
void stillHome; void DREAMS
// M40: a Glade Moglin's hello is its station line (lark, SIGNED 40bf1c6): the first talk the main line, a repeat the alternate
{ _resetHeard()
  const g = { id: 'moonwell:hazel', name: 'Hazel', home: 'moonwell', profession: 'carpenter', employed: true, wants: [{ id: 'goldwood_plank', n: 6 }], dream: 'dream', grades: { craft: 4, yield: 3, trade: 3 } } as unknown as Folk
  const c = ctx({ home: [g], folk: [g] })
  const first = folkTalk(c, helloFor(g.id), acts).line, again = folkTalk(c, helloFor(g.id), acts).line
  ok(first === GLADE_STATION_LINES.hazel.main && again === GLADE_STATION_LINES.hazel.alt, `Glade: the first talk is the station line, a repeat the alternate (${first.slice(0, 30)} / ${again.slice(0, 30)})`)
  const o = { ...g, id: 's1-0:x', home: 's1-0' } as Folk
  ok(folkTalk(ctx({ home: [o], folk: [o] }), helloFor(o.id), acts).line === 'dream', 'anyone outside the Glade still says their dream') }
console.log(`folk-talk: ${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0)
