/**
 * breach-server.mts — CO-OP BREACH: one shared fight per party (2026-09-28, Alex: "challenge with friends").
 *
 * Runs the SAME pure sim the solo game runs (`play3d/hold.ts`, `stepHoldParty`), once per party, and streams it.
 * The browser stops stepping its own Breach in co-op: it sends what its keeper does and draws what the server says.
 *
 *   pm2 `breach-server` · 127.0.0.1:8410 · public at wss://ather.games/breach-ws/ (tunnel ingress, path rule)
 *
 * ── Who is who ──────────────────────────────────────────────────────────────────────────────────────────────────
 * Identity comes from the `ather_session` cookie the upgrade carries (same origin), verified with the session
 * secret: signed-in keepers only. A room is keyed by the PARTY code (the same code the world uses), up to three.
 *
 * ── What is shared and what is yours ────────────────────────────────────────────────────────────────────────────
 * Shared: the building, the round, the flood, the planks, the gates, the lull, the caches, the lab. Yours (the
 * ruled co-op note in hold.ts: "salvage, Marks and vessel pieces are per keeper"): salvage, your surge, your tuned
 * weapons, your rack, your kills, your wrack. The sim keeps ONE of each, so the server swaps a keeper's own into
 * the state around that keeper's act (`asKeeper`) — the sim needs no co-op wallet of its own.
 *
 * ── Trust ───────────────────────────────────────────────────────────────────────────────────────────────────────
 * Friends-grade, like the rest of multiplayer: the client says what it hit. The server clamps damage to what a
 * weapon can do, and never trusts a client with the round, the flood or anyone else's wallet.
 *
 * ── THE SLACK TOGETHER (09-29) ──────────────────────────────────────────────────────────────────────────────────
 * `?mode=slack` joins the party's Stillwind raid instead (`play3d/stillwind.ts`, `stepStillwindParty`), a room of
 * its own (`slack:CODE`). The server steps the colossus; each page keeps its own edge burn, frost and line mend
 * (those are what the ground does to YOUR keeper, like resist and shield). A keeper who falls is back at the near
 * end after `SLACK_DOWN_SEC`; if every keeper is down at once the Stillwind stands again, whole. A felling is
 * every keeper's deed.
 */
import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import {
  parseLanding, startHold, stepHoldParty, hitBody, mendTick, buyGate, buyRack, buyFont, buyCache, plantDevice, tuneWeapon,
  studyNode, chestTick, releaseSurge, fieldStrike, endHold, type HoldState, type HoldKeeper, type LabNodeId,
} from '../src/app/shimmer/play3d/hold'
import { readSessionToken, SESSION_COOKIE } from '../src/lib/accounts/session'
import { startStillwind, stepStillwindParty, hitStillwind, edgeToSim, EDGE_START, type StillwindState } from '../src/app/shimmer/play3d/stillwind'

