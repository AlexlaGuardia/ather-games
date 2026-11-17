// /api/saves/open oracle — run: npx tsx src/app/api/saves/open/open.test.ts
// Drives the REAL handlers on a scratch sqlite (docs/M12-cloud-save.md §7).
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { NextRequest } from 'next/server'
import { signJwt, SESSION_COOKIE, SESSION_TTL_SEC } from '@/lib/accounts/session'
import { _openAt, getSave, putSave, getOpenSave, casOpenSave } from '@/lib/accounts/db'
import * as route from './route'
import * as leaseRoute from './lease/route'
import { _resetSaveRateLimit } from '@/lib/accounts/save-guards'

process.env.ATHER_SESSION_SECRET = 'test-secret-not-the-real-one'
delete process.env.ATHER_SITE_ORIGIN
delete process.env.ATHER_GOOGLE_REDIRECT_URI

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) return
  failures++
  console.log(`  FAIL  ${label}${detail ? ` - ${detail}` : ''}`)
}

_openAt(join(tmpdir(), `open-save-test-${process.pid}.sqlite`))
const now = () => Math.floor(Date.now() / 1000)
const tokenFor = (uid: string) => signJwt({ user_id: uid, username: uid, iat: now(), exp: now() + SESSION_TTL_SEC }, process.env.ATHER_SESSION_SECRET!)
const hdr = (uid: string, origin: string | null = 'https://ather.games') => {
  const h: Record<string, string> = { 'content-type': 'application/json', host: 'ather.games', cookie: `${SESSION_COOKIE}=${tokenFor(uid)}` }
  if (origin !== null) h.origin = origin
  return h
}
const post = (uid: string, body: unknown, origin: string | null = 'https://ather.games') =>
  route.POST(new NextRequest('http://localhost:3200/api/saves/open', { method: 'POST', headers: hdr(uid, origin), body: JSON.stringify(body) }))
const get = (uid: string) => route.GET(new NextRequest('http://localhost:3200/api/saves/open', { headers: hdr(uid) }))
const lease = (uid: string, device: string) =>
  leaseRoute.POST(new NextRequest('http://localhost:3200/api/saves/open/lease', { method: 'POST', headers: hdr(uid), body: JSON.stringify({ device }) }))

const keeper = (id: string, extra: Record<string, string> = {}) => ({ id, created_at: 1, keys: { 'ather:shimmer:loadout': '{}', ...extra }, updated_at: 1 })
const mkdoc = (uid: string, o: Record<string, unknown> = {}) => ({
  v: 1, _owner: uid, _epoch: 2,
  garden: { keys: { 'ather.garden.v1': 'g' }, updated_at: 1 },
  keepers: [keeper('k1')], active: 'k1', retired: [], ...o,
})
const push = (uid: string, base_rev: number, doc: unknown, device = 'dA') => post(uid, { base_rev, device, doc })

