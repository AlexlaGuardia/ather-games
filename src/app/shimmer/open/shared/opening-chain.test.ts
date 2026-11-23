// THE OPENING CHAIN (BETA M73), pure: each step, the once-only ping, the invite-early path, the old-save rule, the gate hint,
// the flip + Rune Hold pulses, the note kept on a fall, the note handed once.   npx tsx src/app/shimmer/open/shared/opening-chain.test.ts
import { newChain, parseChain, migrate, readInvite, onDeath, tick, onGateOpen, onFlip, flipPulse, runeHoldPulse, digActive, wantsInvite, NUDGE_MS, KAEL_INVITE, type Chain } from './opening-chain'
import { newInv, giveInvite, countOf } from './inventory'
import { dropPack } from '../ather/backpack'

let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const T0 = 1_700_000_000_000

// ── step 1: a fresh keeper holds the folded note, The Dig is off
const c0 = newChain()
ok(c0.step === 'invite' && !digActive(c0) && wantsInvite(c0), 'fresh: invite step, Dig off, wants the note')
ok(!flipPulse(c0) && !runeHoldPulse(c0), 'fresh: nothing pulses')
ok(tick(c0, { packLying: false, now: T0 }).say === null, 'no death, no ping')

// ── the death path: first death -> pack lying -> nothing; pack recovered/gone -> the ping, once
let c = onDeath(c0)
ok(c.died && c.step === 'invite', 'a death arms the ping, the Dig waits')
let r = tick(c, { packLying: true, now: T0 })
ok(r.say === null && !r.chain.pinged, 'pack still lying: Morel waits')
r = tick(r.chain, { packLying: false, now: T0 + 1000 })
ok(r.say === 'ping' && r.chain.pinged && r.chain.step === 'dig' && digActive(r.chain), 'pack recovered/gone: the ping, and the Dig starts')
c = r.chain
ok(tick(c, { packLying: false, now: T0 + 2000 }).say === null, 'the ping does not repeat on the next tick')
const c2 = onDeath(c)
ok(c2 === c, 'a second death changes nothing')
ok(tick(onDeath(c), { packLying: false, now: T0 + 3000 }).say === null, 'a second death + pack does not re-ping')
// reload: the record round-trips and still says pinged
const re = parseChain(JSON.parse(JSON.stringify(c)))!
ok(re.pinged && tick(re, { packLying: false, now: T0 + 4000 }).say === null, 'after a reload the ping stays spent')

// ── the nudge: once, after NUDGE_MS, only while the note is still unread
ok(tick(c, { packLying: false, now: T0 + 1000 + NUDGE_MS - 1 }).say === null, 'nudge waits its wait')
r = tick(c, { packLying: false, now: T0 + 1000 + NUDGE_MS })
ok(r.say === 'nudge' && r.chain.nudged, 'nudge goes once the wait is up')
ok(tick(r.chain, { packLying: false, now: T0 + 5 * NUDGE_MS }).say === null, 'nudge never loops')
ok(tick(readInvite(c), { packLying: false, now: T0 + 5 * NUDGE_MS }).say === null, 'a read note gets no nudge')

// ── reading the invite early starts The Dig; the death then owes no ping
let e = readInvite(c0)
ok(e.read && e.step === 'dig' && digActive(e), 'read early: The Dig starts')
ok(readInvite(e) === e, 'reading again is a no-op')
e = onDeath(e)
r = tick(e, { packLying: false, now: T0 })
ok(r.say === null && r.chain.pinged, 'read before the death: no ping (its line is about an unread note), spent for good')
// read after the ping
const afterPing = readInvite(c)
ok(afterPing.read && afterPing.step === 'dig', 'read after the ping keeps the Dig on')

// ── the gate hint: Dig on AND note read, once
ok(onGateOpen(c0).say === null, 'no Dig: no gate hint')
ok(onGateOpen(c).say === null, 'Dig on via the ping but note unread: no gate hint (§3)')
let g = onGateOpen(readInvite(c0))
ok(g.say === 'hint' && g.chain.hinted, 'Dig on + note read: the gate hint')
ok(onGateOpen(g.chain).say === null, 'gate hint goes once')

// ── the flip pulse stops on a flip to the Athernyx side; Rune Hold keeps pulsing
let f = readInvite(c0)
ok(flipPulse(f) && runeHoldPulse(f), 'Dig on: flip + Rune Hold pulse')
ok(onFlip(f, 'ather') === f, 'flipping to the Ather side does not count')
f = onFlip(f, 'athernyx')
ok(!flipPulse(f) && runeHoldPulse(f), 'flipped: the button stops, Rune Hold still pulses')
ok(onFlip(c0, 'athernyx') === c0, 'a flip before the Dig is not remembered')

// ── the old-save rule
const old = migrate({ kaelChestOpen: true })
ok(old.past === true && !digActive(old) && !wantsInvite(old) && !flipPulse(old) && !runeHoldPulse(old), 'old save past Kael\'s yard: past, no note, no pulses')
ok(tick(onDeath(old), { packLying: false, now: T0 }).say === null && onGateOpen(readInvite(old)).say === null, 'old save past the yard: Morel says nothing, ever')
const young = migrate({ kaelChestOpen: false })
ok(JSON.stringify(young) === JSON.stringify(newChain()), 'old save not yet at the yard: starts at the invite like a new keeper')
ok(!young.died, 'a death before the chain shipped is not counted: the ping waits for the next one')

// ── parse: junk is null, never a half chain
ok(parseChain(null) === null && parseChain({ v: 2 }) === null && parseChain({ v: 1, step: 'yard' }) === null, 'junk records parse to null')
const p = parseChain({ v: 1, step: 'dig', read: 'yes', pinged: true, pingAt: 'x' }) as Chain
ok(p.read === false && p.pinged === true && p.pingAt === undefined, 'fields are coerced, not trusted')

// ── the note in the bag: handed once, kept on a fall
const inv0 = newInv()
const inv1 = giveInvite(inv0)!
ok(countOf(inv1, KAEL_INVITE) === 1, 'the note is handed')
ok(giveInvite(inv1) === null, 'never handed twice')
ok(giveInvite({ ...inv1, slots: inv1.slots.map(s => (s?.id === KAEL_INVITE ? null : s)) }) === null, 'a note already handed is not re-handed even if gone from the bag')
const full = { ...inv0, slots: inv0.slots.map((s, k) => s ?? { id: `x${k}`, n: 99 }) }
ok(giveInvite(full) === null, 'a full bag: not handed, not marked (retried later)')
const fall = dropPack(inv1, 0, 0, 0, T0)
ok(countOf(fall.inv, KAEL_INVITE) === 1 && !(fall.pack?.items ?? []).some(s => s.id === KAEL_INVITE), 'a fall keeps the note on the keeper, out of the pack')

console.log(`opening-chain: ${n - fails}/${n}${fails ? ` · ${fails} FAILED` : ' · pass'}`)
process.exit(fails ? 1 : 0)