// ★ READ .env ITSELF, AT START (PATTERNS: pm2 --update-env re-injects the value pm2 saw FIRST, so a secret rotated in
// .env would never reach a pm2-started process). Only fills what the environment does not already set.
{
  try {
    const { readFileSync } = await import('node:fs')
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch { /* no .env: the caller's environment is all there is */ }
}
const PORT = Number(process.env.BREACH_PORT ?? 8410)
const TICK_HZ = 30, SNAP_HZ = 10
export const MAX_KEEPERS = 3
/** the most one hit may claim (a re-keyed Bolt Snipe is well under it); a client asking for more is clamped */
export const MAX_HIT = 400
/** the Slack: seconds a fallen keeper waits before they are back at the near end */
export const SLACK_DOWN_SEC = 12
export type RoomMode = 'breach' | 'slack'

const MAP = parseLanding()

type Wallet = Pick<HoldState, 'salvage' | 'surge' | 'tuned' | 'rackBought' | 'kills' | 'wrack'>
interface Keeper {
  id: string; name: string; ws: WebSocket | null
  pos: HoldKeeper
  wallet: Wallet
  /** raw strike damage waiting to be sent to this keeper (their client applies resist + shield) */
  struck: number
  events: unknown[]
  goneAt: number | null
  yaw: number
  /** this keeper's glove errand is waiting on the Breach (their client says so on connect: `&glove=1`) */
  gloveOwed: boolean
  /** fallen in this run: out of the flood's reach until the run ends (co-op: the run ends when EVERY keeper is down) */
  down: boolean
  /** the Slack: when this keeper fell (ms), for the way back */
  downAt: number
}
/** `s` is the Breach; a Slack room also carries `sw`, the colossus (its `s` is an idle Breach nobody steps) */
interface Room { code: string; mode: RoomMode; s: HoldState; sw: StillwindState | null; keepers: Keeper[]; startedAt: number; lastSnap: number; emptySince: number | null }
const roomKey = (code: string, mode: RoomMode) => (mode === 'slack' ? 'slack:' + code : code)
const ROOMS = new Map<string, Room>()

const freshWallet = (s: HoldState): Wallet => ({ salvage: s.salvage, surge: 0, tuned: {}, rackBought: false, kills: 0, wrack: 0 })
const WALLET_KEYS = ['salvage', 'surge', 'tuned', 'rackBought', 'kills', 'wrack'] as const

/** Run `fn` with this keeper's own wallet loaded into the sim, then put it back. */
export function asKeeper<T>(r: Room, k: Keeper, fn: () => T): T {
  const s = r.s as unknown as Record<string, unknown>
  const saved: Record<string, unknown> = {}
  for (const key of WALLET_KEYS) { saved[key] = s[key]; s[key] = (k.wallet as unknown as Record<string, unknown>)[key] }
  try { return fn() } finally {
    for (const key of WALLET_KEYS) { (k.wallet as unknown as Record<string, unknown>)[key] = s[key]; s[key] = saved[key] }
  }
}

export function newRoom(code: string, seed = (Date.now() & 0xffff) || 1, mode: RoomMode = 'breach'): Room {
  const s = startHold(MAP, seed)
  return { code, mode, s, sw: mode === 'slack' ? startStillwind() : null, keepers: [], startedAt: Date.now(), lastSnap: 0, emptySince: null }
}
const roomOver = (r: Room) => (r.mode === 'slack' ? !!r.sw?.felled : r.s.over)

// ── THE SLACK ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Every connected keeper back on their feet, and a whole Stillwind: what a party that fell together comes back to. */
function standAgain(r: Room, why: 'all-down'): void {
  r.sw = startStillwind()
  for (const k of r.keepers) { k.down = false; k.struck = 0; k.events.push({ t: 'reset', why }) }
  console.log(`[slack] ${r.code}: the Stillwind stands again (${why})`)
}

export function tickSlack(r: Room, dt: number, now = Date.now()): void {
  const sw = r.sw
  if (!sw) return
  for (const k of r.keepers) if (k.down && k.ws && now - k.downAt >= SLACK_DOWN_SEC * 1000) { k.down = false; k.events.push({ t: 'up' }) }
  const here = r.keepers.filter(k => k.ws !== null && !k.down)
  const o = stepStillwindParty(sw, dt, here.map(k => edgeToSim(k.pos.x, k.pos.z)))
  here.forEach((k, i) => { k.struck += o.strikes[i] ?? 0 })
  const flash = o.stalled ? 'stalled' : o.ran ? 'ran' : o.opened ? 'opened' : o.froze ? 'froze' : null
  if (flash) for (const k of r.keepers) k.events.push({ t: 'wind', what: flash })
}

export function snapshotSlack(r: Room, k: Keeper) {
  const w = r.sw!
  return {
    t: 'snap', mode: 'slack',
    sw: { hp: w.hp, x: +w.x.toFixed(2), z: +w.z.toFixed(2), heat: +w.heat.toFixed(3), cold: +w.cold.toFixed(3), mood: w.mood, moodT: +w.moodT.toFixed(2), wind: w.wind, windT: +w.windT.toFixed(2), runDir: w.runDir, felled: w.felled, elapsed: +w.elapsed.toFixed(1),
      // the 09-29 tells: a swing drawing back, a sweep marked on the band (every page draws them, so every page needs them)
      swingT: +(w.swingT ?? 0).toFixed(2), sweepT: +(w.sweepT ?? 0).toFixed(2), sweepZ: +(w.sweepZ ?? 0).toFixed(2), sweepIn: +(w.sweepIn ?? 0).toFixed(2) },
    you: { struck: takeStruck(k), down: k.down },
    party: r.keepers.map(o => ({ id: o.id, name: o.name, down: o.down, x: +o.pos.x.toFixed(2), z: +o.pos.z.toFixed(2), y: +o.pos.y.toFixed(2), yaw: +o.yaw.toFixed(2), here: o.ws !== null })),
    events: k.events.splice(0),
  }
}

export function handleSlack(r: Room, k: Keeper, m: Msg, now = Date.now()): unknown | null {
  const sw = r.sw
  if (!sw) return null
  switch (m.t) {
    case 'pos': k.pos = { x: num(m.x, -1, 400), y: num(m.y, -50, 200), z: num(m.z, -1, 400) }; k.yaw = num(m.yaw, -100, 100); return null
    case 'hit': {
      // the blow that fells it is a keeper's, so the deed is told HERE (the tick never sees it change)
      if (!k.down && hitStillwind(sw, num(m.dmg, 0, MAX_HIT)).felled) {
        for (const o of r.keepers) o.events.push({ t: 'felled', secs: Math.round(sw.elapsed), by: k.name })
        console.log(`[slack] ${r.code}: the Stillwind is felled by ${k.name} (${Math.round(sw.elapsed)}s)`)
      }
      return null
    }
    case 'down': {
      if (k.down || sw.felled) return null
      k.down = true; k.downAt = now
      console.log(`[slack] ${k.name} down in ${r.code}`)
      if (r.keepers.filter(x => x.ws !== null).every(x => x.down)) standAgain(r, 'all-down')
      return null
    }
  }
  return null
}

/** One tick of a room: step the shared fight with every present keeper, then route what it produced. */
export function tickRoom(r: Room, dt: number): void {
  const here = r.keepers.filter(k => k.ws !== null && !k.down)
  const pickups0 = r.s.pickups.length
  // ★ GLOVE STONES IN CO-OP (09-29): the Breach sets its stones cache down if ANY keeper here is owed them
  r.s.gloveOwed = here.some(k => k.gloveOwed)
  r.s.wrack = 0
  const o = stepHoldParty(r.s, dt, here.map(k => k.pos))
  here.forEach((k, i) => { k.struck += o.strikes[i] ?? 0 })
  // pickups: credited to whoever walked over them (wrack into their own wallet, a Last Light to their client)
  for (let i = pickups0; i < r.s.pickups.length; i++) {
    const k = here[r.s.pickupBy[i]]
    if (!k) continue
    const kind = r.s.pickups[i]
    if (kind === 'wrack') k.wallet.wrack++
    k.events.push({ t: 'pickup', kind })
  }
  r.s.pickups.length = 0; r.s.pickupBy.length = 0; r.s.wrack = 0
  if (o.roundBegan) for (const k of r.keepers) k.events.push({ t: 'round', n: o.roundBegan })
  if (o.wentLoud) for (const k of r.keepers) k.events.push({ t: 'loud' })
  // loot from caches is the opener's (applied in `act`); drain anything the sim queued without an owner
  r.s.loot.length = 0
}

function takeStruck(k: Keeper): number { const n = k.struck; k.struck = 0; return n }

/** What one keeper sees: the shared fight, and their own wallet. Small enough to send ten times a second. */
export function snapshotFor(r: Room, k: Keeper) {
  const s = r.s
  return {
    t: 'snap',
    round: s.round, toSpawn: s.toSpawn, breakT: s.breakT, hush: s.hush, over: s.over, running: s.running, elapsed: s.elapsed,
    flood: s.flood.filter(b => b.alive).map(b => ({ id: b.id, kind: b.kind, x: +b.x.toFixed(2), z: +b.z.toFixed(2), y: +b.y.toFixed(2), hp: b.hp, maxHp: b.maxHp, phase: b.phase, win: b.win, vx: +b.vx.toFixed(2), vz: +b.vz.toFixed(2) })),
    planks: s.planks, gatesOpen: s.gatesOpen, rooms: s.rooms, chests: s.chests, drops: s.drops,
    devicePlanted: s.devicePlanted, studied: s.studied,
    // strike damage is HANDED OVER with the snapshot and cleared here (an ack would lose what landed in between)
    you: { ...k.wallet, struck: takeStruck(k) },
    party: r.keepers.map(o => ({ id: o.id, name: o.name, down: o.down, x: +o.pos.x.toFixed(2), z: +o.pos.z.toFixed(2), y: +o.pos.y.toFixed(2), yaw: +o.yaw.toFixed(2), here: o.ws !== null })),
    events: k.events.splice(0),
  }
}

type Msg =
  | { t: 'pos'; x: number; y: number; z: number; yaw?: number }
  | { t: 'hit'; id: number; dmg: number; crit?: boolean }
  | { t: 'mend'; win: number; dt: number }
  | { t: 'chest'; spot: number; dt: number }
  | { t: 'field'; x: number; z: number; r: number; dmg: number; fy?: number }
  | { t: 'surge' }
  | { t: 'act'; a: 'gate' | 'rack' | 'font' | 'cache' | 'plant' | 'tune' | 'study'; arg?: number | string }
  | { t: 'struck-ack' }
  | { t: 'down' }

const num = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d)

