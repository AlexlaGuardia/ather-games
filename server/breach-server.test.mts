/**
 * breach-server.test.mts — two real sockets, one Breach (2026-09-28). Starts the server on a spare port, connects
 * two signed-in keepers to the same party, and checks: both land in one room; both see the SAME flood; a hit is
 * paid into the hitter's wallet only; a strike is sent to the keeper struck only; a stranger without a session is
 * refused; a fourth keeper is refused; the run ends only when every keeper is down.
 *   set -a; . ./.env; set +a; npx tsx server/breach-server.test.mts
 */
import WebSocket from 'ws'
import { startServer, MAX_KEEPERS, QUEUE_OPTS, MAX_HIT, SLACK_DOWN_SEC, newRoom, tickRoom, tickSlack, handle } from './breach-server.mts'
import { STILLWIND_TUNING, simToEdge } from '../src/app/shimmer/play3d/stillwind'
import { HOLD_TUNING, rollChests } from '../src/app/shimmer/play3d/hold'
import { mintSession, SESSION_COOKIE } from '../src/lib/accounts/session'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l); console.log(`${c ? '✓' : '✗'} ${l}`) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PORT = 18410 + Math.floor(Math.random() * 500)
const wss = startServer(PORT)

interface Client { ws: WebSocket; msgs: any[]; last: () => any; snaps: () => any[] }
function connect(user: string, name: string, party = 'COOP1', session = true, mode = ''): Promise<Client> {
  return new Promise((res) => {
    const headers: Record<string, string> = session ? { cookie: `${SESSION_COOKIE}=${mintSession(user, name)}` } : {}
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?party=${party}${mode ? '&mode=' + mode : ''}`, { headers })
    const msgs: any[] = []
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))))
    const c: Client = { ws, msgs, last: () => msgs[msgs.length - 1], snaps: () => msgs.filter(m => m.t === 'snap') }
    ws.on('open', () => res(c)); ws.on('error', () => res(c))
  })
}
const send = (c: Client, m: unknown) => c.ws.send(JSON.stringify(m))
const lastSnap = (c: Client) => c.snaps().at(-1)

try {
  const a = await connect('u_a', 'Alpha'), b = await connect('u_b', 'Bravo')
  await sleep(400)
  ok(a.msgs[0]?.t === 'welcome' && b.msgs[0]?.t === 'welcome' && a.msgs[0].code === 'COOP1', 'both keepers are welcomed into party COOP1')
  // stand them apart on the roof so the flood has two targets
  const st = a.msgs[0].start
  send(a, { t: 'pos', x: st.x, y: st.y, z: st.z }); send(b, { t: 'pos', x: st.x + 3, y: st.y, z: st.z })
  await sleep(6000)   // the first round climbs in
  const sa = lastSnap(a), sb = lastSnap(b)
  ok(!!sa && !!sb && sa.party.length === 2, `★ one room, two keepers (${sa?.party.map((p: any) => p.name).join(' + ')})`)
  const ids = (s: any) => s.flood.map((f: any) => f.id).sort().join(',')
  ok(sa.flood.length > 0 && ids(sa) === ids(sb), `★★ both see the SAME flood (${sa.flood.length} bodies, ids match)`)
  ok(sa.round === sb.round && JSON.stringify(sa.planks) === JSON.stringify(sb.planks), 'and the same round and planks')

  // a hit pays the hitter
  const target = sa.flood[0]
  const beforeA = sa.you.salvage, beforeB = sb.you.salvage
  send(a, { t: 'hit', id: target.id, dmg: 9999, crit: false })
  await sleep(500)
  const sa2 = lastSnap(a), sb2 = lastSnap(b)
  ok(sa2.you.salvage > beforeA, `★ A's hit paid A (${beforeA} → ${sa2.you.salvage})`)
  ok(sb2.you.salvage === beforeB, `★ and not B (${beforeB} → ${sb2.you.salvage}) — wallets are per keeper`)
  ok(!sa2.flood.some((f: any) => f.id === target.id), 'the body A killed is gone for both')
  ok(sa2.you.kills === 1 && sb2.you.kills === 0, 'the kill is A\'s')
  ok(a.msgs.some(m => m.t === 'kill' && m.id === target.id), 'A is told of the kill')
  ok(sa2.you.salvage - beforeA <= 200, `a claimed 9999-damage kill pays the ordinary kill salvage, nothing inflated (paid ${sa2.you.salvage - beforeA})`)

  // a stranger and a fourth are refused
  const anon = await connect('u_x', 'Nobody', 'COOP1', false)
  await sleep(300)
  ok(anon.msgs[0]?.t === 'refused', `★ no session, no seat: "${anon.msgs[0]?.why}"`)
  const c = await connect('u_c', 'Charlie'), d = await connect('u_d', 'Delta')
  await sleep(400)
  ok(c.msgs[0]?.t === 'welcome' && d.msgs[0]?.t === 'refused', `★ ${MAX_KEEPERS} to a door: the fourth is refused ("${d.msgs[0]?.why}")`)

  // one down is not the end; all down is
  send(a, { t: 'down' }); await sleep(300)
  ok(!lastSnap(b).over, 'one keeper down: the fight goes on for the rest')
  send(b, { t: 'down' }); send(c, { t: 'down' }); await sleep(400)
  ok(b.msgs.some(m => m.t === 'snap' && m.events?.some((e: any) => e.t === 'over')) || lastSnap(b).over, '★ every keeper down: the run is over for the party')
  for (const x of [a, b, c, d, anon]) x.ws.close()

  // ── FIND OTHERS: the queue ─────────────────────────────────────────────────────────────────────
  const queue = (user: string, name: string, session = true) => new Promise<Client>((res) => {
    const headers: Record<string, string> = session ? { cookie: `${SESSION_COOKIE}=${mintSession(user, name)}` } : {}
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?queue=breach`, { headers })
    const msgs: any[] = []
    ws.on('message', (dd) => msgs.push(JSON.parse(String(dd))))
    const cl: Client = { ws, msgs, last: () => msgs[msgs.length - 1], snaps: () => [] }
    ws.on('open', () => res(cl)); ws.on('error', () => res(cl))
  })
  const matched = (cl: Client) => cl.msgs.find(m => m.t === 'matched')
  const q1 = await queue('u_q1', 'Q1'), q2 = await queue('u_q2', 'Q2')
  await sleep(300)
  ok(q2.msgs.some(m => m.t === 'queue' && m.n === 2) && !matched(q1), 'two waiting are told "2 of 3" and not matched yet')
  const q3 = await queue('u_q3', 'Q3')
  await sleep(400)
  const m1 = matched(q1), m2 = matched(q2), m3 = matched(q3)
  ok(!!m1 && m1.code === m2?.code && m2?.code === m3?.code, `★★ the third arrival completes a match: all three get one code (${m1?.code})`)
  ok(m1?.names?.length === 3, `and the names (${m1?.names?.join(', ')})`)
  // the code is a room: all three connect as a party would
  const r1 = await connect('u_q1', 'Q1', m1.code), r2 = await connect('u_q2', 'Q2', m1.code)
  await sleep(500)
  ok(lastSnap(r1)?.party.length === 2 && lastSnap(r2)?.party.length === 2, '★ the matched connect to one Breach with the code')
  r1.ws.close(); r2.ws.close()
  // two, and the wait runs out
  QUEUE_OPTS.fillSec = 1
  const q4 = await queue('u_q4', 'Q4'), q5 = await queue('u_q5', 'Q5')
  await sleep(1800)
  ok(!!matched(q4) && matched(q4).code === matched(q5)?.code, '★ two who have waited long enough go as two')
  QUEUE_OPTS.fillSec = 25
  // GO NOW, alone
  const q6 = await queue('u_q6', 'Q6')
  await sleep(200)
  q6.ws.send(JSON.stringify({ t: 'go' }))
  await sleep(300)
  ok(matched(q6)?.names?.length === 1, '★ Go now takes whoever is waiting, even nobody (a room of one)')
  // cancel: a closed waiter leaves the line
  const q7 = await queue('u_q7', 'Q7'); await sleep(150); q7.ws.close(); await sleep(150)
  const q8 = await queue('u_q8', 'Q8'); await sleep(200)
  ok(q8.msgs.some(m => m.t === 'queue' && m.n === 1), 'a keeper who cancels leaves the line (the next arrival waits alone)')
  q8.ws.close()
  const qx = await queue('u_x', 'Nobody', false); await sleep(200)
  ok(qx.msgs[0]?.t === 'refused', 'no session, no place in line')

  // ── GLOVE STONES IN CO-OP: the party finds them, each keeper owed takes theirs ────────────────────
  {
    const room = newRoom('GLOVE1', 42)
    const sent: Record<string, any[]> = { a: [], b: [], c: [] }
    const mk = (id: string, owed: boolean): any => ({
      id, name: id, ws: { send: (x: string) => sent[id].push(JSON.parse(x)), readyState: 1 },
      pos: { x: room.s.map.start.x, z: room.s.map.start.z, y: room.s.map.start.h },
      wallet: { salvage: 500, surge: 0, tuned: {}, rackBought: false, kills: 0, wrack: 0 },
      struck: 0, events: [], goneAt: null, down: false, yaw: 0, gloveOwed: owed,
    })
    const ka = mk('a', true), kb = mk('b', true), kc = mk('c', false)
    room.keepers.push(ka, kb, kc)
    room.s.round = HOLD_TUNING.gloveRound
    tickRoom(room, 1 / 30)
    ok(room.s.gloveOwed, 'a keeper here is owed the stones, so the Breach owes them')
    rollChests(room.s, HOLD_TUNING, 0)
    const spot = room.s.chests.findIndex(c => c?.stones)
    ok(spot >= 0, '★ the stones cache is set down at the glove round')
    let reply: any = null
    for (let i = 0; i < 40 && !reply; i++) reply = handle(room, kc, { t: 'chest', spot, dt: 0.5 })
    ok(reply?.t === 'loot-shared', `★ C (not on the glove's road) opens it and takes nothing for themselves (${reply?.t})`)
    ok(sent.a.some(m => m.t === 'loot' && m.loot.kind === 'stones') && sent.b.some(m => m.t === 'loot' && m.loot.kind === 'stones'), '★★ A and B, both owed, each get their stones')
    ok(!sent.c.some(m => m.t === 'loot'), 'C is sent no stones')
    ok(!ka.gloveOwed && !kb.gloveOwed && !room.s.gloveOwed, 'the debt is settled for both, and the Breach owes nothing more')
    // a party nobody in which is owed never sees a stones cache
    const none = newRoom('GLOVE2', 43)
    none.keepers.push(mk('c', false))
    none.s.round = HOLD_TUNING.gloveRound
    tickRoom(none, 1 / 30); rollChests(none.s, HOLD_TUNING, 1)
    ok(!none.s.chests.some(c => c?.stones), 'a party with nobody owed never sees a stones cache')
  }

  // ── THE SLACK TOGETHER (09-29): the party's Stillwind, a room of its own ──────────────────────────────────────────
  {
    const sa = await connect('u_a', 'Alpha', 'COOP1', true, 'slack'), sb = await connect('u_b', 'Bravo', 'COOP1', true, 'slack')
    await sleep(400)
    ok(sa.msgs[0]?.t === 'welcome' && sa.msgs[0].mode === 'slack' && sb.msgs[0]?.mode === 'slack', 'slack: both keepers welcomed into the party\'s Slack')
    const edge = simToEdge(0, 20)
    send(sa, { t: 'pos', x: edge.x, y: 0, z: edge.z }); send(sb, { t: 'pos', x: edge.x + 1, y: 0, z: edge.z })
    await sleep(500)
    const s1 = lastSnap(sa), s2 = lastSnap(sb)
    ok(s1?.mode === 'slack' && s1.sw && s2?.sw && s1.sw.hp === STILLWIND_TUNING.hp, 'slack: both see a whole Stillwind')
    ok(!('flood' in (s1 ?? {})), 'slack: a Slack snapshot carries no Breach')
    send(sa, { t: 'hit', id: 0, dmg: 100 }); send(sb, { t: 'hit', id: 0, dmg: 100 })
    await sleep(400)
    const hpA = lastSnap(sa)?.sw.hp, hpB = lastSnap(sb)?.sw.hp
    ok(hpA === hpB && hpA < STILLWIND_TUNING.hp && hpA >= STILLWIND_TUNING.hp - 200 * STILLWIND_TUNING.openDmg, `slack: both hits land on ONE Stillwind (${hpA})`)
    ok(lastSnap(a)?.flood !== undefined, 'slack: the party\'s Breach room is untouched by it')
    sa.ws.close(); sb.ws.close()
  }
  // the rules, stepped directly (no clock to wait on)
  {
    const r = newRoom('SLACK9', 7, 'slack')
    const fakeWs = { send() {}, close() {} } as any
    const mk = (id: string) => ({ id, name: id, ws: fakeWs, pos: { ...simToEdge(0, 20), y: 0 }, wallet: { salvage: 0, surge: 0, tuned: {}, rackBought: false, kills: 0, wrack: 0 }, struck: 0, events: [] as any[], goneAt: null, down: false, downAt: 0, yaw: 0, gloveOwed: false })
    const ka = mk('a'), kb = mk('b'); r.keepers.push(ka as any, kb as any)
    handle(r, ka as any, { t: 'hit', id: 0, dmg: 1e9 } as any)
    ok(r.sw!.hp === STILLWIND_TUNING.hp - MAX_HIT * STILLWIND_TUNING.lineDmg, 'slack: a hit is clamped to MAX_HIT')
    // the Stillwind walks up to both and swings: only the one it is after is struck
    r.sw!.z = 22; r.sw!.x = 0; r.sw!.strikeT = 0; r.sw!.windT = 99
    kb.pos = { ...simToEdge(0, 40), y: 0 }
    tickSlack(r, 0.05, 0)
    ok(ka.struck === STILLWIND_TUNING.strikeDmg && kb.struck === 0, `slack: a swing strikes the keeper it reached (${ka.struck}/${kb.struck})`)
    handle(r, ka as any, { t: 'down' } as any)
    ok(ka.down && !kb.down && r.sw!.hp < STILLWIND_TUNING.hp, 'slack: one keeper down, the fight goes on')
    ka.downAt = 0   // the handler stamps the real clock; the ticks below run on a fake one
    tickSlack(r, 0.05, (SLACK_DOWN_SEC - 1) * 1000)
    ok(ka.down, 'slack: still down before the wait is up')
    tickSlack(r, 0.05, SLACK_DOWN_SEC * 1000 + 50)
    ok(!ka.down && ka.events.some(e => e.t === 'up'), 'slack: back on their feet after SLACK_DOWN_SEC')
    const hpBefore = r.sw!.hp
    handle(r, ka as any, { t: 'down' } as any, ); handle(r, kb as any, { t: 'down' } as any)
    ok(!ka.down && !kb.down && r.sw!.hp === STILLWIND_TUNING.hp && hpBefore < STILLWIND_TUNING.hp && kb.events.some(e => e.t === 'reset'), 'slack: everyone down at once → the Stillwind stands again, whole')
    r.sw!.hp = 1; r.sw!.mood = 'open'
    handle(r, ka as any, { t: 'hit', id: 0, dmg: 10 } as any)
    ok(ka.events.some(e => e.t === 'felled') && kb.events.some(e => e.t === 'felled'), 'slack: a felling is every keeper\'s deed')
  }
} finally {
  wss.close()
}
console.log(`breach-server: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