async function main() {
  console.log('/api/saves/open')
  _resetSaveRateLimit()
  putSave('u_a', 'shimmer', JSON.stringify({ keep: 'me' }))
  const shimmerBefore = JSON.stringify(getSave('u_a', 'shimmer'))

  // happy path
  let r = await push('u_a', 0, mkdoc('u_a'))
  check('first push 200 rev 1', r.status === 200 && (await r.json()).rev === 1, `got ${r.status}`)
  r = await get('u_a')
  let j = await r.json()
  check('GET returns doc at rev 1', r.status === 200 && j.rev === 1 && j.doc?.active === 'k1', JSON.stringify(j).slice(0, 80))
  r = await push('u_a', 1, mkdoc('u_a', { garden: { keys: { 'ather.garden.v1': 'g2' }, updated_at: 2 } }))
  check('second push rev 2', r.status === 200 && (await r.json()).rev === 2)
  check('GET after round trip at rev 2', (await (await get('u_a')).json()).doc.garden.keys['ather.garden.v1'] === 'g2')
  r = await get('u_zzz'); j = await r.json()
  check('GET empty = {doc:null, rev:0}', j.doc === null && j.rev === 0)

  // CAS: two writers on the same base_rev
  const before = getOpenSave('u_a')!.data
  r = await push('u_a', 1, mkdoc('u_a', { garden: { keys: { 'ather.garden.v1': 'loser' }, updated_at: 3 } }))
  j = await r.json()
  check('stale base_rev 409 stale', r.status === 409 && j.reason === 'stale' && j.rev === 2 && !!j.doc, `got ${r.status} ${j.reason}`)
  check('stale push changed nothing', getOpenSave('u_a')!.data === before && getOpenSave('u_a')!.rev === 2)
  r = await push('u_a', 0, mkdoc('u_a'))
  check('base_rev 0 against an existing row is stale, not an insert', r.status === 409 && getOpenSave('u_a')!.rev === 2)

  // ownership
  r = await push('u_a', 2, mkdoc('u_other'))
  check('foreign _owner 409', r.status === 409)
  const noOwner: Record<string, unknown> = mkdoc('u_a'); delete noOwner._owner
  r = await push('u_a', 2, noOwner)
  check('missing _owner 409', r.status === 409)

  // validation
  r = await push('u_a', 2, mkdoc('u_a', { garden: { keys: { 'evil.key': 'x' }, updated_at: 1 } }))
  j = await r.json()
  check('unknown garden key 400 naming it', r.status === 400 && String(j.error).includes('evil.key'), `${r.status} ${j.error}`)
  r = await push('u_a', 2, mkdoc('u_a', { keepers: [keeper('k1', { 'not.a.key': 'x' })] }))
  check('unknown keeper key 400', r.status === 400)
  r = await push('u_a', 2, mkdoc('u_a', { v: 2 }))
  check('unknown v 400', r.status === 400)
  r = await push('u_a', 2, mkdoc('u_a', { keepers: Array.from({ length: 9 }, (_, i) => keeper(`k${i}`)), active: 'k0' }))
  check('9 keepers 400', r.status === 400)
  r = await push('u_a', 2, mkdoc('u_a', { keepers: [keeper('k1'), keeper('k1')] }))
  check('duplicate keeper ids 400', r.status === 400)
  r = await push('u_a', 2, mkdoc('u_a', { active: 'nobody' }))
  check('active not in keepers 400', r.status === 400)

  // tombstone
  r = await push('u_a', 2, mkdoc('u_a', { keepers: [keeper('k2')], active: 'k2' }))
  j = await r.json()
  check('keeper dropped without tombstone 400', r.status === 400 && /vanished/.test(j.error), `${r.status} ${j.error}`)
  // the client sends retired_at: 5 (1970) and NO keys: the server must stamp its own time and keep k1's last keys
  r = await push('u_a', 2, mkdoc('u_a', { keepers: [keeper('k2')], active: 'k2', retired: [{ id: 'k1', retired_at: 5 }] }))
  check('keeper dropped WITH tombstone accepted', r.status === 200, `got ${r.status}`)
  {
    const t = (JSON.parse(getOpenSave('u_a')!.data).retired ?? [])[0] ?? {}
    check('★ tombstone retired_at is the SERVER clock, not the client\'s backdated 5', typeof t.retired_at === 'number' && Date.now() - t.retired_at < 60_000, String(t.retired_at))
    check('★ tombstone keeps the keeper\'s last keys from the server copy', t.keys?.['ather:shimmer:loadout'] === '{}', JSON.stringify(t.keys))
  }
  const K1 = [{ id: 'k1' }]   // later pushes must carry the young tombstone
  r = await push('u_a', 3, mkdoc('u_a', { keepers: [keeper('k2')], active: 'k2', retired: [] }))
  j = await r.json()
  check('★ dropping a tombstone younger than 30 days is 400', r.status === 400 && /tombstone/.test(j.error), `${r.status} ${j.error}`)
  r = await push('u_a', 3, mkdoc('u_a', { keepers: [keeper('k2')], active: 'k2', retired: [{ id: 'k1', retired_at: 1 }] }))
  check('carrying it (any client retired_at) is fine', r.status === 200, `got ${r.status}`)
  {
    const t = JSON.parse(getOpenSave('u_a')!.data).retired[0]
    check('★ ...and the original server retired_at survives the client\'s new one', Date.now() - t.retired_at < 60_000, String(t.retired_at))
  }

  // epoch
  r = await push('u_a', 4, mkdoc('u_a', { _epoch: 1, keepers: [keeper('k2')], active: 'k2', retired: K1 }))
  j = await r.json()
  check('older epoch 409', r.status === 409 && j.reason === 'epoch', `${r.status} ${j.reason}`)

  // lease
  r = await lease('u_a', 'dB')
  j = await r.json()
  check('lease route takes lease, returns doc+rev', r.status === 200 && j.rev === 4 && j.lease.device === 'dB')
  r = await push('u_a', 4, mkdoc('u_a', { keepers: [keeper('k2')], active: 'k2', retired: K1 }), 'dA')
  j = await r.json()
  check('lease held by another device 409', r.status === 409 && j.reason === 'lease', `${r.status} ${j.reason}`)
  r = await push('u_a', 4, mkdoc('u_a', { keepers: [keeper('k2')], active: 'k2', retired: K1 }), 'dB')
  check('lease holder pushes OK', r.status === 200, `got ${r.status}`)

  // expiry: a tombstone older than 30 days is pruned by the server even if the client still sends it.
  // Age it in the stored row directly (the only way to get a past retired_at, which is the point).
  {
    const row = getOpenSave('u_a')!
    const d = JSON.parse(row.data); d.retired[0].retired_at = Date.now() - 31 * 24 * 3600 * 1000
    casOpenSave('u_a', row.rev, JSON.stringify(d), 'dB')
    r = await push('u_a', row.rev + 1, mkdoc('u_a', { keepers: [keeper('k2')], active: 'k2', retired: K1 }), 'dB')
    check('push after expiry OK', r.status === 200, `got ${r.status}`)
    check('★ a 31-day-old tombstone is pruned', JSON.parse(getOpenSave('u_a')!.data).retired.length === 0)
  }

  // sizes
  const padTo = (bytes: number) => {
    const d = mkdoc('u_b', { garden: { keys: { 'ather.garden.v1': '' }, updated_at: 1 } }) as any
    const over = bytes - Buffer.byteLength(JSON.stringify(d))
    return { d, over }
  }
  // 1 MB + 1 across sections that each stay under 256 KB: use 5 keepers + garden
  const big = mkdoc('u_b', { keepers: Array.from({ length: 5 }, (_, i) => keeper(`k${i}`, { 'ather:shimmer:book': 'x'.repeat(200 * 1024) })), active: 'k0' }) as any
  let sz = Buffer.byteLength(JSON.stringify(big))
  big.garden.keys['ather.fog.v2'] = 'x'.repeat(Math.max(0, 1024 * 1024 + 1 - sz - 40))
  sz = Buffer.byteLength(JSON.stringify(big))
  const fix = 1024 * 1024 + 1 - sz
  big.garden.keys['ather.fog.v2'] += fix >= 0 ? 'x'.repeat(fix) : ''
  if (fix < 0) big.garden.keys['ather.fog.v2'] = big.garden.keys['ather.fog.v2'].slice(0, fix)
  check('test doc is exactly 1 MB + 1 byte (fixture sanity)', Buffer.byteLength(JSON.stringify(big)) === 1024 * 1024 + 1, String(Buffer.byteLength(JSON.stringify(big))))
  r = await push('u_b', 0, big)
  check('1 MB + 1 byte 413', r.status === 413, `got ${r.status}`)
  r = await push('u_b', 0, mkdoc('u_b', { keepers: [keeper('k1', { 'ather:shimmer:book': 'x'.repeat(257 * 1024) })] }))
  check('one section over 256 KB 413', r.status === 413, `got ${r.status}`)
  void padTo

  // Origin / auth
  r = await post('u_b', { base_rev: 0, device: 'dA', doc: mkdoc('u_b') }, 'https://evil.example')
  check('Origin mismatch 403', r.status === 403)
  r = await route.POST(new NextRequest('http://localhost:3200/api/saves/open', { method: 'POST', headers: { 'content-type': 'application/json', host: 'ather.games' }, body: '{}' }))
  check('no session 401', r.status === 401)
  check('nothing written for u_b by rejected pushes', getOpenSave('u_b') === null)

  // the old route's row is untouched
  check("old 'shimmer' row untouched by all of this", JSON.stringify(getSave('u_a', 'shimmer')) === shimmerBefore)
  check("open row not readable through getSave('shimmer')", getSave('u_b', 'shimmer') === null)

  console.log(failures === 0 ? 'open save: all checks passed' : `open save: ${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main()
