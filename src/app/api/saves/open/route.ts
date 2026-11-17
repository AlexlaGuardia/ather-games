import { NextResponse, type NextRequest } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/accounts/session'
import { getOpenSave, casOpenSave, leaseHeldByOther } from '@/lib/accounts/db'
import { allowSavePush, byteLength, sameOriginPost } from '@/lib/accounts/save-guards'
import { isGardenKey, isKeeperKey } from '@/lib/accounts/open-save-registry'

// The open world's cloud save (docs/M12-cloud-save.md §3-§6). Revisioned, compare-and-swap, one writer (lease).
// The server never merges or parses game values; it checks shape, ownership, names and sizes.

export const MAX_DOC_BYTES = 1024 * 1024
export const MAX_SECTION_BYTES = 256 * 1024
export const MAX_KEEPERS = 8
export const RETIRED_KEEP_MS = 30 * 24 * 60 * 60 * 1000

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const NOSTORE = { 'cache-control': 'no-store' }

function auth(req: NextRequest): string | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)?.user_id ?? null
}
const err = (error: string, status: number, extra: Obj = {}) => NextResponse.json({ error, ...extra }, { status })

export function GET(req: NextRequest) {
  const userId = auth(req)
  if (!userId) return err('Sign in first', 401)
  const row = getOpenSave(userId)
  if (!row) return NextResponse.json({ doc: null, rev: 0 }, { headers: NOSTORE })
  return NextResponse.json(
    { doc: JSON.parse(row.data), rev: row.rev, lease: { device: row.lease_device, at: row.lease_at } },
    { headers: NOSTORE },
  )
}

/** Validate a section's `keys` map against a registry predicate; returns an error string or null. */
function checkSection(name: string, sec: unknown, legal: (k: string) => boolean): string | null {
  if (!isObj(sec) || !isObj(sec.keys)) return `${name} must have a keys object`
  for (const [k, v] of Object.entries(sec.keys)) {
    if (!legal(k)) return `unknown key: ${k}`
    if (typeof v !== 'string') return `key ${k} must be a string`
  }
  if (byteLength(JSON.stringify(sec)) > MAX_SECTION_BYTES) return 'SECTION_TOO_LARGE'
  return null
}

