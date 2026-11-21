// ── PLOT VISITS: party members walk your whole plot (BETA M61, Alex 11-21 "Full plot visits"; slice 1 = travel + snapshot +
// walk, read-only) ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// Until now the home plot had no socket ('personal space', open-mp.tsx). Now:
//   · a keeper standing on their OWN plot while in a party joins the socket zone `open:plot:<their socket id>`; a party code
//     puts that in the party's own instance (shimmer-server party_instance_id), which strangers never join. No party = no
//     socket on the plot, exactly as before.
//   · a party mate who presses Visit (Play together › Party, from the lobby roster: the lobby says which zone each mate is in)
//     joins the SAME zone, asks the host for the plot (PV_WANT), and the host answers with a SNAPSHOT: the works (rooms,
//     walls, floors, upper levels, stairs, rails, decks, columns, foundation, pieces) + the squares they own.
//   · the relay caps a message at 2 KB (shimmer-server RELAY_MAX_BYTES) and 20/s, so the snapshot is deflated, base64'd and
//     CHUNKED: {v, i, n, d}. The guest keeps only the newest version and assembles when all n parts are in.
//   · while visiting, the guest's works store READS the host's plot and REFUSES every write (workshop.tsx setWorks), and the
//     page refuses build, placing, pick-up and the station / store panels (guestRefuses). The guest's own save is never read
//     into or written from the host's plot.
// Slice 2 = live changes (the host re-sends on change, versioned); slice 3 = the lift, send-home, host offline.
// Pure apart from the tiny visit store at the bottom (no React import: the page wraps it).
import type { Works } from './rooms'

export const PLOT_ZONE = 'open:plot:'
export const plotZone = (hostId: string) => PLOT_ZONE + hostId
/** the host's socket id from a plot zone, or null for any other zone */
export function hostOfZone(zone: string | null | undefined): string | null {
  if (!zone || !zone.startsWith(PLOT_ZONE)) return null
  const id = zone.slice(PLOT_ZONE.length)
  return /^[A-Za-z0-9_-]{2,36}$/.test(id) ? id : null
}

export const PV_WANT = 'pv:want', PV_SNAP = 'pv:snap'
/** characters of base64 per part: with the envelope ({"v":..,"i":..,"n":..,"d":".."}) and the relay's own wrapper this stays
 *  well under the server's 2048-byte cap */
export const CHUNK = 1500
/** a plot bigger than this many parts is refused (≈ 300 KB deflated: far past any real house; a bound, not a target) */
export const MAX_PARTS = 200

export interface PlotSnap { works: Works; owned: string[] }
export interface SnapPart { v: number; i: number; n: number; d: string }

// ── the codec ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function b64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function unb64(s: string): Uint8Array {
  const bin = atob(s), out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
