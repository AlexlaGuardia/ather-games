import { NextResponse, type NextRequest } from 'next/server'
import { getAccountByUsername, getOpenSave, casOpenSave } from '@/lib/accounts/db'
import { sameOriginPost } from '@/lib/accounts/save-guards'
import { resetWildsDoc } from '@/lib/accounts/reset-wilds'

// OWNER-ONLY (BETA M180): reset the Wilds of the keeper the owner NAMES (an account username) to a newborn's. Never anyone else.
// The pure rule (what the Wilds is, what a newborn holds) is lib/accounts/reset-wilds.ts.
//
// ★ NO WRITE-BACK FROM AN OPEN PAGE (the M12 save rules, docs/M12-cloud-save.md §4): the reset is a compare-and-swap like any
//   push, so it bumps the save's rev. A page that was open keeps the old rev: its next push or pagehide beacon is refused 'stale'
//   and it stops syncing ("Playing on another device"); its next boot sees the server moved and ADOPTS the reset (backing its own
//   copy up first when it had moved too). The lease is left where it was (device null), so the reset never takes the save over.
// Body: { username, dry?: true }. dry = say what would go, write nothing (the panel's confirm step).

const NOSTORE = { 'cache-control': 'no-store' }
const err = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NOSTORE })
const isOwner = (req: NextRequest) => {
  const c = req.cookies.get('ather_owner')?.value
  return !!c && !!process.env.OWNER_KEY && c === process.env.OWNER_KEY
}

export async function POST(req: NextRequest) {
  if (!isOwner(req)) return err('Owner only', 403)          // the proxy gates /api/owner/ too; this holds without it
  if (!sameOriginPost(req)) return err('Cross-site request refused', 403)
  let body: Record<string, unknown>
  try { const b = await req.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw 0; body = b } catch { return err('Body must be JSON', 400) }
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (!username) return err('Name a keeper', 400)
  const acct = getAccountByUsername(username)
  if (!acct) return err('No keeper by that name', 404)
  for (let tries = 0; tries < 3; tries++) {
    const row = getOpenSave(acct.user_id)
    if (!row) return NextResponse.json({ ok: true, username: acct.username, user_id: acct.user_id, removed: [], rev: 0, dry: !!body.dry }, { headers: NOSTORE })
    let doc: Record<string, unknown>
    try { doc = JSON.parse(row.data) } catch { return err('That save does not read', 500) }
    const r = resetWildsDoc(doc)
    if (body.dry === true || !r.removed.length) return NextResponse.json({ ok: true, username: acct.username, user_id: acct.user_id, removed: r.removed, rev: row.rev, dry: body.dry === true }, { headers: NOSTORE })
    const rev = casOpenSave(acct.user_id, row.rev, JSON.stringify(r.doc), null)
    if (rev !== null) return NextResponse.json({ ok: true, username: acct.username, user_id: acct.user_id, removed: r.removed, rev, dry: false }, { headers: NOSTORE })
    // a push landed between the read and the write: read again and take the keys out of THAT doc
  }
  return err('The save kept moving; try again', 409)
}