export async function POST(req: NextRequest) {
  if (!sameOriginPost(req)) return err('Cross-site request refused', 403)
  const userId = auth(req)
  if (!userId) return err('Sign in first', 401)
  if (!allowSavePush(userId)) return err('Too many saves, slow down', 429)

  const text = await req.text().catch(() => '')
  if (byteLength(text) > MAX_DOC_BYTES + 4096) return err('Save too large', 413)   // cheap pre-parse bound (envelope slack)
  let body: Obj
  try { const b = JSON.parse(text); if (!isObj(b)) throw 0; body = b } catch { return err('Body must be JSON', 400) }
  const { base_rev, device, doc } = body
  if (!Number.isInteger(base_rev) || (base_rev as number) < 0) return err('base_rev must be a non-negative integer', 400)
  if (typeof device !== 'string' || !device || device.length > 128) return err('device required', 400)
  if (!isObj(doc)) return err('doc must be an object', 400)
  const docText = JSON.stringify(doc)
  if (byteLength(docText) > MAX_DOC_BYTES) return err('Save too large', 413)

  if (doc.v !== 1) return err('Unknown document version', 400)
  if (typeof doc._owner !== 'string' || !doc._owner) return err('_owner required', 409)
  if (doc._owner !== userId) return err('That save belongs to another account', 409)

  const g = checkSection('garden', doc.garden, isGardenKey)
  if (g === 'SECTION_TOO_LARGE') return err('Garden section too large', 413)
  if (g) return err(g, 400)
  if (!Array.isArray(doc.keepers)) return err('keepers must be an array', 400)
  if (doc.keepers.length > MAX_KEEPERS) return err(`at most ${MAX_KEEPERS} keepers`, 400)
  const ids = new Set<string>()
  for (const k of doc.keepers) {
    if (!isObj(k) || typeof k.id !== 'string' || !k.id) return err('keeper needs an id', 400)
    if (ids.has(k.id)) return err(`duplicate keeper id: ${k.id}`, 400)
    ids.add(k.id)
    const e = checkSection(`keeper ${k.id}`, k, isKeeperKey)
    if (e === 'SECTION_TOO_LARGE') return err(`Keeper ${k.id} too large`, 413)
    if (e) return err(e, 400)
  }
  const active = doc.active ?? null
  if (active !== null && (typeof active !== 'string' || !ids.has(active))) return err('active must name a keeper or be null', 400)
  // ── retired keepers: tombstones the SERVER keeps for 30 days (doc §6) ──────────────────────────────────────
  // Each entry is { id, retired_at, keys }. The server, not the client, decides retired_at and when a tombstone may
  // go: a client-chosen timestamp could backdate a keeper straight into the prune, which is deletion by another name.
  const incoming = new Map<string, Obj>()
  if (doc.retired !== undefined) {
    if (!Array.isArray(doc.retired)) return err('retired must be an array', 400)
    for (const r of doc.retired) {
      if (!isObj(r) || typeof r.id !== 'string' || !r.id) return err('retired entry needs an id', 400)
      if (ids.has(r.id)) return err(`keeper ${r.id} is both active and retired`, 400)
      if (r.keys !== undefined) {
        const e = checkSection(`retired ${r.id}`, r, isKeeperKey)
        if (e === 'SECTION_TOO_LARGE') return err(`Retired keeper ${r.id} too large`, 413)
        if (e) return err(e, 400)
      }
      incoming.set(r.id, r)
    }
  }
  const stored = getOpenSave(userId)
  const now = Date.now()
  const tombstones: Obj[] = []
  if (stored) {
    let prev: Obj = {}
    try { const p = JSON.parse(stored.data); if (isObj(p)) prev = p } catch { /* unreadable stored doc: nothing to compare */ }
    const prevKeepers = new Map<string, Obj>()
    if (Array.isArray(prev.keepers)) for (const k of prev.keepers) if (isObj(k) && typeof k.id === 'string') prevKeepers.set(k.id, k)
    const prevRetired = new Map<string, Obj>()
    if (Array.isArray(prev.retired)) for (const r of prev.retired) if (isObj(r) && typeof r.id === 'string') prevRetired.set(r.id, r)
    // a keeper that was live must reappear live or retired
    for (const id of prevKeepers.keys()) {
      if (!ids.has(id) && !incoming.has(id)) return err('keeper vanished', 400, { id })
    }
    // a tombstone younger than 30 days must be carried; older ones are pruned here
    for (const [id, r] of prevRetired) {
      const at = typeof r.retired_at === 'number' ? r.retired_at : 0
      const live = now - at < RETIRED_KEEP_MS
      if (live && !incoming.has(id) && !ids.has(id)) return err('tombstone dropped early', 400, { id })
    }
    for (const [id, r] of incoming) {
      const old = prevRetired.get(id)
      const oldAt = old && typeof old.retired_at === 'number' ? old.retired_at : null
      if (oldAt !== null && now - oldAt >= RETIRED_KEEP_MS) continue          // expired: drop it
      if (!old && !prevKeepers.has(id)) continue                               // never existed here: ignore
      const keys = isObj(r.keys) ? r.keys : isObj(old?.keys) ? old!.keys : isObj(prevKeepers.get(id)?.keys) ? prevKeepers.get(id)!.keys : {}
      tombstones.push({ id, retired_at: oldAt ?? now, keys })
    }
    const prevEpoch = typeof prev._epoch === 'number' ? prev._epoch : 0
    if (typeof doc._epoch !== 'number' || doc._epoch < prevEpoch) return err('epoch', 409, { reason: 'epoch', rev: stored.rev })
    if (leaseHeldByOther(stored, device)) return err('lease', 409, { reason: 'lease', rev: stored.rev })
  } else if (typeof doc._epoch !== 'number') {
    return err('_epoch required', 400)
  }

  // store the server's tombstones, not the client's list; re-measure since tombstone keys may have been restored
  const finalText = JSON.stringify({ ...doc, retired: tombstones })
  if (byteLength(finalText) > MAX_DOC_BYTES) return err('Save too large', 413)
  const rev = casOpenSave(userId, base_rev as number, finalText, device)
  if (rev === null) {
    const cur = getOpenSave(userId)
    return err('stale', 409, { reason: 'stale', rev: cur?.rev ?? 0, doc: cur ? JSON.parse(cur.data) : null })
  }
  return NextResponse.json({ rev })
}
