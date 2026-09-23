// ── Garden clusters: the shared record ─────────────────────────────────────────────────────────
//
// Canon (athernyx game/shimmer-geography.md › GARDEN CLUSTERS, ruled 09-22/23, and its four guards).
// This file is the part of a cluster that has to live somewhere every member can read: who stands
// in which quarter, and the open offers. The GROUND is `shimmer/voxel/cluster*.ts`; each member's
// garden stays their own save (Alex, 09-23: offline first, a mate's quarter is read-only to you).
//
// ⛔ THE FOUR LANDLORD GUARDS, AS CODE AND NOT AS POLICY:
//   1. NOBODY CAN REMOVE ANYONE. There is no function here that deletes another keeper's row. The
//      only exit is `takeBackCorner(self)`. clusters.test.ts asserts the export list.
//   2. THE FOLDER GAINS NOTHING. `folded_by` is written once and read by nothing that decides.
//   3. NO TITLE. No leader/owner/founder/head anywhere in the data or the shape returned.
//   4. FILLING A SLOT TAKES EVERYONE'S YES. An offer fills only when every CURRENT member has
//      consented and the invitee accepts. Consent is re-checked at the moment of filling, so a
//      member who joined after the offer was made is asked too.
//
// ★ JOINING NEEDS NO RUNE, NO LEVEL, NO CRAFT, ONLY CONSENT (canon). Folding needs Enchant, and the
// rune lives in the keeper's own browser, so `foldCluster` takes the client's word for it today.
// That is the offline-first trade, written down: the server cannot see runes yet.
import { randomBytes } from 'node:crypto'
import { accountsDb, areFriends, getAccountByUsername } from './db'

export type Quarter = 'ne' | 'nw' | 'sw' | 'se'
export const QUARTERS: readonly Quarter[] = ['ne', 'nw', 'sw', 'se']
export const isQuarter = (q: unknown): q is Quarter => typeof q === 'string' && (QUARTERS as readonly string[]).includes(q)

export interface ClusterMember { user_id: string; username: string | null; quarter: Quarter; seed: number; tier: number }
export interface ClusterOffer { quarter: Quarter; invitee_id: string; invitee: string | null; consented: string[] }
export interface ClusterView {
  cluster_id: string
  /** Who folded it — remembered like who raised the barn. Nothing reads it to decide anything. */
  folded_by: string
  members: ClusterMember[]
  offers: ClusterOffer[]
}
export type Result<T = true> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

function memberRow(user_id: string): { cluster_id: string; quarter: Quarter } | null {
  const r = accountsDb().prepare('SELECT cluster_id, quarter FROM cluster_members WHERE user_id = ?').get(user_id) as { cluster_id: string; quarter: Quarter } | undefined
  return r ?? null
}
const membersOf = (cluster_id: string): string[] =>
  (accountsDb().prepare('SELECT user_id FROM cluster_members WHERE cluster_id = ?').all(cluster_id) as { user_id: string }[]).map(r => r.user_id)

/** The cluster this keeper stands in, as every member sees it — or null. */
export function getCluster(user_id: string): ClusterView | null {
  const me = memberRow(user_id)
  if (!me) return null
  return viewOf(me.cluster_id)
}

function viewOf(cluster_id: string): ClusterView | null {
  const d = accountsDb()
  const c = d.prepare('SELECT cluster_id, folded_by FROM clusters WHERE cluster_id = ?').get(cluster_id) as { cluster_id: string; folded_by: string } | undefined
  if (!c) return null
  const members = d.prepare(`
    SELECT m.user_id, a.username, m.quarter, m.seed, m.tier FROM cluster_members m
    LEFT JOIN accounts a ON a.user_id = m.user_id WHERE m.cluster_id = ? ORDER BY m.joined_at
  `).all(cluster_id) as unknown as ClusterMember[]
  const offers = (d.prepare(`
    SELECT o.quarter, o.invitee_id, a.username AS invitee FROM cluster_offers o
    LEFT JOIN accounts a ON a.user_id = o.invitee_id WHERE o.cluster_id = ?
  `).all(cluster_id) as { quarter: Quarter; invitee_id: string; invitee: string | null }[]).map(o => ({
    ...o,
    consented: (d.prepare('SELECT member_id FROM cluster_consents WHERE cluster_id = ? AND quarter = ?')
      .all(cluster_id, o.quarter) as { member_id: string }[]).map(r => r.member_id),
  }))
  return { cluster_id: c.cluster_id, folded_by: c.folded_by, members, offers }
}