async function pipe(bytes: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(t)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function packSnap(s: PlotSnap): Promise<string> {
  return b64(await pipe(new TextEncoder().encode(JSON.stringify(s)), new CompressionStream('deflate-raw')))
}
export async function unpackSnap(packed: string): Promise<PlotSnap | null> {
  try {
    const raw = JSON.parse(new TextDecoder().decode(await pipe(unb64(packed), new DecompressionStream('deflate-raw'))))
    return validSnap(raw) ? raw : null
  } catch { return null }
}

/** the shape a guest will render: a works with its three arrays, and owned as strings (anything else is dropped whole) */
export function validSnap(x: unknown): x is PlotSnap {
  if (!x || typeof x !== 'object') return false
  const s = x as { works?: unknown; owned?: unknown }, w = s.works as Partial<Works> | undefined
  return !!w && typeof w === 'object' && Array.isArray(w.rooms) && Array.isArray(w.chests) && Array.isArray(w.pieces)
    && (w.upper === undefined || Array.isArray(w.upper))
    && Array.isArray(s.owned) && s.owned.every(o => typeof o === 'string')
}

export function chunk(packed: string, v: number): SnapPart[] {
  const n = Math.max(1, Math.ceil(packed.length / CHUNK)), out: SnapPart[] = []
  for (let i = 0; i < n; i++) out.push({ v, i, n, d: packed.slice(i * CHUNK, (i + 1) * CHUNK) })
  return out
}

export function isSnapPart(x: unknown): x is SnapPart {
  if (!x || typeof x !== 'object') return false
  const p = x as SnapPart
  return Number.isFinite(p.v) && Number.isInteger(p.i) && Number.isInteger(p.n) && p.n >= 1 && p.n <= MAX_PARTS
    && p.i >= 0 && p.i < p.n && typeof p.d === 'string' && p.d.length <= CHUNK
}

/** The guest's side of the chunking: newest version wins, an older part is ignored, a part with a different count for the same
 *  version restarts it. `add` returns the packed string once every part of a version is in (once per version). */
export class Reassembly {
  v = -Infinity
  private n = 0
  private parts: (string | undefined)[] = []
  private got = 0
  private done = false
  add(p: SnapPart): string | null {
    if (!isSnapPart(p) || p.v < this.v) return null
    if (p.v > this.v || p.n !== this.n) { this.v = p.v; this.n = p.n; this.parts = new Array(p.n); this.got = 0; this.done = false }
    if (this.done) return null
    if (this.parts[p.i] === undefined) { this.parts[p.i] = p.d; this.got++ }
    if (this.got < this.n) return null
    this.done = true
    return this.parts.join('')
  }
  /** how many parts of the current version are in (a probe for the check) */
  progress() { return { v: this.v, got: this.got, n: this.n } }
}

// ── the visit store ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Who you are visiting (null = home). `snap` is null until the host's plot has arrived. */
export interface Visit { host: string; name: string; snap: PlotSnap | null; v: number }
let visit: Visit | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())
export const subscribeVisit = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const currentVisit = () => visit
export const isVisiting = () => visit !== null
export function startVisit(host: string, name: string) { visit = { host, name: name || 'a friend', snap: null, v: -Infinity }; noteVisit('start:' + host); emit() }
/** a newer snapshot of the plot being visited (an older or foreign one is ignored) */
export function setVisitSnap(host: string, v: number, snap: PlotSnap) {
  if (!visit || visit.host !== host || v <= visit.v) return false
  visit = { ...visit, snap, v }; emit(); return true
}
export function endVisit(why = 'home') { if (!visit) return; visit = null; noteVisit('end:' + why); emit() }
/** what happened to visits on this page, oldest first (a probe for the check: a timed-out visit is gone before a slow page answers) */
const log: string[] = []
export function noteVisit(e: string) { log.push(e); if (log.length > 40) log.shift() }
export const visitLog = () => [...log]

/** Every write a guest might try on someone else's plot goes through this: true = refused (the caller stops), with one line said.
 *  `say` is injected so this file stays free of the HUD. */
let refusals = 0
export function guestRefuses(say?: (msg: string) => void): boolean {
  if (!visit) return false
  refusals++
  say?.(`You are a guest on ${visit.name}'s plot. Look around, but only they can change it.`)
  return true
}
export const refusalCount = () => refusals

// ── the works store's split (workshop.tsx calls these, so the rule is tested here, not in a React file) ─────────────────────
/** what the plot shows: the host's works while visiting (an empty plot until the snapshot lands), else your own */
export function shownWorks(own: Works): Works {
  if (!visit) return own
  return visit.snap?.works ?? EMPTY_WORKS
}
const EMPTY_WORKS: Works = { v: 1, rooms: [], chests: [], pieces: [] }
/** may the works store be written? Never while visiting: nothing a guest does reaches the host's plot or their own save */
export const worksWritable = () => visit === null
/** the squares the plot shows as owned: the host's while visiting */
export function shownOwned(own: readonly string[]): readonly string[] {
  return visit ? (visit.snap?.owned ?? []) : own
}

// ── slice 2: the host's ONE send queue (answers to PV_WANT and live re-sends share it, so the relay rate holds) ───────────────
/** Parts waiting to go, one per tick. A newer version for a peer drops that peer's older parts still queued (a guest only ever
 *  assembles the newest), and the same version is never queued twice for one peer. Peers are served round-robin. */
export class SendQueue {
  private q = new Map<string, SnapPart[]>()
  private order: string[] = []
  enqueue(to: string, parts: SnapPart[]) {
    if (!parts.length) return
    const cur = this.q.get(to)
    if (cur?.length && cur[0].v >= parts[0].v) return
    this.q.set(to, [...parts])
    if (!this.order.includes(to)) this.order.push(to)
  }
  next(): { to: string; part: SnapPart } | null {
    while (this.order.length) {
      const to = this.order.shift()!, list = this.q.get(to)
      if (!list?.length) { this.q.delete(to); continue }
      const part = list.shift()!
      if (list.length) this.order.push(to); else this.q.delete(to)
      return { to, part }
    }
    return null
  }
  drop(to: string) { this.q.delete(to); this.order = this.order.filter(x => x !== to) }
  size() { let n = 0; for (const l of this.q.values()) n += l.length; return n }
}
