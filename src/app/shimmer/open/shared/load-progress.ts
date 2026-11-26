// M187: the loader's REAL percent. Every byte the load screen waits on goes through meteredFetch, which counts the body as
// it streams in; the Dewbear's place on the track is that count over what the load will fetch, never a timer.
//   · want: a file's Content-Length when the server sends one (glbs, .bin, .gz, .biome). JSON comes br-compressed with no
//     length, so it is BOUNDED by its decoded size baked in HINT (the reader counts decoded bytes, so like is compared with
//     like); a file larger than its hint just sits at its share until it ends, one smaller jumps to its share when it ends.
//   · a page that knows a load is coming RESERVES its bytes up front (a budget per group): without it the percent would race
//     to 100 on the first small file and fall back when the next one starts. A job in the group draws its want out of the
//     budget; release() drops what was not used (tiles already loaded, a resume near home), which only moves it forward.
//   · the shown percent never goes back; it is 100 only when nothing is pending and nothing is reserved.
// Pure apart from meteredFetch (no React, no storage): load-progress.test.ts runs it under plain tsx.

/** decoded sizes of the files that come without a Content-Length (public/open, 11-26); a missing one is HINT_DEFAULT */
export const HINT: Record<string, number> = {
  '/open/continent.json': 692973, '/open/continent.bin.gz': 2577643, '/open/wilds/tiles.json': 75464,
}
export const HINT_DEFAULT = 64 * 1024
/** one Wilds tile = its .json (~0.4 KB) + .bin (126 002) + .biome (62 500) */
export const TILE_BYTES = 1000 + 126002 + 62500
export function hintFor(url: string): number {
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  if (HINT[path]) return HINT[path]
  if (/\/open\/wilds\/[^/]+\.json$/.test(path)) return 1000
  if (/\/open\/wilds\/[^/]+\.bin$/.test(path)) return 126002
  if (/\/open\/wilds\/[^/]+\.biome$/.test(path)) return 62500
  return HINT_DEFAULT
}

interface Job { want: number; got: number; done: boolean }
export class LoadMeter {
  private jobs = new Map<string, Job>()
  private budget = new Map<string, number>()
  private shown = 0
  private subs = new Set<() => void>()
  /** nothing in flight and nothing reserved: the next begin / reserve starts a new load from 0 */
  idle() { for (const j of this.jobs.values()) if (!j.done) return false; for (const b of this.budget.values()) if (b > 0) return false; return true }
  private fresh() { if (this.idle()) { this.jobs.clear(); this.budget.clear(); this.shown = 0 } }
  reserve(group: string, bytes: number) { this.fresh(); this.budget.set(group, (this.budget.get(group) ?? 0) + Math.max(0, bytes)); this.emit() }
  release(group: string) { if (this.budget.delete(group)) this.emit() }
  /** set a group's budget to what is now known to be left (never starts a new load, unlike reserve) */
  budgetTo(group: string, bytes: number) { this.budget.set(group, Math.max(0, bytes)); this.emit() }
  begin(key: string, want: number, group?: string) {
    this.fresh()
    this.jobs.set(key, { want: Math.max(1, want), got: 0, done: false }); this.draw(group, want); this.emit()
  }
  /** the real size once the headers say it (replaces the hint). A file bigger than its hint charges the budget the
   *  difference; a smaller one gives nothing back (that would hold the percent down for bytes nobody will fetch). */
  resize(key: string, want: number, group?: string) {
    const j = this.jobs.get(key); if (!j || j.done || !(want > 0)) return
    if (want > j.want) this.draw(group, want - j.want)
    j.want = want; this.emit()
  }
  add(key: string, bytes: number) { const j = this.jobs.get(key); if (j && !j.done) { j.got += bytes; this.emit() } }
  end(key: string) { const j = this.jobs.get(key); if (j && !j.done) { j.done = true; this.emit() } }
  private draw(group: string | undefined, bytes: number) {
    if (!group || !this.budget.has(group)) return
    this.budget.set(group, Math.max(0, this.budget.get(group)! - bytes))
  }
  /** the raw fraction, 0..1 (1 only when every job ended and no budget is left) */
  raw(): number {
    let got = 0, want = 0
    for (const j of this.jobs.values()) { want += j.want; got += j.done ? j.want : Math.min(j.got, j.want) }
    for (const b of this.budget.values()) want += b
    if (want <= 0) return 0
    return this.idle() ? 1 : Math.min(got / want, 0.995)
  }
  /** the percent to show, 0..100, whole, never going back within one load */
  percent(): number { this.shown = Math.max(this.shown, Math.floor(this.raw() * 100)); return this.shown }
  subscribe(f: () => void) { this.subs.add(f); return () => { this.subs.delete(f) } }
  private emit() { for (const f of this.subs) f() }
}

/** the page's one meter (the LoadScreen reads it; window.__loadMeter for the checks) */
export const loadMeter = new LoadMeter()
if (typeof window !== 'undefined') (window as unknown as { __loadMeter?: LoadMeter }).__loadMeter = loadMeter

let seq = 0
/** fetch, counting the body into the meter as it streams. The Response handed back holds the same bytes. */
export async function meteredFetch(url: string, group?: string, meter: LoadMeter = loadMeter): Promise<Response> {
  const key = `${url}#${++seq}`
  meter.begin(key, hintFor(url), group)
  let res: Response
  try { res = await fetch(url) } catch (e) { meter.end(key); throw e }
  const len = Number(res.headers.get('content-length')), enc = res.headers.get('content-encoding')
  if (!enc && len > 0) meter.resize(key, len, group)
  if (!res.ok || !res.body) { meter.end(key); return res }
  const reader = res.body.getReader(), chunks: Uint8Array[] = []
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); meter.add(key, value.byteLength) }
  } finally { meter.end(key) }
  return new Response(new Blob(chunks as BlobPart[]), { status: res.status, statusText: res.statusText, headers: res.headers })
}
