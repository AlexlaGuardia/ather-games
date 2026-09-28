// breach-link.ts — the browser's end of a CO-OP Breach (2026-09-28). See `server/breach-server.mts`.
//
// In co-op the page does not step its own Breach. It keeps a MIRROR `HoldState` (built by `startHold`, so the map,
// the field arrays and every reader the renderer uses are real), overwrites the shared fight from each snapshot,
// and sends what its keeper does. Between snapshots (10 a second) the flood keeps moving on its last velocity
// (`driftMirror`), so a body glides instead of jumping. What the page does is unchanged in shape: the call sites
// ask `coop.link` and, when it is set, SEND the act instead of applying it; the next snapshot shows the result.
//
// One link per page (`coop`), the same way there is one game per page.
import type { HoldState, FloodBody, HoldLoot } from './hold'

export interface CoopPartyMember { id: string; name: string; x: number; z: number; y: number; here: boolean; down: boolean }
export interface CoopEvents {
  onStruck?: (dmg: number) => void
  onRound?: (n: number) => void
  onLoud?: () => void
  onPickup?: (kind: string) => void
  onLoot?: (loot: HoldLoot) => void
  onActed?: (a: string, ok: boolean, arg: unknown, result: unknown) => void
  onOver?: (round: number, kills: number) => void
  onRefused?: (why: string) => void
  onStatus?: (s: 'connecting' | 'live' | 'lost') => void
}

type Snap = {
  round: number; toSpawn: number; breakT: number; hush: number; over: boolean; running: boolean; elapsed: number
  flood: { id: number; kind: FloodBody['kind']; x: number; z: number; y: number; hp: number; maxHp: number; phase: FloodBody['phase']; win: number; vx: number; vz: number }[]
  planks: number[]; gatesOpen: boolean[]; rooms: Record<string, boolean>; chests: HoldState['chests']; drops: HoldState['drops']
  devicePlanted: boolean; studied: HoldState['studied']
  you: { salvage: number; surge: number; tuned: Record<string, number>; rackBought: boolean; kills: number; wrack: number; struck: number }
  party: CoopPartyMember[]
  events: { t: string; n?: number; kind?: string; round?: number; kills?: number }[]
}

/** Overwrite the mirror's shared fight + this keeper's wallet from a snapshot. Bodies are kept by id (stable objects). */
export function applySnap(s: HoldState, m: Snap): void {
  s.round = m.round; s.toSpawn = m.toSpawn; s.breakT = m.breakT; s.hush = m.hush; s.over = m.over; s.running = m.running; s.elapsed = m.elapsed
  s.planks = m.planks; s.gatesOpen = m.gatesOpen; s.rooms = m.rooms; s.chests = m.chests; s.drops = m.drops
  s.devicePlanted = m.devicePlanted; s.studied = m.studied
  s.salvage = m.you.salvage; s.surge = m.you.surge; s.tuned = m.you.tuned; s.rackBought = m.you.rackBought; s.kills = m.you.kills; s.wrack = m.you.wrack
  const byId = new Map(s.flood.map(b => [b.id, b]))
  s.flood = m.flood.map(f => {
    const b = byId.get(f.id)
    if (b) { Object.assign(b, f); b.alive = true; return b }
    return { ...f, alive: true, tearT: 0, strikeT: 0, vent: -1 } as FloodBody
  })
}

/** Between snapshots: carry every inside body on its last velocity (dead reckoning; the next snapshot corrects it). */
export function driftMirror(s: HoldState, dt: number): void {
  const k = Math.min(dt, 0.1)
  for (const b of s.flood) if (b.alive && b.phase === 'inside') { b.x += b.vx * k; b.z += b.vz * k }
}

export class BreachLink {
  ws: WebSocket | null = null
  party: CoopPartyMember[] = []
  status: 'connecting' | 'live' | 'lost' = 'connecting'
  private lastPos = 0
  constructor(readonly code: string, readonly mirror: HoldState, private ev: CoopEvents) {}

  open(): void {
    if (typeof window === 'undefined') return
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${scheme}//${window.location.host}/breach-ws/?party=${encodeURIComponent(this.code)}`)
    this.ws = ws
    this.setStatus('connecting')
    ws.onmessage = (e) => {
      let m: { t: string; [k: string]: unknown }
      try { m = JSON.parse(String(e.data)) } catch { return }
      if (m.t === 'welcome') this.setStatus('live')
      else if (m.t === 'refused') { this.ev.onRefused?.(String(m.why ?? '')); this.close() }
      else if (m.t === 'snap') {
        const snap = m as unknown as Snap
        applySnap(this.mirror, snap)
        this.party = snap.party
        if (snap.you.struck > 0) this.ev.onStruck?.(snap.you.struck)
        for (const x of snap.events) {
          if (x.t === 'round' && x.n) this.ev.onRound?.(x.n)
          else if (x.t === 'loud') this.ev.onLoud?.()
          else if (x.t === 'pickup' && x.kind) this.ev.onPickup?.(x.kind)
          else if (x.t === 'over') this.ev.onOver?.(x.round ?? this.mirror.round, x.kills ?? 0)
        }
      } else if (m.t === 'loot') this.ev.onLoot?.(m.loot as HoldLoot)
      else if (m.t === 'acted') this.ev.onActed?.(String(m.a), !!m.ok, m.arg, m.result)
    }
    ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.setStatus('lost') } }
  }
  close(): void { const w = this.ws; this.ws = null; try { w?.close() } catch { /* already gone */ } }
  private setStatus(s: BreachLink['status']) { this.status = s; this.ev.onStatus?.(s) }
  private send(m: unknown): void { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)) }

  /** where this keeper stands (feet); throttled to 15 a second */
  pos(x: number, y: number, z: number): void {
    const now = performance.now()
    if (now - this.lastPos < 66) return
    this.lastPos = now
    this.send({ t: 'pos', x, y, z })
  }
  hit(id: number, dmg: number, crit: boolean): void { this.send({ t: 'hit', id, dmg, crit }) }
  mend(win: number, dt: number): void { this.send({ t: 'mend', win, dt }) }
  chest(spot: number, dt: number): void { this.send({ t: 'chest', spot, dt }) }
  field(x: number, z: number, r: number, dmg: number, fy?: number): void { this.send({ t: 'field', x, z, r, dmg, fy }) }
  surge(): void { this.send({ t: 'surge' }) }
  act(a: 'gate' | 'rack' | 'font' | 'cache' | 'plant' | 'tune' | 'study', arg?: number | string): void { this.send({ t: 'act', a, arg }) }
  down(): void { this.send({ t: 'down' }) }
}

/** The page's one co-op link, and whether the NEXT Breach run should be co-op (set by Departures' Go together). */
export const coop: { link: BreachLink | null; wantParty: string | null; struck: number } = { link: null, wantParty: null, struck: 0 }
