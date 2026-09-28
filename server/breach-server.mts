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
 */
import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import {
  parseLanding, startHold, stepHoldParty, hitBody, mendTick, buyGate, buyRack, buyFont, plantDevice, tuneWeapon,
  studyNode, chestTick, releaseSurge, fieldStrike, endHold, type HoldState, type HoldKeeper, type LabNodeId,
} from '../src/app/shimmer/play3d/hold'
import { readSessionToken, SESSION_COOKIE } from '../src/lib/accounts/session'

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
  /** fallen in this run: out of the flood's reach until the run ends (co-op: the run ends when EVERY keeper is down) */
  down: boolean
}
interface Room { code: string; s: HoldState; keepers: Keeper[]; startedAt: number; lastSnap: number; emptySince: number | null }
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

export function newRoom(code: string, seed = (Date.now() & 0xffff) || 1): Room {
  const s = startHold(MAP, seed)
  return { code, s, keepers: [], startedAt: Date.now(), lastSnap: 0, emptySince: null }
}

/** One tick of a room: step the shared fight with every present keeper, then route what it produced. */
export function tickRoom(r: Room, dt: number): void {
  const here = r.keepers.filter(k => k.ws !== null && !k.down)
  const pickups0 = r.s.pickups.length
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

/** What one keeper sees: the shared fight, and their own wallet. Small enough to send ten times a second. */
export function snapshotFor(r: Room, k: Keeper) {
  const s = r.s
  return {
    t: 'snap',
    round: s.round, toSpawn: s.toSpawn, breakT: s.breakT, hush: s.hush, over: s.over, running: s.running, elapsed: s.elapsed,
    flood: s.flood.filter(b => b.alive).map(b => ({ id: b.id, kind: b.kind, x: +b.x.toFixed(2), z: +b.z.toFixed(2), y: +b.y.toFixed(2), hp: b.hp, maxHp: b.maxHp, phase: b.phase, win: b.win, vx: +b.vx.toFixed(2), vz: +b.vz.toFixed(2) })),
    planks: s.planks, gatesOpen: s.gatesOpen, rooms: s.rooms, chests: s.chests, drops: s.drops,
    devicePlanted: s.devicePlanted, studied: s.studied,
    you: { ...k.wallet, struck: k.struck },
    party: r.keepers.map(o => ({ id: o.id, name: o.name, down: o.down, x: +o.pos.x.toFixed(2), z: +o.pos.z.toFixed(2), y: +o.pos.y.toFixed(2), here: o.ws !== null })),
    events: k.events.splice(0),
  }
}

type Msg =
  | { t: 'pos'; x: number; y: number; z: number }
  | { t: 'hit'; id: number; dmg: number; crit?: boolean }
  | { t: 'mend'; win: number; dt: number }
  | { t: 'chest'; spot: number; dt: number }
  | { t: 'field'; x: number; z: number; r: number; dmg: number; fy?: number }
  | { t: 'surge' }
  | { t: 'act'; a: 'gate' | 'rack' | 'font' | 'plant' | 'tune' | 'study'; arg?: number | string }
  | { t: 'struck-ack' }
  | { t: 'down' }

const num = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d)

/** Apply one message from a keeper. Returns a reply for that keeper, or null. */
export function handle(r: Room, k: Keeper, m: Msg): unknown | null {
  const s = r.s
  switch (m.t) {
    case 'pos': k.pos = { x: num(m.x, -1, 400), y: num(m.y, -50, 200), z: num(m.z, -1, 400) }; return null
    case 'struck-ack': k.struck = 0; return null
    case 'down': {
      k.down = true
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
      return { t: 'loot', loot: got }
    }
    case 'act': {
      const ok = asKeeper(r, k, () => {
        switch (m.a) {
          case 'gate': return buyGate(s, Math.trunc(num(m.arg, 0, 999)))
          case 'rack': return buyRack(s)
          case 'font': return buyFont(s)
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
    if (!claims?.user_id || !code) { ws.send(JSON.stringify({ t: 'refused', why: !claims ? 'sign in to play together' : 'no party' })); ws.close(); return }
    let r = ROOMS.get(code)
    if (!r || r.s.over) { r = newRoom(code); ROOMS.set(code, r) }
    let k = r.keepers.find(x => x.id === claims.user_id)
    if (!k) {
      if (r.keepers.length >= MAX_KEEPERS) { ws.send(JSON.stringify({ t: 'refused', why: 'three to a door: this party\'s Breach is full' })); ws.close(); return }
      k = { id: claims.user_id, name: claims.username ?? 'Keeper', ws: null, pos: { x: MAP.start.x, z: MAP.start.z, y: MAP.start.h }, wallet: freshWallet(r.s), struck: 0, events: [], goneAt: null, down: false }
      r.keepers.push(k)
    }
    k.ws = ws; k.goneAt = null; r.emptySince = null
    const room = r, me = k
    ws.send(JSON.stringify({ t: 'welcome', you: me.id, code, start: { x: MAP.start.x, z: MAP.start.z, y: MAP.start.h } }))
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
    for (const [code, r] of ROOMS) {
      // a dropped keeper stops drawing the flood at once (`tickRoom` steps only the connected); their wallet waits
      // for a reconnect. A room with nobody connected for 60s is torn down.
      const present = r.keepers.filter(k => k.ws !== null)
      if (!present.length) { r.emptySince ??= now; if (now - r.emptySince > 60_000) { endHold(r.s); ROOMS.delete(code) } ; continue }
      tickRoom(r, DT)
      if (now - r.lastSnap >= 1000 / SNAP_HZ) {
        r.lastSnap = now
        for (const k of present) k.ws!.send(JSON.stringify(snapshotFor(r, k)))
      }
    }
  }, 1000 * DT)
  console.log(`[breach-server] listening on 127.0.0.1:${port}`)
  return wss
}

if (process.argv[1]?.endsWith('breach-server.mts')) startServer()
