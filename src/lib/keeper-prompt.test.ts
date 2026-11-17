// Sign-in roster prompt (M12 step 3). Run: npx tsx src/lib/keeper-prompt.test.ts
import { ROSTER_DECLINED, planRosterPrompt, rosterPromptNow, addAnonKeeperToRoster, declineAnonKeeper } from './keeper-prompt'
import { KEEPER_CLAIM, keeperKeyFor, KEEPER_KEYS, GARDEN_KEYS } from './keeper-local'
import { ROSTER_CAP, ROSTER_BASE, readRoster, ensureRoster, swapKeeper } from './keeper-roster'

const A = 'u_aaaaaaaaaaaaaaaaaa'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
function fakeStore(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial))
  return { data, get length() { return data.size }, key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) }, clear: () => data.clear() }
}
const PACK = 'open.inv.v1', RUNE = 'ather:shimmer:birthRune', SEEN = 'ather:shimmer:seen:glade', GARDEN = 'ather.garden.v1'
const world = () => fakeStore({
  [PACK]: 'ANON-PACK', [RUNE]: 'anon-rune', [SEEN]: 'anon-seen', [GARDEN]: 'anon-garden', 'ather:gfx:shimmer': 'device',
  [keeperKeyFor(PACK, A)]: 'ACCT-PACK', [keeperKeyFor(RUNE, A)]: 'acct-rune', [KEEPER_CLAIM]: A,
})
const install = (st: ReturnType<typeof fakeStore>) => { (globalThis as { localStorage?: unknown }).localStorage = st }

// ── the pure decision ──
const keys = [PACK, RUNE, keeperKeyFor(PACK, A), KEEPER_CLAIM, GARDEN]
ok(planRosterPrompt(keys, A, null, A, 1) === 'ask', 'locked + anon keys + not declined asks')
ok(planRosterPrompt(keys, A, null, A, ROSTER_CAP) === 'full', 'at the cap it says full')
ok(planRosterPrompt(keys, A, A, A, 1) === 'none', 'declined on this browser: never nags')
ok(planRosterPrompt(keys, A, 'u_other', A, 1) === 'ask', 'a decline by ANOTHER account does not silence this one')
ok(planRosterPrompt(keys, 'u_other', null, A, 1) === 'none', 'claimed by someone else: no prompt')
ok(planRosterPrompt(keys, null, null, A, 1) === 'none', 'unclaimed browser is not the locked case')
ok(planRosterPrompt(keys, A, null, null, 1) === 'none', 'anonymous: no prompt')
ok(planRosterPrompt([keeperKeyFor(PACK, A), KEEPER_CLAIM, GARDEN], A, null, A, 1) === 'none', 'no anonymous keeper keys (garden/claim only): nothing to ask')

// ── YES ──
{
  const st = world(); install(st)
  ok(rosterPromptNow(A) === 'ask', 'live read: ask')
  const before = { acctPack: st.getItem(keeperKeyFor(PACK, A)), acctRune: st.getItem(keeperKeyFor(RUNE, A)) }
  ok(addAnonKeeperToRoster(A) === 'added', 'yes: added')
  const r = readRoster(A)!
  ok(r.keepers.length === 2, 'roster now has 2 keepers (the account\'s own + the anonymous one)')
  const newId = r.keepers.find(k => k.id !== r.active)!.id
  ok(r.active !== newId, 'the ACTIVE keeper did not change')
  const pre = `u:${A}:k:${newId}:`
  ok(st.getItem(pre + PACK) === 'ANON-PACK' && st.getItem(pre + RUNE) === 'anon-rune' && st.getItem(pre + SEEN) === 'anon-seen', 'anon keys copied into the new keeper\'s parked prefix')
  ok(st.getItem(PACK) === null && st.getItem(RUNE) === null && st.getItem(SEEN) === null, 'anon copies removed after the copy landed')
  ok(st.getItem(keeperKeyFor(PACK, A)) === before.acctPack && st.getItem(keeperKeyFor(RUNE, A)) === before.acctRune, 'the account\'s live keeper is byte-identical')
  ok(st.getItem(GARDEN) === 'anon-garden', 'garden key never moved')
  ok(st.getItem('ather:gfx:shimmer') === 'device', 'device key untouched')
  ok(st.getItem(KEEPER_CLAIM) === A, 'browser stamped claimed')
  ok(rosterPromptNow(A) === 'none', 'prompt never repeats')
  // step 4's swap can reach it
  ok(swapKeeper(newId, A) && st.getItem(keeperKeyFor(PACK, A)) === 'ANON-PACK', 'the added keeper is swappable (live after swap)')
}

// ── NO ──
{
  const st = world(); install(st)
  const snapshot = JSON.stringify([...st.data.entries()])
  declineAnonKeeper(A)
  const after = new Map(st.data); after.delete(ROSTER_DECLINED)
  ok(JSON.stringify([...after.entries()]) === snapshot, 'no: nothing else changed, nothing deleted')
  ok(st.getItem(ROSTER_DECLINED) === A, 'the answer is remembered on this device')
  ok(rosterPromptNow(A) === 'none', 'no: does not nag next load')
  ok(st.getItem(PACK) === 'ANON-PACK', 'the anonymous keeper is still on this browser')
}

// ── CAP ──
{
  const st = world(); install(st)
  ensureRoster(A)
  const r = readRoster(A)!
  while (r.keepers.length < ROSTER_CAP) r.keepers.push({ id: 'k_fill' + r.keepers.length, created_at: 1 })
  st.setItem(keeperKeyFor(ROSTER_BASE, A), JSON.stringify(r))
  ok(rosterPromptNow(A) === 'full', 'live read at the cap: full')
  const snapshot = JSON.stringify([...st.data.entries()])
  ok(addAnonKeeperToRoster(A) === 'full', 'yes at the cap: full')
  ok(JSON.stringify([...st.data.entries()]) === snapshot, 'cap: the anonymous keeper is untouched, nothing written')
}

// ── a write that throws mid-copy loses nothing and lists nothing ──
{
  const st = world(); install(st)
  ensureRoster(A)
  const real = st.setItem; let n = 0
  st.setItem = (k: string, v: string) => { if (k.includes(':k:') && ++n === 2) throw new Error('quota'); real(k, v) }
  ok(addAnonKeeperToRoster(A) === 'failed', 'quota mid-copy: failed')
  st.setItem = real
  ok(st.getItem(PACK) === 'ANON-PACK' && st.getItem(RUNE) === 'anon-rune' && st.getItem(SEEN) === 'anon-seen', 'failed copy: every anonymous key still there')
  ok(readRoster(A)!.keepers.length === 1, 'failed copy: no half-keeper was listed')
  ok(![...st.data.keys()].some(k => k.includes(':k:')), 'failed copy: partial parked keys cleaned up')
}
ok(!KEEPER_KEYS.includes(ROSTER_DECLINED) && !GARDEN_KEYS.includes(ROSTER_DECLINED), 'the decline flag is a device key, not a keeper/garden key')

console.log(`keeper-prompt: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
