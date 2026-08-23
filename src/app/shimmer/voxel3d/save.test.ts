// The world store's ownership guard. Run: npx tsx src/app/shimmer/voxel3d/save.test.ts
//
// ── ⚠ WHAT THIS EXISTS TO CATCH (#692, 2026-08-23) ──────────────────────────────────────────────
// Two accounts in one browser walked into ONE world. A column record was addressed by seed and
// coordinates, and neither knows who built it, so account B signed in and stood in account A's
// garden holding A's chests. That is #682 one storage layer over, and the fix is the same: the
// owner goes in the key.
//
// ★ EVERY ASSERT HERE RUNS THE SHIPPED FUNCTION, NEVER A RESTATEMENT OF IT. The scan predicates are
// exported for exactly that reason — a test that rebuilt the prefix rule itself would be a copy of
// the thing it checks, and a copy agrees with its original right up until one of them goes stale.
// That failure mode cost this repo a day on 2026-08-22 and it manufactures a green.
//
// IndexedDB does not exist in node, so the transaction cannot be run here. That is why the DECISION
// is pure (`planAdoption`) and the transaction is a thin wrapper around it: what can be wrong is
// reachable, and what is unreachable is a `put` and a `delete`.

import {
  columnKey, playerKey, worldPrefix, ownsRecord, ownsColumn, ownsColumnIn, planAdoption,
} from './save'
import { newUserId } from '@/lib/accounts/db'

const SEED = 1337
const A = 'u_aaaaaaaaaaaaaaaaaa'
const B = 'u_bbbbbbbbbbbbbbbbbb'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── THE ANONYMOUS SPACE IS BYTE-IDENTICAL TO WHAT SHIPPED, AND THAT IS LOAD-BEARING ─────────────
// Every world anyone has ever built is addressed this way. A prefix added here would not corrupt
// them, it would ORPHAN them — still on disk, addressed by a key nothing asks for, which reads to
// a player as "my garden is gone". Spelled out rather than derived on purpose: derived, this assert
// would follow the code wherever it went and prove nothing.
ok(worldPrefix(null) === '', 'the anonymous keeper carries no prefix')
ok(columnKey(SEED, 0, 0, 'wilds', null) === '1337:0,0', `legacy wilds key (got ${columnKey(SEED, 0, 0, 'wilds', null)})`)
ok(columnKey(SEED, -3, 7, 'plot', null) === '1337:plot:-3,7', `legacy plot key (got ${columnKey(SEED, -3, 7, 'plot', null)})`)
ok(playerKey(SEED, null) === '1337:player', `legacy player key (got ${playerKey(SEED, null)})`)

// ── ★ THE BUG: TWO ACCOUNTS, ONE WORLD ──────────────────────────────────────────────────────────
ok(columnKey(SEED, 0, 0, 'wilds', A) !== columnKey(SEED, 0, 0, 'wilds', B), '★ #692: the same column is a different record for two accounts')
ok(columnKey(SEED, 0, 0, 'wilds', A) !== columnKey(SEED, 0, 0, 'wilds', null), 'a signed-in keeper does not write into the anonymous world')
ok(playerKey(SEED, A) !== playerKey(SEED, B), 'two keepers are not the same player record')
ok(columnKey(SEED, 0, 0, 'wilds', A) !== columnKey(SEED, 0, 0, 'plot', A), 'the two spaces stay distinct inside one account')

// ── ★★ AND THE SCANS, WHICH ARE WHERE A LEAK ACTUALLY HAPPENS ───────────────────────────────────
// Keying the records is only half of it: three functions answer by walking EVERY key in the store,
// and a prefix that matches one character too few hands the chest census, the built count or the
// WIPE somebody else's records. Run against a store holding all three keepers at once.
const store = [
  columnKey(SEED, 0, 0, 'wilds', null), columnKey(SEED, 4, 4, 'plot', null), playerKey(SEED, null), '1337:anon-owner',
  columnKey(SEED, 0, 0, 'wilds', A), columnKey(SEED, 1, 2, 'wilds', A), columnKey(SEED, 4, 4, 'plot', A), playerKey(SEED, A),
  columnKey(SEED, 0, 0, 'wilds', B), columnKey(SEED, 4, 4, 'plot', B), playerKey(SEED, B),
]
const seenBy = (p: (k: string) => boolean) => store.filter(p)

ok(seenBy(ownsColumn(SEED, A)).length === 3, `A counts A's three columns (got ${seenBy(ownsColumn(SEED, A)).length})`)
ok(seenBy(ownsColumn(SEED, B)).length === 2, `B counts B's two columns (got ${seenBy(ownsColumn(SEED, B)).length})`)
ok(!seenBy(ownsColumn(SEED, B)).includes(columnKey(SEED, 0, 0, 'wilds', A)), "★ #692: B's column count cannot see A's columns")
ok(!seenBy(ownsRecord(SEED, B)).some(k => k.includes(A)), "★ #692: B's WIPE cannot reach A's records")
ok(!seenBy(ownsRecord(SEED, A)).includes('1337:anon-owner'), "a signed-in wipe does not take the anonymous claim")
ok(seenBy(ownsRecord(SEED, null)).length === 4, `the anonymous keeper owns exactly the four unprefixed records (got ${seenBy(ownsRecord(SEED, null)).length})`)
ok(!seenBy(ownsRecord(SEED, null)).some(k => k.startsWith('u:')), '★ the anonymous scan cannot reach a signed-in world either')