/** Offers waiting on THIS keeper's answer (they are the invitee). */
export function offersFor(user_id: string): { cluster_id: string; quarter: Quarter }[] {
  return accountsDb().prepare('SELECT cluster_id, quarter FROM cluster_offers WHERE invitee_id = ?').all(user_id) as { cluster_id: string; quarter: Quarter }[]
}

/**
 * Offers waiting on this keeper, with what they need to decide (phase 4, the Gardens menu): who is
 * already in (names only — the order they came, never who folded it: guard 3) and how many of
 * them have yet to say yes. ⚠ READ-ONLY to the invitee: they are not a member, so this shows them
 * the cluster's faces and nothing else — no offers, no seeds, no plots.
 */
export function invitesFor(user_id: string): { cluster_id: string; quarter: Quarter; keepers: string[]; waiting: number }[] {
  const d = accountsDb()
  return offersFor(user_id).map(o => {
    const keepers = (d.prepare(`
      SELECT a.username FROM cluster_members m LEFT JOIN accounts a ON a.user_id = m.user_id
      WHERE m.cluster_id = ? ORDER BY m.joined_at
    `).all(o.cluster_id) as { username: string | null }[]).map(r => r.username ?? 'a keeper')
    const consented = new Set((d.prepare('SELECT member_id FROM cluster_consents WHERE cluster_id = ? AND quarter = ?')
      .all(o.cluster_id, o.quarter) as { member_id: string }[]).map(r => r.member_id))
    const waiting = membersOf(o.cluster_id).filter(m => !consented.has(m)).length
    return { ...o, keepers, waiting }
  })
}

/**
 * Fold a cluster: the keeper who reached Enchant, standing in `quarter` with their own plot.
 * A cluster of one is a fold held open — canon: "a cluster starts at two"; the ground shows it
 * only once a second keeper is in (`isCluster`), so this row alone changes nothing on screen.
 */
