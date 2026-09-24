// Cluster sync — the host half of cluster phase 3 (2026-09-23).
//
// Two jobs, both one-way, both only while the keeper actually stands in a cluster:
//   · UP:   my plot's block edits → /api/cluster/plot, so my mates can see my quarter;
//   · DOWN: the shared record + my mates' snapshots → the `ClusterConfig` my plot space is framed in
//           and the pictures laid over their quarters (`applyMateEdits`).
// Offline first (Alex, 09-23): every failure here is "no cluster right now", never an error the
// keeper sees and never a reason the solo plot does not load. A mate's quarter is READ-ONLY and
// nothing from a snapshot ever enters my save (`plot-snapshot.ts` header).
import type { ClusterView } from '@/lib/accounts/clusters'
import { DEFAULT_CLUSTER, NO_SLOTS, QUARTERS, isCluster, type ClusterConfig, type QuarterId } from '../voxel/cluster'
import { buildSnapshot, readSnapshot, type PlotSnapshot } from '../voxel/plot-snapshot'
import type { PlotConfig } from '../voxel/plot'
import { plotColumnEdits } from './save'

export interface ClusterFrame {
  mine: QuarterId
  cfg: ClusterConfig
  snaps: Partial<Record<QuarterId, PlotSnapshot>>
}

/**
 * The shared record → the config my plot space is framed in. PURE.
 * ★ MY slot is my own seed and tier, from my own save — the server's copy is only what I last
 * reported, and my ground must never be generated from a stale report of itself.
 * Returns null unless the record really is a cluster (two keepers or more — canon: a cluster starts
 * at two; one is a fold held open and shows nothing).
 */
export function frameFromRecord(view: ClusterView | null, mine: QuarterId | null, mySeed: number, myTier: number,
                                base: PlotConfig): Omit<ClusterFrame, 'snaps'> | null {
  if (!view || !mine) return null
  const slots = { ...NO_SLOTS }
  for (const m of view.members) {
    if (!(QUARTERS as readonly string[]).includes(m.quarter)) continue
    slots[m.quarter] = m.quarter === mine ? { seed: mySeed, tier: myTier } : { seed: m.seed | 0, tier: m.tier | 0 }
  }
  if (!slots[mine]) return null
  const cfg: ClusterConfig = { ...DEFAULT_CLUSTER, base, slots }
  return isCluster(cfg) ? { mine, cfg } : null
}

/** Fetch the record and every mate's picture. null = not in a cluster (or offline, or signed out). */
export async function loadClusterFrame(mySeed: number, myTier: number, base: PlotConfig): Promise<ClusterFrame | null> {
  try {
    const r = await fetch('/api/cluster', { cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as { cluster: ClusterView | null; quarter: QuarterId | null }
    const f = frameFromRecord(j.cluster, j.quarter, mySeed, myTier, base)
    if (!f) return null
    // Keep the record's copy of MY seed and tier current — it is what my mates' clients generate my
    // quarter from (`reportFold`: the only facts the ground needs of me). Fire and forget.
    void fetch('/api/cluster', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'report', seed: mySeed, tier: myTier }) }).catch(() => {})
    const snaps: ClusterFrame['snaps'] = {}
    const p = await fetch('/api/cluster/plot', { cache: 'no-store' }).catch(() => null)
    if (p?.ok) {
      const pj = (await p.json().catch(() => ({}))) as { plots?: Partial<Record<QuarterId, { data: string }>> }
      for (const q of QUARTERS) {
        const s = q !== f.mine && f.cfg.slots[q] ? readSnapshot(pj.plots?.[q]?.data) : null
        if (s) snaps[q] = s
      }
    }
    return { ...f, snaps }
  } catch { return null }
}

/** Upload my plot's picture now. The caller flushes first. Quietly false on any failure. */
/**
 * My station's lamp cells, noted by the court pass each time it lays or relights them, and sent with
 * my picture so my mates can show my station dormant while I am away (`applyMateLamps`). Module
 * state, like the upload timer below: there is one keeper and one station per tab.
 */
let myLamps: { x: number; y: number; z: number; dark: number }[] = []
export function noteStationLamps(lamps: readonly { x: number; y: number; z: number; dark: number }[]): void {
  myLamps = lamps.map(l => ({ x: l.x, y: l.y, z: l.z, dark: l.dark }))
}

export async function uploadPlot(seed: number): Promise<boolean> {
  try {
    const snap = buildSnapshot(await plotColumnEdits(seed), myLamps)
    // ⚠ AN EMPTY PICTURE IS NEVER SENT. A second device (a fresh browser, a phone) holds none of the
    // keeper's garden, and uploading its empty store would wipe the picture their mates see — an
    // empty picture can only ever HIDE a garden, never show one. (Found headless, 2026-09-23.)
    if (!Object.keys(snap.cols).length) return false
    const r = await fetch('/api/cluster/plot', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(snap),
    })
    return r.ok
  } catch { return false }
}

let timer: ReturnType<typeof setTimeout> | null = null
let pendingSeed: number | null = null
/**
 * Upload a little after the last change, not on every swing: a mate sees my garden as of the last
 * quiet moment, which is all a read-only picture needs to be. `flush` runs first so the disk has it.
 */
export function scheduleUpload(seed: number, flush: () => void, delayMs = 20_000): void {
  if (timer) clearTimeout(timer)
  pendingSeed = seed
  timer = setTimeout(() => { timer = null; pendingSeed = null; flush(); void uploadPlot(seed) }, delayMs)
}
/**
 * Send a pending upload NOW — leaving the cluster (or rebuilding it) is the quiet moment, and a
 * cancelled timer there would leave my mates looking at a garden from before my last session.
 */
export function settleUpload(): void {
  if (!timer || pendingSeed === null) return
  const seed = pendingSeed
  clearTimeout(timer); timer = null; pendingSeed = null
  void uploadPlot(seed)
}

/**
 * ★ I AM IN THE WORLD (2026-09-24). Pings the record and gets back which of my mates are too, as the
 * set of quarters that are AWAY — their stations show dormant. null = no answer (signed out, not in a
 * cluster, offline): the caller keeps whatever it last showed rather than guessing.
 */
export async function heartbeat(): Promise<Set<QuarterId> | null> {
  try {
    const r = await fetch('/api/cluster', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'here' }), cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as { awake?: Partial<Record<QuarterId, boolean>> | null }
    if (!j.awake) return null
    return new Set(QUARTERS.filter(q => j.awake![q] === false))
  } catch { return null }
}