// The player record and the claim are NOT columns. Counting by prefix alone read one high for every
// keeper who had ever moved, and would have counted the claim as a garden.
ok(!seenBy(ownsColumn(SEED, A)).includes(playerKey(SEED, A)), 'the player record is not a built column')
ok(!seenBy(ownsColumn(SEED, null)).includes('1337:anon-owner'), 'the adoption claim is not a built column')

// Space census, per keeper — the chest cap reads this, and a cap counted against a stranger's
// garden is a keeper told their own plot is full.
ok(seenBy(ownsColumnIn(SEED, 'plot', A)).length === 1, 'A has one plot column')
ok(seenBy(ownsColumnIn(SEED, 'wilds', A)).length === 2, 'A has two wilds columns')
ok(!seenBy(ownsColumnIn(SEED, 'plot', A)).includes(columnKey(SEED, 4, 4, 'plot', B)), "★ A's chest census cannot see B's plot")
ok(!seenBy(ownsColumnIn(SEED, 'wilds', A)).some(k => k.includes(':plot:')), 'the wilds census excludes plot columns by shape')

// ── ADOPTION: THE GARDEN YOU BUILT BEFORE YOU HAD AN ACCOUNT ────────────────────────────────────
const anonWorld = [columnKey(SEED, 0, 0, 'wilds', null), columnKey(SEED, 4, 4, 'plot', null), playerKey(SEED, null)]

const first = planAdoption(anonWorld, null, SEED, A)
ok(first.reason === 'adopted' && first.claim, 'a first sign-in adopts the anonymous world')
ok(first.moves.length === 3, `every anonymous record moves (got ${first.moves.length})`)
ok(first.moves.every(([from, to]) => to === `u:${A}:${from}`), 'a move keeps the seed, the space and the coordinates — only the owner is added')

// ★ THE ONE-SHOT RULE. Without it, B signs in on the same browser, finds the same anonymous garden
// and adopts A's pre-login world — #682 rebuilt out of the fix for it.
const second = planAdoption(anonWorld, A, SEED, B)
ok(second.reason === 'someone-elses' && !second.moves.length && !second.claim, "★ a second account may NOT adopt a world already claimed")
ok(planAdoption(anonWorld, A, SEED, A).reason === 'adopted', 'the account that claimed it may still finish adopting')

// ★ CLAIM, DO NOT MOVE, when the account already has a world. Moving would overwrite columns of a
// world this account built, and the anonymous one may be older — the trade this whole fix refuses.
const held = planAdoption([...anonWorld, columnKey(SEED, 9, 9, 'wilds', A)], null, SEED, A)
ok(held.reason === 'locked' && held.claim && !held.moves.length, '★ an account with its own world locks the anonymous one instead of taking it')

// ★ CLAIMING AN EMPTY SPACE WOULD RESERVE IT FOREVER, and the keeper that costs is somebody who
// builds while signed out and then signs in as a different account. There is no leak to prevent.
const empty = planAdoption(['1337:anon-owner'], null, SEED, A)
ok(empty.reason === 'nothing-anonymous' && !empty.claim, 'nothing anonymous on disk means nothing is claimed')
ok(planAdoption(anonWorld, null, SEED, null).reason === 'anonymous', 'an anonymous boot adopts nothing')
ok(!planAdoption([...anonWorld, '1337:anon-owner'], null, SEED, A).moves.some(([f]) => f === '1337:anon-owner'),
   'the claim record is never moved into the account')

// A move must never pick up another account's record, whatever else is on disk.
ok(!planAdoption(store, null, SEED, A).moves.some(([f]) => f.includes(B)), "★ adoption cannot sweep up B's records")

// ── ★★ THE PREMISE THE PREFIX SCANS REST ON, ASSERTED SO IT EXPIRES ─────────────────────────────
// `ownsRecord(A)` matches `u:<A>:1337:` by prefix, so it would also match a second account whose id
// began with A's id followed by a colon. That cannot happen today because `newUserId()` mints a
// fixed-length hex id with no colon in it — a premise held in another file, which is precisely the
// kind that goes stale quietly. Asserted against the real generator, so the day the format changes
// this fails instead of leaking.
const ids = Array.from({ length: 200 }, () => newUserId())
ok(ids.every(id => !id.includes(':')), '★ a user id contains no colon — otherwise one account is a prefix of another')
ok(new Set(ids.map(id => id.length)).size === 1, 'user ids are fixed length, so no id can prefix another')
ok(!ids.some(a => ids.some(b => a !== b && b.startsWith(a))), 'no minted id is a prefix of another')

console.log(`\nsave (world ownership): ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
