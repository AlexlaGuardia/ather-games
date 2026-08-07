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
import {
  _openAt, upsertGoogleAccount, claimUsername, checkUsername, getAccountByUsername, getAccount, newUserId,
  getSave, putSave, deleteAccount,
  listFriends, addFriend, acceptFriend, removeFriend, areFriends,
} from './db'
import { safeReturnPath, DEFAULT_RETURN } from './oauth'

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
  // Asserted against DEFAULT_RETURN, not a literal: the landing route moved play3d → voxel3d on
  // 2026-08-07 and three hardcoded copies had to move with it. What this test is actually about is
  // that a hostile `next` is REFUSED, not which page we fall back to.
  check('rejects absolute url', safeReturnPath('https://evil.example/x') === DEFAULT_RETURN)
  check('rejects protocol-relative', safeReturnPath('//evil.example') === DEFAULT_RETURN)
  check('rejects empty/null', safeReturnPath(null) === DEFAULT_RETURN && safeReturnPath('') === DEFAULT_RETURN)
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

// ── friends ───────────────────────────────────────────────────────────────────
// The asserts that matter are the SYMMETRY ones: a friendship is stored as one directed
// row but read as an undirected relationship, so every read has to give both sides the
// same answer. A bug there means A sees a friend that B does not, and the invite gate
// downstream would then admit someone B never agreed to play with.
console.log('friends')
{
  const path = join(tmpdir(), `ather-friends-oracle-${process.pid}.db`)
  try { unlinkSync(path) } catch { /* first run */ }
  _openAt(path)

  const mk = (sub: string, name: string) => {
    const a = upsertGoogleAccount(sub, `${name}@example.com`, null)
    claimUsername(a.user_id, name)
    return a.user_id
  }
  const alex = mk('s-alex', 'serberus')
  const jin = mk('s-jin', 'jin')
  const mag = mk('s-mag', 'magii')

  check('nobody starts with friends', listFriends(alex).length === 0)
  check('unknown username is refused', !addFriend(alex, 'nobody_here').ok)
  check('adding yourself is refused', !addFriend(alex, 'serberus').ok)

  check('request sends', addFriend(alex, 'jin').ok)
  check('duplicate request is refused', !addFriend(alex, 'jin').ok)
  check('sender sees it as OUTGOING', listFriends(alex)[0]?.incoming === false)
  check('target sees it as INCOMING', listFriends(jin)[0]?.incoming === true)
  check('pending is not friendship', !areFriends(alex, jin))
  check('the target cannot be accepted BY the sender', !acceptFriend(alex, jin))

  check('target accepts', acceptFriend(jin, alex))
  check('friendship reads true both ways', areFriends(alex, jin) && areFriends(jin, alex))
  check('both lists show accepted', listFriends(alex)[0]?.status === 'accepted' && listFriends(jin)[0]?.status === 'accepted')
  check('accepted has no direction', listFriends(alex)[0]?.incoming === false && listFriends(jin)[0]?.incoming === false)
  check('already-friends is refused', !addFriend(alex, 'jin').ok)

  // Both people adding each other at once must converge on friendship, not two edges.
  check('mutual add: first direction opens', addFriend(alex, 'magii').ok)
  const crossed = addFriend(mag, 'serberus')
  check('mutual add: second direction ACCEPTS instead of duplicating', crossed.ok && crossed.accepted === true)
  check('mutual add makes them friends', areFriends(alex, mag))
  check('mutual add left exactly one row', listFriends(mag).filter(f => f.user_id === alex).length === 1)

  check('remove works', removeFriend(alex, jin))
  check('remove is symmetric', !areFriends(alex, jin) && !areFriends(jin, alex))
  check('removed friend is gone from BOTH lists', !listFriends(alex).some(f => f.user_id === jin) && !listFriends(jin).some(f => f.user_id === alex))
  check('removing a non-friend is a harmless no-op', removeFriend(alex, jin) === false)
  check('you can re-add after removing', addFriend(alex, 'jin').ok)

  // A nameless account is invisible: it cannot be found by name, and it must not surface as
  // a blank row in anyone's list.
  const ghost = upsertGoogleAccount('s-ghost', 'ghost@example.com', null)
  check('a nameless account cannot be added', !addFriend(alex, '').ok)
  check('a nameless account never appears in a list', !listFriends(ghost.user_id).length)

  try { unlinkSync(path) } catch { /* leave it */ }
}

console.log('\ncloud saves')
{
  const path = join(tmpdir(), `ather-saves-oracle-${process.pid}.db`)
  _openAt(path)
  const keeper = upsertGoogleAccount('s-keeper', 'keeper@example.com', null).user_id
  const other = upsertGoogleAccount('s-other', 'other@example.com', null).user_id

  check('no save reads null', getSave(keeper, 'shimmer') === null)
  putSave(keeper, 'shimmer', '{"v":1}')
  check('a save round-trips', getSave(keeper, 'shimmer')?.data === '{"v":1}')
  check('updated_at is stamped', (getSave(keeper, 'shimmer')?.updated_at ?? 0) > 0)
  putSave(keeper, 'shimmer', '{"v":2}')
  check('a push OVERWRITES (upsert, not insert)', getSave(keeper, 'shimmer')?.data === '{"v":2}')
  putSave(keeper, 'wallet', '{"marks":5}')
  check('games are separate slots', getSave(keeper, 'wallet')?.data === '{"marks":5}' && getSave(keeper, 'shimmer')?.data === '{"v":2}')
  check("another account's slot is empty", getSave(other, 'shimmer') === null)

  // Account deletion must take the garden with it — an orphaned save under a dead user_id
  // is both a privacy leak and a landmine for a future id collision.
  deleteAccount(keeper)
  check('deleting the account deletes its saves', getSave(keeper, 'shimmer') === null && getSave(keeper, 'wallet') === null)
  check("deletion left the other account's data alone", getAccount(other) !== null)

  try { unlinkSync(path) } catch { /* leave it */ }
}

console.log(failures === 0 ? '\nPASS — accounts oracle clean' : `\nFAIL — ${failures} assertion(s)`)
process.exit(failures === 0 ? 0 : 1)