export function foldCluster(user_id: string, quarter: Quarter, hasEnchant: boolean, seed: number, tier: number): Result<ClusterView> {
  if (!hasEnchant) return fail('Folding a cluster takes Enchant')
  if (!isQuarter(quarter)) return fail('No such quarter')
  if (memberRow(user_id)) return fail('You already stand in a cluster')
  const d = accountsDb()
  const id = `c_${randomBytes(9).toString('hex')}`
  const now = Date.now()
  d.prepare('INSERT INTO clusters (cluster_id, folded_by, created_at) VALUES (?, ?, ?)').run(id, user_id, now)
  d.prepare('INSERT INTO cluster_members (cluster_id, quarter, user_id, seed, tier, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, quarter, user_id, seed | 0, tier | 0, now)
  return { ok: true, value: viewOf(id)! }
}

/** Offer an open quarter to a friend. Any member may offer; the offerer's own yes is counted. */
export function offerQuarter(user_id: string, username: string, quarter: Quarter): Result<ClusterView> {
  const me = memberRow(user_id)
  if (!me) return fail('You do not stand in a cluster')
  if (!isQuarter(quarter)) return fail('No such quarter')
  const target = getAccountByUsername(username)
  if (!target) return fail('No player by that name')
  if (target.user_id === user_id) return fail('You are already in')
  if (!areFriends(user_id, target.user_id)) return fail('Only a friend can be offered a corner')
  if (memberRow(target.user_id)) return fail('They already stand in a cluster')
  const d = accountsDb()
  if (d.prepare('SELECT 1 FROM cluster_members WHERE cluster_id = ? AND quarter = ?').get(me.cluster_id, quarter)) return fail('That quarter is somebody\'s')
  if (d.prepare('SELECT 1 FROM cluster_offers WHERE cluster_id = ? AND quarter = ?').get(me.cluster_id, quarter)) return fail('That quarter is already offered')
  d.prepare('INSERT INTO cluster_offers (cluster_id, quarter, invitee_id, proposed_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(me.cluster_id, quarter, target.user_id, user_id, Date.now())
  d.prepare('INSERT OR IGNORE INTO cluster_consents (cluster_id, quarter, member_id) VALUES (?, ?, ?)').run(me.cluster_id, quarter, user_id)
  return { ok: true, value: viewOf(me.cluster_id)! }
}

/** A current member says yes to an offer. */
export function consentOffer(user_id: string, quarter: Quarter): Result<ClusterView> {
  const me = memberRow(user_id)
  if (!me) return fail('You do not stand in a cluster')
  const d = accountsDb()
  if (!d.prepare('SELECT 1 FROM cluster_offers WHERE cluster_id = ? AND quarter = ?').get(me.cluster_id, quarter)) return fail('No such offer')
  d.prepare('INSERT OR IGNORE INTO cluster_consents (cluster_id, quarter, member_id) VALUES (?, ?, ?)').run(me.cluster_id, quarter, user_id)
  return { ok: true, value: viewOf(me.cluster_id)! }
}

/** Withdraw an offer — any current member can, because any one of them could have said no. */
export function withdrawOffer(user_id: string, quarter: Quarter): Result<ClusterView> {
  const me = memberRow(user_id)
  if (!me) return fail('You do not stand in a cluster')
  dropOffer(me.cluster_id, quarter)
  return { ok: true, value: viewOf(me.cluster_id)! }
}

function dropOffer(cluster_id: string, quarter: string): void {
  const d = accountsDb()
  d.prepare('DELETE FROM cluster_offers WHERE cluster_id = ? AND quarter = ?').run(cluster_id, quarter)
  d.prepare('DELETE FROM cluster_consents WHERE cluster_id = ? AND quarter = ?').run(cluster_id, quarter)
}

/**
 * The invitee answers. `yes` fills the quarter only if EVERY current member has consented —
 * checked now, against who is in now. Otherwise the offer stands and the answer says who is left.
 */
export function answerOffer(user_id: string, cluster_id: string, quarter: Quarter, yes: boolean, seed: number, tier: number): Result<ClusterView | null> {
  const d = accountsDb()
  const o = d.prepare('SELECT invitee_id FROM cluster_offers WHERE cluster_id = ? AND quarter = ?').get(cluster_id, quarter) as { invitee_id: string } | undefined
  if (!o || o.invitee_id !== user_id) return fail('No such offer for you')
  if (!yes) { dropOffer(cluster_id, quarter); return { ok: true, value: null } }
  if (memberRow(user_id)) return fail('You already stand in a cluster')
  const consented = new Set((d.prepare('SELECT member_id FROM cluster_consents WHERE cluster_id = ? AND quarter = ?')
    .all(cluster_id, quarter) as { member_id: string }[]).map(r => r.member_id))
  const waiting = membersOf(cluster_id).filter(m => !consented.has(m))
  if (waiting.length) return fail(`Waiting on ${waiting.length} more yes`)
  d.prepare('INSERT INTO cluster_members (cluster_id, quarter, user_id, seed, tier, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(cluster_id, quarter, user_id, seed | 0, tier | 0, Date.now())
  dropOffer(cluster_id, quarter)
  return { ok: true, value: viewOf(cluster_id) }
}

/** A member reports their own plot's seed and tier — the only facts the ground needs of them. */
export function reportFold(user_id: string, seed: number, tier: number): boolean {
  const res = accountsDb().prepare('UPDATE cluster_members SET seed = ?, tier = ? WHERE user_id = ?').run(seed | 0, tier | 0, user_id)
  return Number(res.changes) > 0
}

/**
 * ★ THE ONLY EXIT, AND IT IS YOURS: take back your own corner (canon amendment (5)). The Green
 * shrinks by it, the seam holds for the rest, nobody else's row is touched. Whether the reopened
 * slot is offered again is the remaining members' business. The world never unfolds a cluster —
 * but a cluster with nobody left in it is nothing, so the empty record goes.
 */
export function takeBackCorner(user_id: string): Result {
  const me = memberRow(user_id)
  if (!me) return fail('You do not stand in a cluster')
  const d = accountsDb()
  d.prepare('DELETE FROM cluster_members WHERE user_id = ?').run(user_id)
  // The picture of your garden leaves with you: nobody who stays can look at it any more.
  d.prepare('DELETE FROM cluster_plots WHERE user_id = ?').run(user_id)
  d.prepare('DELETE FROM cluster_consents WHERE cluster_id = ? AND member_id = ?').run(me.cluster_id, user_id)
  d.prepare('DELETE FROM cluster_offers WHERE cluster_id = ? AND proposed_by = ?').run(me.cluster_id, user_id)
  if (membersOf(me.cluster_id).length === 0) {
    d.prepare('DELETE FROM cluster_offers WHERE cluster_id = ?').run(me.cluster_id)
    d.prepare('DELETE FROM cluster_consents WHERE cluster_id = ?').run(me.cluster_id)
    d.prepare('DELETE FROM clusters WHERE cluster_id = ?').run(me.cluster_id)
  }
  return { ok: true, value: true }
}

// ── Plot snapshots (phase 3): what a mate's quarter shows you ──────────────────────────────────
// Offline first (Alex, 09-23): each keeper's browser is the only place their garden is written.
// A snapshot is the last picture of it their own client uploaded, and it exists for exactly one
// reader — the other members of the cluster they stand in. So:
//   · only a CURRENT member can put one (a keeper outside a cluster uploads nothing, anywhere);
//   · only their CURRENT cluster-mates get it back — a keeper who took back their corner, or was
//     never in, reads nothing, and the owner's own row is not returned to them as a "mate";
//   · it goes with the corner (`takeBackCorner`) and with the account (`deleteAccount`).
// The store is opaque text here; what a snapshot IS, and checking it, is `shimmer/voxel/plot-snapshot.ts`.

/** Which quarter this keeper stands in, or null. The client needs it to frame the cluster. */
export function myQuarter(user_id: string): Quarter | null {
  return memberRow(user_id)?.quarter ?? null
}

/** Store the keeper's own snapshot. Refused outside a cluster. */
export function putPlotSnapshot(user_id: string, data: string): Result {
  if (!memberRow(user_id)) return fail('You do not stand in a cluster')
  accountsDb().prepare(
    'INSERT INTO cluster_plots (user_id, data, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
  ).run(user_id, data, Date.now())
  return { ok: true, value: true }
}

/** Every OTHER member's snapshot, by quarter. Empty outside a cluster. */
export function matePlotSnapshots(user_id: string): Partial<Record<Quarter, { data: string; updated_at: number }>> {
  const me = memberRow(user_id)
  if (!me) return {}
  const rows = accountsDb().prepare(`
    SELECT m.quarter, p.data, p.updated_at FROM cluster_members m
    JOIN cluster_plots p ON p.user_id = m.user_id
    WHERE m.cluster_id = ? AND m.user_id != ?
  `).all(me.cluster_id, user_id) as { quarter: Quarter; data: string; updated_at: number }[]
  const out: Partial<Record<Quarter, { data: string; updated_at: number }>> = {}
  for (const r of rows) out[r.quarter] = { data: r.data, updated_at: r.updated_at }
  return out
}
