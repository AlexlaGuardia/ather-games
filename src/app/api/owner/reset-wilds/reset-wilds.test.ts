// M180 oracle: run `npx tsx src/app/api/owner/reset-wilds/reset-wilds.test.ts`
// The pure reset (lib/accounts/reset-wilds.ts) + the REAL owner route + the REAL save route on a scratch sqlite: owner only,
// only the named keeper, only the Wilds keys, and an open page cannot write the old Wilds back (stale CAS -> adopt on boot).
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { NextRequest } from 'next/server'
import { signJwt, SESSION_COOKIE, SESSION_TTL_SEC } from '@/lib/accounts/session'
import { _openAt, getOpenSave, casOpenSave, upsertGoogleAccount, claimUsername } from '@/lib/accounts/db'
import { resetWildsDoc, WILDS_KEYS } from '@/lib/accounts/reset-wilds'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
import { decideBoot, contentHash, type OpenDoc } from '@/lib/open-cloud-core'
import { proxy } from '@/proxy'
import * as route from './route'
import * as saveRoute from '../../saves/open/route'
import { _resetSaveRateLimit } from '@/lib/accounts/save-guards'

process.env.ATHER_SESSION_SECRET = 'test-secret-not-the-real-one'
process.env.OWNER_KEY = 'owner-test-key'
delete process.env.ATHER_SITE_ORIGIN
delete process.env.ATHER_GOOGLE_REDIRECT_URI

let failures = 0, passes = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passes++; return }
  failures++
  console.log(`  FAIL  ${label}${detail ? ` - ${detail}` : ''}`)
}

// ── the pure reset ───────────────────────────────────────────────────────────────────────────────────────────────────
const WILDS = {
  'ather.nodes.v2': '{"v":2,"epoch":1,"at":5,"clean":["n1","n2"]}',
  'ather.nodes.skew': '86400000',
  'ather.spreadmap.v1': '{"v":1,"seen":{"a":1},"first":true,"grey":{"a":2},"rule":{"seed":9,"day":3,"since":1}}',
  'ather.infection.v1': '{"v":1,"season":4,"next":null,"active":{"id":"s1","at":1,"online":0,"clue":1,"sent":[]},"saved":[],"lost":["s2"],"told":1,"assigned":1}',
  'ather.infection-told.v1': '{"v":1,"season":4,"said":["x"],"clueOf":{},"met":[],"heard":[1],"open":true}',
}
const KEEP = {
  'ather.fog.v2': 'FOG-bytes', 'ather.waymarks.v1': '[{"x":1}]', 'ather.garden.v1': 'GARDEN', 'open.tutorial.v1': '{"m70":"down"}',
  'ather.grimoire.v1': 'G', 'ather.spiritParty.v1': '["p"]', 'open.bank.v1': 'B',
}
const keeperKeys = { 'open.inv.v1': 'BAG-bytes', 'open.loadout.v1': 'L' }
function mkdoc(uid: string, garden: Record<string, string> = { ...KEEP, ...WILDS }) {
  const keepers = [{ id: 'k1', created_at: 1, keys: { ...keeperKeys } }, { id: 'k2', created_at: 2, keys: { 'open.inv.v1': 'K2' } }]
  return { v: 1, _owner: uid, _epoch: 2, garden: { keys: garden }, keepers, active: 'k1', retired: [] as unknown[] }
}
{
  const d = mkdoc('u_x'), before = JSON.stringify(d)
  const r = resetWildsDoc(d)
  check('pure: every Wilds key named is a real garden key (synced)', WILDS_KEYS.every(k => GARDEN_KEY_SPECS.some(s => s.base === k)))
  check('pure: all five Wilds keys go', WILDS_KEYS.every(k => !(k in (r.doc.garden.keys as Record<string, string>))), JSON.stringify(r.doc.garden.keys))
  check('pure: removed lists them, sorted', JSON.stringify(r.removed) === JSON.stringify([...WILDS_KEYS].sort()), JSON.stringify(r.removed))
  check('pure: every other garden key is byte-identical', JSON.stringify(r.doc.garden.keys) === JSON.stringify(KEEP))
  check('pure: keepers, active, retired, epoch, owner untouched', JSON.stringify({ ...r.doc, garden: 0 }) === JSON.stringify({ ...d, garden: 0 }))
  check('pure: the input doc is not mutated', JSON.stringify(d) === before)
  const again = resetWildsDoc(r.doc)
  check('pure: a second reset removes nothing and returns the same doc', again.removed.length === 0 && again.doc === r.doc)
  const odd = { v: 1, keepers: [] }
  check('pure: a doc with no garden comes back unchanged', resetWildsDoc(odd).doc === odd)
  const newborn = mkdoc('u_x', { ...KEEP })
  check('pure: the result equals a newborn Wilds (no Wilds key at all) with the rest kept', JSON.stringify(r.doc) === JSON.stringify(newborn))
}

