// /api/saves hardening oracle — run: npx tsx src/app/api/saves/saves.test.ts
//
// Drives the REAL route handlers against a scratch sqlite file (serb, 2026-11-17, docs/M12-cloud-save.md §8).
// Three guards, each one a claim the old route did not make:
//   1. the size cap counts BYTES, not UTF-16 units (a 512 KB cap that admits ~1.5 MB of non-ASCII is not a cap);
//   2. a cross-site POST is refused by Origin, explicitly, instead of relying on SameSite=Lax as a side effect;
//   3. one account cannot churn the table: pushes are rate-limited per user, loosely enough that real play
//      (8 s debounce + a pagehide beacon, per game) never meets it.
// Plus the contract that must NOT move: same-origin and Origin-less pushes still save, #682's foreign-owner 409 holds.

import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { NextRequest } from 'next/server'
import { signJwt, SESSION_COOKIE, SESSION_TTL_SEC } from '@/lib/accounts/session'
import { _openAt, getSave } from '@/lib/accounts/db'
import * as route from './route'
import { _resetSaveRateLimit } from '@/lib/accounts/save-guards'

// the secret is read at call time (session.ts), so setting it here, before any call, is enough

process.env.ATHER_SESSION_SECRET = 'test-secret-not-the-real-one'
delete process.env.ATHER_SITE_ORIGIN
delete process.env.ATHER_GOOGLE_REDIRECT_URI


let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) return
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

const dbPath = join(tmpdir(), `saves-test-${process.pid}.sqlite`)
_openAt(dbPath)
const now = () => Math.floor(Date.now() / 1000)
const tokenFor = (uid: string) =>
  signJwt({ user_id: uid, username: uid, iat: now(), exp: now() + SESSION_TTL_SEC }, process.env.ATHER_SESSION_SECRET!)

function post(uid: string, body: unknown, origin: string | null = 'https://ather.games', host = 'ather.games') {
  const headers: Record<string, string> = { 'content-type': 'application/json', host, cookie: `${SESSION_COOKIE}=${tokenFor(uid)}` }
  if (origin !== null) headers.origin = origin
  return route.POST(new NextRequest('http://localhost:3200/api/saves', { method: 'POST', headers, body: JSON.stringify(body) }))
}

async function main() {
console.log('/api/saves hardening')
{
  _resetSaveRateLimit()
  const ok = await post('u_a', { game: 'shimmer', data: JSON.stringify({ a: 1 }) })
  check('same-origin push saves', ok.status === 200, `got ${ok.status}`)
  check('row written', !!getSave('u_a', 'shimmer'))

  const noOrigin = await post('u_a', { game: 'shimmer', data: JSON.stringify({ a: 2 }) }, null)
  check('Origin-less push (non-browser, test scripts) still saves', noOrigin.status === 200, `got ${noOrigin.status}`)

  const devwin = await post('u_a', { game: 'shimmer', data: JSON.stringify({ a: 3 }) }, 'https://world.example.dev', 'world.example.dev')
  check('a devwin POSTing to itself is same-origin and saves', devwin.status === 200, `got ${devwin.status}`)

  // prod through the tunnel: Host may arrive as the tunnel target, the configured public origin must still pass
  process.env.ATHER_GOOGLE_REDIRECT_URI = 'https://ather.games/api/auth/callback'
  const tunnel = await post('u_a', { game: 'shimmer', data: JSON.stringify({ a: 4 }) }, 'https://ather.games', 'localhost:3200')
  check('★ prod behind the tunnel (Host=localhost:3200, Origin=public site) saves', tunnel.status === 200, `got ${tunnel.status}`)
  const tunnelEvil = await post('u_a', { game: 'shimmer', data: JSON.stringify({ pwned: 3 }) }, 'https://evil.example', 'localhost:3200')
  check('★ ...and cross-site behind the tunnel is still refused', tunnelEvil.status === 403, `got ${tunnelEvil.status}`)
  delete process.env.ATHER_GOOGLE_REDIRECT_URI

  // ── 2. cross-site ──
  const evil = await post('u_a', { game: 'shimmer', data: JSON.stringify({ pwned: true }) }, 'https://evil.example')
  check('★ cross-site Origin is refused with 403', evil.status === 403, `got ${evil.status}`)
  check('★ and nothing was written', !getSave('u_a', 'shimmer')!.data.includes('pwned'))
  const nul = await post('u_a', { game: 'shimmer', data: JSON.stringify({ pwned: 2 }) }, 'null')
  check('★ Origin "null" (sandboxed frame) is refused', nul.status === 403, `got ${nul.status}`)

  // ── 1. bytes, not code units ──
  // 200k three-byte chars = 600 KB on the wire but only 200k UTF-16 units: the old check let it through.
  const fat = JSON.stringify({ s: '€'.repeat(200_000) })
  const big = await post('u_b', { game: 'shimmer', data: fat })
  check('★ 600 KB of non-ASCII is over the 512 KB cap (413)', big.status === 413, `got ${big.status}`)
  const fine = await post('u_b', { game: 'shimmer', data: JSON.stringify({ s: '€'.repeat(100_000) }) })
  check('300 KB of non-ASCII still fits', fine.status === 200, `got ${fine.status}`)

  // #682 contract unchanged
  const foreign = await post('u_b', { game: 'shimmer', data: JSON.stringify({ _owner: 'u_a' }) })
  check('foreign _owner still 409 (#682)', foreign.status === 409, `got ${foreign.status}`)

  // ── 3. rate limit ──
  _resetSaveRateLimit()
  const statuses: number[] = []
  for (let i = 0; i < 31; i++) statuses.push((await post('u_c', { game: 'wallet', data: JSON.stringify({ i }) })).status)
  check('30 pushes in a minute all save (real play is ~8/min/game)', statuses.slice(0, 30).every(s => s === 200), statuses.join(','))
  check('★ the 31st inside the window is 429', statuses[30] === 429, `got ${statuses[30]}`)
  const other = await post('u_d', { game: 'wallet', data: JSON.stringify({ x: 1 }) })
  check('the limit is per account: another user is unaffected', other.status === 200, `got ${other.status}`)
}

try { unlinkSync(dbPath) } catch { /* fine */ }
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
}
void main()
