// Accounts oracle — run: npx tsx src/lib/accounts/accounts.test.ts
//
// Two things here are worth guarding, and they are not the CRUD.
//
// 1. The session token is the ONLY thing standing between "signed in as Alex" and "claims to
//    be Alex" — and the WS server will trust it across a process boundary. So the asserts
//    lean on the ways a hand-rolled JWT classically breaks: a tampered payload, a swapped
//    signature, an expired token, and alg-confusion (a token that declares alg:none and
//    dares the verifier to believe it).
// 2. Username uniqueness is case-insensitive, which is a claim about the DB collation, not
//    about our code — so it gets asserted against a real sqlite file, not a mock.

import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { signJwt, verifyJwt, SESSION_TTL_SEC } from './session'
import { _openAt, upsertGoogleAccount, claimUsername, checkUsername, getAccountByUsername, getAccount, newUserId } from './db'
import { safeReturnPath } from './oauth'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) return
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

const SECRET = 'test-secret-not-the-real-one'
const now = () => Math.floor(Date.now() / 1000)

// ── session tokens ────────────────────────────────────────────────────────────
console.log('session tokens')
{
  const token = signJwt({ user_id: 'u_abc', username: 'kael', iat: now(), exp: now() + SESSION_TTL_SEC }, SECRET)
  const claims = verifyJwt(token, SECRET)
  check('roundtrip returns the payload', claims?.user_id === 'u_abc' && claims?.username === 'kael')

  check('wrong secret is rejected', verifyJwt(token, 'other-secret') === null)
  check('garbage is rejected', verifyJwt('not.a.jwt', SECRET) === null)
  check('empty is rejected', verifyJwt('', SECRET) === null)
  check('missing secret is rejected', verifyJwt(token, '') === null)

  // Tamper: re-encode the payload as a different user, keep the original signature.
  const [head, , sig] = token.split('.')
  const forgedBody = Buffer.from(JSON.stringify({ user_id: 'u_victim', username: 'alex', exp: now() + 999 })).toString('base64url')
  check('tampered payload is rejected', verifyJwt(`${head}.${forgedBody}.${sig}`, SECRET) === null)

  // alg-confusion: an unsigned token that declares alg:none. The classic hand-rolled-JWT hole.
  const noneHead = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  check('alg:none is rejected', verifyJwt(`${noneHead}.${forgedBody}.`, SECRET) === null)

  // A token signed correctly but claiming HS512 in its header — we only ever accept HS256.
  const hs512 = signJwt({ user_id: 'u_x', exp: now() + 100 }, SECRET)
  const [, b512, s512] = hs512.split('.')
  const badAlgHead = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT' })).toString('base64url')
  check('mismatched alg header is rejected', verifyJwt(`${badAlgHead}.${b512}.${s512}`, SECRET) === null)

  const expired = signJwt({ user_id: 'u_abc', exp: now() - 1 }, SECRET)
  check('expired token is rejected', verifyJwt(expired, SECRET) === null)
  const noExp = signJwt({ user_id: 'u_abc' }, SECRET)
  check('token without exp is rejected', verifyJwt(noExp, SECRET) === null)
}

// ── open-redirect guard ───────────────────────────────────────────────────────
console.log('return-path guard')
{
  check('keeps a site-relative path', safeReturnPath('/arcade') === '/arcade')
  check('rejects absolute url', safeReturnPath('https://evil.example/x') === '/shimmer/play3d')
  check('rejects protocol-relative', safeReturnPath('//evil.example') === '/shimmer/play3d')
  check('rejects empty/null', safeReturnPath(null) === '/shimmer/play3d' && safeReturnPath('') === '/shimmer/play3d')
}

// ── accounts + usernames (real sqlite) ────────────────────────────────────────
console.log('accounts store')
{
  const path = join(tmpdir(), `ather-accounts-oracle-${process.pid}.db`)
  try { unlinkSync(path) } catch { /* first run */ }
  _openAt(path)

  const a = upsertGoogleAccount('google-sub-1', 'a@example.com', null)
  check('new login creates an account', a.user_id.startsWith('u_') && a.username === null)

  const again = upsertGoogleAccount('google-sub-1', 'a@example.com', 'pic.png')
  check('same google sub returns the SAME user_id', again.user_id === a.user_id, `${a.user_id} vs ${again.user_id}`)
  check('re-login refreshes the avatar', getAccount(a.user_id)?.avatar === 'pic.png')

  const b = upsertGoogleAccount('google-sub-2', 'b@example.com', null)
  check('a different google sub is a different account', b.user_id !== a.user_id)
  check('ids are unique', newUserId() !== newUserId())

  check('too short is invalid', !checkUsername('ab').available)
  check('too long is invalid', !checkUsername('a'.repeat(17)).available)
  check('punctuation is invalid', !checkUsername('kael!').available)
  check('reserved is refused', !checkUsername('player').available)
  check('reserved is case-insensitive', !checkUsername('Admin').available)
  check('a good name is available', checkUsername('kael_v').available)

  const claim = claimUsername(a.user_id, 'Kael_V', 'alkin')
  check('claim succeeds', claim.ok === true)
  check('claim stores the name as typed', getAccount(a.user_id)?.username === 'Kael_V')
  check('claim stores the character', getAccount(a.user_id)?.character_id === 'alkin')

  check('lookup by name is case-insensitive', getAccountByUsername('kael_v')?.user_id === a.user_id)
  check('a taken name is unavailable to others', !checkUsername('kael_v').available)
  check('a taken name is available to its OWNER', checkUsername('kael_v', a.user_id).available)

  const stolen = claimUsername(b.user_id, 'KAEL_V')
  check('another account cannot claim it in a different case', stolen.ok === false)
  check('the loser keeps no username', getAccount(b.user_id)?.username === null)

  const renamed = claimUsername(a.user_id, 'veyra')
  check('a rename succeeds', renamed.ok === true && getAccount(a.user_id)?.username === 'veyra')
  check('the freed name is claimable', claimUsername(b.user_id, 'kael_v').ok === true)

  check('claiming a reserved name fails', claimUsername(b.user_id, 'system').ok === false)
  check('a failed claim leaves the old name intact', getAccount(b.user_id)?.username === 'kael_v')

  try { unlinkSync(path) } catch { /* leave it */ }
}

console.log(failures === 0 ? '\nPASS — accounts oracle clean' : `\nFAIL — ${failures} assertion(s)`)
process.exit(failures === 0 ? 0 : 1)