/** Apply one message from a keeper. Returns a reply for that keeper, or null. */
export function handle(r: Room, k: Keeper, m: Msg): unknown | null {
  if (r.mode === 'slack') return handleSlack(r, k, m)
  const s = r.s
  switch (m.t) {
    case 'pos': k.pos = { x: num(m.x, -1, 400), y: num(m.y, -50, 200), z: num(m.z, -1, 400) }; k.yaw = num(m.yaw, -100, 100); return null
    case 'struck-ack': k.struck = 0; return null
    case 'down': {
      k.down = true
      console.log(`[breach] ${k.name} down in ${r.code}`)
      // ★ CO-OP ENDS WHEN THE LAST KEEPER FALLS: one keeper down is a friend to hold the line for
      if (r.keepers.filter(x => x.ws !== null).every(x => x.down)) {
        const end = endHold(s)
        for (const x of r.keepers) x.events.push({ t: 'over', ...end })
      }
      return null
    }
    case 'hit': {
      const got = asKeeper(r, k, () => hitBody(s, Math.trunc(num(m.id, 0, 1e9)), num(m.dmg, 0, MAX_HIT), !!m.crit))
      return got.killed ? { t: 'kill', id: m.id, salvage: got.salvage } : null
    }
    case 'mend': asKeeper(r, k, () => mendTick(s, Math.trunc(num(m.win, 0, 999)), num(m.dt, 0, 0.5))); return null
    case 'field': asKeeper(r, k, () => fieldStrike(s, num(m.x, -1, 400), num(m.z, -1, 400), num(m.r, 0, 12), num(m.dmg, 0, MAX_HIT), m.fy === undefined ? undefined : num(m.fy, -50, 200))); return null
    case 'surge': { const out = asKeeper(r, k, () => releaseSurge(s, k.pos.x, k.pos.z, k.pos.y)); return { t: 'surged', ...out } }
    case 'chest': {
      const got = asKeeper(r, k, () => chestTick(s, Math.trunc(num(m.spot, 0, 999)), num(m.dt, 0, 0.5)))
      if (!got) return null
      s.loot.length = 0   // the opener's, sent to the opener only
      if (got.kind === 'stones') {
        // the stones cache is found for the PARTY: every keeper owed them takes theirs, whoever lifted the lid;
        // a keeper not on the glove's road gets nothing from it
        const openerOwed = k.gloveOwed
        for (const o of r.keepers) if (o.gloveOwed) {
          o.gloveOwed = false
          if (o !== k) o.ws?.send(JSON.stringify({ t: 'loot', loot: got }))
        }
        s.gloveOwed = false
        return openerOwed ? { t: 'loot', loot: got } : { t: 'loot-shared', kind: 'stones' }
      }
      return { t: 'loot', loot: got }
    }
    case 'act': {
      const ok = asKeeper(r, k, () => {
        switch (m.a) {
          case 'gate': return buyGate(s, Math.trunc(num(m.arg, 0, 999)))
          case 'rack': return buyRack(s)
          case 'font': return buyFont(s)
          case 'cache': return buyCache(s)
          case 'plant': return plantDevice(s)
          case 'tune': return tuneWeapon(s, String(m.arg ?? ''))
          case 'study': return studyNode(s, String(m.arg ?? '') as LabNodeId)
        }
      })
      return { t: 'acted', a: m.a, arg: m.arg ?? null, ok: ok !== null && ok !== false, result: ok }
    }
  }
  return null
}