// ── the routes ───────────────────────────────────────────────────────────────────────────────────────────────────────
_openAt(join(tmpdir(), `reset-wilds-test-${process.pid}.sqlite`))
const now = () => Math.floor(Date.now() / 1000)
const tokenFor = (uid: string) => signJwt({ user_id: uid, username: uid, iat: now(), exp: now() + SESSION_TTL_SEC }, process.env.ATHER_SESSION_SECRET!)
const ownerReq = (body: unknown, owner: string | null = 'owner-test-key', origin = 'https://ather.games') => {
  const h: Record<string, string> = { 'content-type': 'application/json', host: 'ather.games', origin }
  if (owner !== null) h.cookie = `ather_owner=${owner}`
  return route.POST(new NextRequest('http://localhost:3200/api/owner/reset-wilds', { method: 'POST', headers: h, body: JSON.stringify(body) }))
}
const push = (uid: string, base_rev: number, doc: unknown, device = 'dA') => saveRoute.POST(new NextRequest('http://localhost:3200/api/saves/open', {
  method: 'POST', body: JSON.stringify({ base_rev, device, doc }),
  headers: { 'content-type': 'application/json', host: 'ather.games', origin: 'https://ather.games', cookie: `${SESSION_COOKIE}=${tokenFor(uid)}` } }))

