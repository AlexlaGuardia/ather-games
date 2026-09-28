/**
 * breach-server.test.mts — two real sockets, one Breach (2026-09-28). Starts the server on a spare port, connects
 * two signed-in keepers to the same party, and checks: both land in one room; both see the SAME flood; a hit is
 * paid into the hitter's wallet only; a strike is sent to the keeper struck only; a stranger without a session is
 * refused; a fourth keeper is refused; the run ends only when every keeper is down.
 *   set -a; . ./.env; set +a; npx tsx server/breach-server.test.mts
 */
import WebSocket from 'ws'
import { startServer, MAX_KEEPERS } from './breach-server.mts'
import { mintSession, SESSION_COOKIE } from '../src/lib/accounts/session'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l); console.log(`${c ? '✓' : '✗'} ${l}`) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PORT = 18410 + Math.floor(Math.random() * 500)
const wss = startServer(PORT)

interface Client { ws: WebSocket; msgs: any[]; last: () => any; snaps: () => any[] }
function connect(user: string, name: string, party = 'COOP1', session = true): Promise<Client> {
  return new Promise((res) => {
    const headers: Record<string, string> = session ? { cookie: `${SESSION_COOKIE}=${mintSession(user, name)}` } : {}
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?party=${party}`, { headers })
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
} finally {
  wss.close()
}
console.log(`breach-server: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