// ── FIND OTHERS: the matchmaking queue (Alex 09-28) ─────────────────────────────────────────────────────────────
// A keeper who asks to find others waits here. Three waiting → matched at once; two who have waited `fillSec` → go
// as two; anyone may press GO NOW and take whoever is waiting (even nobody: a room of one). A match is just a fresh
// room code, and the matched connect to it exactly as a party would (`?party=CODE`).
interface Waiter { id: string; name: string; ws: WebSocket; since: number }
/** one line per mission (`?queue=breach` / `?queue=slack`): a keeper looking for a Breach is never matched into a Slack */
export type QueueKind = 'breach' | 'slack'
const QUEUES: Record<QueueKind, Waiter[]> = { breach: [], slack: [] }
const QUEUE = QUEUES.breach   // the Breach's line: the default for callers that name none
export const QUEUE_OPTS = { fillSec: 25, size: MAX_KEEPERS }
const matchCode = () => 'MX' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'Q')
function tellQueue(Q: Waiter[] = QUEUE) {
  for (const w of Q) w.ws.send(JSON.stringify({ t: 'queue', n: Q.length, need: QUEUE_OPTS.size, waited: Math.round((Date.now() - w.since) / 1000) }))
}
export function makeMatch(ws: Waiter[], Q: Waiter[] = QUEUE): string {
  const code = matchCode()
  const names = ws.map(w => w.name)
  for (const w of ws) {
    const i = Q.indexOf(w); if (i >= 0) Q.splice(i, 1)
    w.ws.send(JSON.stringify({ t: 'matched', code, names }))
    try { w.ws.close() } catch { /* gone */ }
  }
  console.log(`[queue] matched ${names.join(' + ')} → ${code}`)
  tellQueue(Q)
  return code
}
export function queueTick(now = Date.now()) {
  for (const Q of Object.values(QUEUES)) {
    while (Q.length >= QUEUE_OPTS.size) makeMatch(Q.slice(0, QUEUE_OPTS.size), Q)
    if (Q.length >= 2 && now - Q[0].since >= QUEUE_OPTS.fillSec * 1000) makeMatch(Q.slice(0, QUEUE_OPTS.size), Q)
  }
}
function joinQueue(ws: WebSocket, id: string, name: string, kind: QueueKind = 'breach') {
  const QUEUE = QUEUES[kind]
  for (const Q of Object.values(QUEUES)) {   // one place in line per keeper, across every line
    const old = Q.findIndex(w => w.id === id)
    if (old >= 0) { try { Q[old].ws.close() } catch { /* gone */ } Q.splice(old, 1) }
  }
  const me: Waiter = { id, name, ws, since: Date.now() }
  QUEUE.push(me)
  console.log(`[queue+] ${name} (${QUEUE.length} waiting for ${kind})`)
  ws.on('message', (d) => {
    let m: { t?: string }
    try { m = JSON.parse(String(d)) } catch { return }
    if (m.t === 'go' && QUEUE.includes(me)) makeMatch([me, ...QUEUE.filter(w => w !== me)].slice(0, QUEUE_OPTS.size), QUEUE)
  })
  ws.on('close', () => { const i = QUEUE.indexOf(me); if (i >= 0) { QUEUE.splice(i, 1); tellQueue(QUEUE) } })
  tellQueue(QUEUE)
  queueTick()
}