async function main() {
  _resetSaveRateLimit()
  const a = upsertGoogleAccount('g-a', null, null), b = upsertGoogleAccount('g-b', null, null)
  claimUsername(a.user_id, 'testwilds_a'); claimUsername(b.user_id, 'testwilds_b')
  check('setup: A saved', casOpenSave(a.user_id, 0, JSON.stringify(mkdoc(a.user_id)), 'dA') === 1)
  check('setup: B saved', casOpenSave(b.user_id, 0, JSON.stringify(mkdoc(b.user_id)), 'dB') === 1)
  const bBefore = getOpenSave(b.user_id)!.data

  // owner only
  for (const [label, cookie] of [['no cookie', null], ['wrong cookie', 'nope']] as const) {
    const r = await ownerReq({ username: 'testwilds_a' }, cookie)
    check(`403 for a non-owner (${label})`, r.status === 403, String(r.status))
  }
  check('A unchanged after the refused calls', getOpenSave(a.user_id)!.rev === 1)
  const px = proxy(new NextRequest('http://localhost:3200/api/owner/reset-wilds', { method: 'POST' }))
  check('the proxy 403s /api/owner/* for a non-owner', px.status === 403, String(px.status))
  const pub = proxy(new NextRequest('http://localhost:3200/api/owner'))
  check('the proxy still lets /api/owner (the public probe) through', pub.status === 200 && !pub.headers.get('location'), String(pub.status))
  check('cross-site refused', (await ownerReq({ username: 'testwilds_a' }, 'owner-test-key', 'https://evil.example')).status === 403)
  check('unknown name = 404', (await ownerReq({ username: 'nobody_here' })).status === 404)
  check('no name = 400', (await ownerReq({})).status === 400)

  // dry run writes nothing
  const dry = await ownerReq({ username: 'testwilds_a', dry: true }), dj = await dry.json()
  check('dry run lists the five keys', dry.status === 200 && dj.removed.length === 5 && dj.dry === true, JSON.stringify(dj))
  check('dry run wrote nothing', getOpenSave(a.user_id)!.rev === 1)

  // the reset, with A's page OPEN on device dA holding rev 1 and the lease
  const res = await ownerReq({ username: 'TestWilds_A' }), rj = await res.json()
  const row = getOpenSave(a.user_id)!, doc = JSON.parse(row.data)
  check('reset: 200, rev bumped to 2', res.status === 200 && rj.rev === 2 && row.rev === 2, JSON.stringify(rj))
  check('reset: Wilds keys gone', WILDS_KEYS.every(k => !(k in doc.garden.keys)))
  check('reset: fog, waymarks, garden, tutorial byte-identical', JSON.stringify(doc.garden.keys) === JSON.stringify(KEEP))
  check('reset: the bag (keeper keys) byte-identical', JSON.stringify(doc.keepers) === JSON.stringify(mkdoc(a.user_id).keepers))
  check('reset: the lease is left with the open page', row.lease_device === 'dA')
  check('reset: B (not named) untouched', getOpenSave(b.user_id)!.data === bBefore && getOpenSave(b.user_id)!.rev === 1)

  // the open page now pushes its OLD state (a tick or the pagehide beacon), from rev 1: refused, nothing written back
  const old = mkdoc(a.user_id); old.garden.keys['ather.fog.v2'] = 'FOG-moved'
  const wb = await push(a.user_id, 1, old), wbj = await wb.json()
  check('write-back: the open page\'s push is refused stale', wb.status === 409 && wbj.reason === 'stale', `${wb.status} ${JSON.stringify(wbj).slice(0, 80)}`)
  check('write-back: the server still holds the reset', getOpenSave(a.user_id)!.rev === 2 && !('ather.nodes.v2' in JSON.parse(getOpenSave(a.user_id)!.data).garden.keys))
  // that page's next boot: local = its old doc, rec = what it last agreed (rev 1)
  const server = { doc: JSON.parse(getOpenSave(a.user_id)!.data) as OpenDoc, rev: 2 }
  const oldDoc = mkdoc(a.user_id) as unknown as OpenDoc
  const unmoved = decideBoot(oldDoc, { rev: 1, hash: contentHash(oldDoc) }, server, 2)
  check('next boot, page had not moved: adopt the reset', unmoved.do === 'adopt' && !unmoved.backup, JSON.stringify(unmoved))
  const moved = decideBoot(old as unknown as OpenDoc, { rev: 1, hash: contentHash(oldDoc) }, server, 2)
  check('next boot, page had moved too: adopt the reset, backing local up', moved.do === 'adopt' && moved.backup, JSON.stringify(moved))

  // a push landing between the route's read and write is not lost: the route re-reads (CAS)
  const race = mkdoc(a.user_id); (race.garden.keys as Record<string, string>)['ather.nodes.v2'] = '{"v":2,"epoch":9,"at":9,"clean":[]}'
  check('setup: a newer push', casOpenSave(a.user_id, 2, JSON.stringify(race), 'dA') === 3)
  const r2 = await (await ownerReq({ username: 'testwilds_a' })).json()
  check('second reset takes the Wilds out of the NEWER doc', r2.rev === 4 && JSON.stringify(r2.removed) === JSON.stringify([...WILDS_KEYS].sort()))
  const r3 = await (await ownerReq({ username: 'testwilds_a' })).json()
  check('a reset with nothing to take writes nothing', r3.removed.length === 0 && getOpenSave(a.user_id)!.rev === 4, JSON.stringify(r3))

  console.log(failures ? `reset-wilds: ${passes} pass, ${failures} FAIL` : `reset-wilds: ${passes} pass, 0 fail`)
  process.exit(failures ? 1 : 0)
}
main()
