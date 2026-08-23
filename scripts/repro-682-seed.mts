// Seed an ISOLATED repro DB for the #682 save-isolation tests, using the repo's OWN modules.
// Nothing here re-implements signing or storage — a mirror of the code under test proves nothing.
//
// Run from a checkout whose `data/accounts.db` is NOT production:
//   npx tsx scripts/repro-682-seed.mts
// Writes cookies to $REPRO_TOKENS (default /tmp/ather-repro-tokens.json).
import { upsertGoogleAccount, putSave } from '../src/lib/accounts/db.ts'
import { signJwt, sessionSecret, SESSION_TTL_SEC } from '../src/lib/accounts/session.ts'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const now = Math.floor(Date.now() / 1000)
const mint = (u: { user_id: string; username: string | null }) =>
  signJwt({ user_id: u.user_id, username: u.username, iat: now, exp: now + SESSION_TTL_SEC }, sessionSecret())

const A = upsertGoogleAccount('repro-sub-A', 'accountA@repro.test', null)
const B = upsertGoogleAccount('repro-sub-B', 'accountB@repro.test', null)
// ★ C EXISTS TO HAVE NO CLOUD ROW. Adoption is only reachable when the account has nothing to
// hydrate, so without an account in that state the anonymous-slot branch is never exercised at all.
const C = upsertGoogleAccount('repro-sub-C', 'accountC@repro.test', null)

putSave(A.user_id, 'shimmer', JSON.stringify({ _epoch: 2, whose: 'ACCOUNT_A_WORLD', pos: [10, 70, 10], plot: 'A-garden-marker' }))
putSave(B.user_id, 'shimmer', JSON.stringify({ _epoch: 2, whose: 'ACCOUNT_B_WORLD', pos: [99, 70, 99], plot: 'B-garden-marker' }))

const out = process.env.REPRO_TOKENS ?? '/tmp/ather-repro-tokens.json'
writeFileSync(out, JSON.stringify({
  A: { user_id: A.user_id, cookie: mint(A) },
  B: { user_id: B.user_id, cookie: mint(B) },
  C: { user_id: C.user_id, cookie: mint(C) },
}, null, 1))
console.log(`seeded A=${A.user_id} B=${B.user_id} C=${C.user_id} (C has no cloud row)\ntokens -> ${out}`)