// ── the socket ──────────────────────────────────────────────────────────────────────────────────────────────────
function cookie(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers.cookie ?? ''
  for (const part of raw.split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return decodeURIComponent(v.join('=')) }
  return undefined
}
const partyCode = (raw: string | null) => { const c = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); return c.length >= 4 ? c : null }

export function startServer(port = PORT) {
  const wss = new WebSocketServer({ port, host: '127.0.0.1' })
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const claims = readSessionToken(cookie(req, SESSION_COOKIE))
    const code = partyCode(url.searchParams.get('party'))
    const q = url.searchParams.get('queue')
    if (claims?.user_id && (q === 'breach' || q === 'slack')) { joinQueue(ws, claims.user_id, claims.username ?? 'Keeper', q); return }
    if (!claims?.user_id || !code) { ws.send(JSON.stringify({ t: 'refused', why: !claims ? 'sign in to play together' : 'no party' })); ws.close(); return }
    const mode: RoomMode = url.searchParams.get('mode') === 'slack' ? 'slack' : 'breach'
    const key = roomKey(code, mode)
    let r = ROOMS.get(key)
    if (!r || roomOver(r)) { console.log(`[${mode}] new room ${code} (${!r ? 'none' : 'previous run over'})`); r = newRoom(code, undefined, mode); ROOMS.set(key, r) }
    let k = r.keepers.find(x => x.id === claims.user_id)
    if (!k) {
      if (r.keepers.length >= MAX_KEEPERS) { ws.send(JSON.stringify({ t: 'refused', why: 'three to a door: this party\'s Breach is full' })); ws.close(); return }
      const at = mode === 'slack' ? { x: EDGE_START.x, z: EDGE_START.z, y: 0 } : { x: MAP.start.x, z: MAP.start.z, y: MAP.start.h }
      k = { id: claims.user_id, name: claims.username ?? 'Keeper', ws: null, pos: at, wallet: freshWallet(r.s), struck: 0, events: [], goneAt: null, down: false, downAt: 0, yaw: 0, gloveOwed: false }
      r.keepers.push(k)
    }
    k.ws = ws; k.goneAt = null; r.emptySince = null
    if (url.searchParams.get('glove') === '1') k.gloveOwed = true
    const room = r, me = k
    ws.send(JSON.stringify({ t: 'welcome', you: me.id, code, mode, start: mode === 'slack' ? { x: EDGE_START.x, z: EDGE_START.z, y: 0 } : { x: MAP.start.x, z: MAP.start.z, y: MAP.start.h } }))
    console.log(`[breach+] ${me.name} → ${code} (${room.keepers.filter(x => x.ws).length}/${MAX_KEEPERS})`)
    ws.on('message', (data) => {
      let m: Msg
      try { m = JSON.parse(String(data)) } catch { return }
      const reply = handle(room, me, m)
      if (reply) ws.send(JSON.stringify(reply))
    })
    ws.on('close', () => {
      if (me.ws === ws) { me.ws = null; me.goneAt = Date.now() }
      console.log(`[breach-] ${me.name} ← ${code}`)
    })
  })

  const DT = 1 / TICK_HZ
  setInterval(() => {
    const now = Date.now()
    queueTick(now)
    for (const [code, r] of ROOMS) {
      // a dropped keeper stops drawing the flood at once (`tickRoom` steps only the connected); their wallet waits
      // for a reconnect. A room with nobody connected for 60s is torn down.
      const present = r.keepers.filter(k => k.ws !== null)
      if (!present.length) { r.emptySince ??= now; if (now - r.emptySince > 60_000) { endHold(r.s); ROOMS.delete(code) } ; continue }
      if (r.mode === 'slack') tickSlack(r, DT, now); else tickRoom(r, DT)
      if (now - r.lastSnap >= 1000 / SNAP_HZ) {
        r.lastSnap = now
        for (const k of present) k.ws!.send(JSON.stringify(r.mode === 'slack' ? snapshotSlack(r, k) : snapshotFor(r, k)))
      }
    }
  }, 1000 * DT)
  console.log(`[breach-server] listening on 127.0.0.1:${port}`)
  return wss
}

if (process.argv[1]?.endsWith('breach-server.mts')) startServer()
