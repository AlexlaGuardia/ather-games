// THE OPENING CHAIN (BETA M73), pure: each step, the once-only ping, the invite-early path, the old-save rule, the gate hint,
// the flip + Rune Hold pulses, the note kept on a fall, the note handed once.   npx tsx src/app/shimmer/open/shared/opening-chain.test.ts
import { newChain, parseChain, migrate, readInvite, onDeath, tick, onGateOpen, onFlip, flipPulse, runeHoldPulse, digActive, wantsInvite, NUDGE_MS, KAEL_INVITE, KAEL_PAGE, onYard, wantsPage, pageFound, readPage, shipRepair, onVeyraSend, veyraDue, veyraOpen, veyraOptions, veyraPick, type Chain, type VeyraTalk, type VeyraPick } from './opening-chain'
import { newInv, giveInvite, givePage, countOf } from './inventory'
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
ok(parseChain(null) === null && parseChain({ v: 2 }) === null && parseChain({ v: 1, step: 'shipyard' }) === null, 'junk records parse to null (an unknown step; yard is a real step since s3)')
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

// ── s3: THE YARD -> THE PAGE -> VEYRA -> THE SHIP-REPAIR FLAG
const dig = onFlip(readInvite(newChain()), 'athernyx')
ok(runeHoldPulse(dig) && !shipRepair(dig) && veyraDue(dig) === null, 'on The Dig: Rune Hold pulses, no flag, Veyra has nothing yet')
ok(readPage(dig) === dig && onVeyraSend(dig) === dig, 'before the yard: no page to read, no send')
const yd = onYard(dig)
ok(yd.step === 'yard' && !runeHoldPulse(yd) && !digActive(yd), 'the yard: step yard, the Rune Hold pulse ends')
ok(wantsPage(yd) && !wantsPage(pageFound(yd)), 'the yard wants the page handed, once')
ok(onYard(yd) === yd, 'standing in the yard again changes nothing')
ok(readPage(yd) === yd, 'no page in hand: reading does nothing')
ok(veyraDue(pageFound(yd)) === null, 'page found but unread: Veyra waits')
ok(onVeyraSend(pageFound(yd)).step === 'yard' && !shipRepair(onVeyraSend(pageFound(yd))), 'page unread: no send, no flag')
const rp = readPage(pageFound(yd))
ok(rp.pageRead && veyraDue(rp) === 'unit1' && !shipRepair(rp), 'page read: Veyra Unit 1 is due, flag not yet set')
const fl = onVeyraSend(rp)
ok(fl.step === 'repair' && shipRepair(fl) && veyraDue(fl) === 'bark', 'the send: THE SHIP-REPAIR FLAG set, Veyra barks after')
ok(onVeyraSend(fl) === fl && onYard(fl) === fl && readPage(fl) === fl, 'past the flag: nothing moves it back')
const rl = parseChain(JSON.parse(JSON.stringify(fl)))!
ok(rl.step === 'repair' && shipRepair(rl) && rl.page && rl.pageRead, 'the flag survives a reload (round-trip)')
ok(parseChain({ ...fl, step: 'nope' }) === null, 'a bad step is no chain')
const inv = onYard(newChain())
ok(inv.step === 'yard' && tick(onDeath(inv), { packLying: false, now: T0 }).say === null, 'walked to the yard unread: the yard counts, no ping about the note')
const past = migrate({ kaelChestOpen: true })
ok(onYard(past) === past && !wantsPage(past) && veyraDue(past) === null && shipRepair(past), 'past keeper: no page, no Veyra, the flag reads set')
const ipg = givePage(newInv())!
ok(countOf(ipg, KAEL_PAGE) === 1 && givePage(ipg) === null, 'the page is handed once')
ok(givePage(full) === null, 'a full bag: the page waits')
ok(countOf(dropPack(ipg, 0, 0, 0, T0).inv, KAEL_PAGE) === 1, 'a fall keeps the page on the keeper')
// Veyra's talk: both questions in either order, then the send; or one question + '…' -> the send
const walk = (picks: VeyraPick[]) => { let t: VeyraTalk | 'done' = veyraOpen('unit1'); const seen: string[] = [t.at]; for (const p of picks) { if (t === 'done') break; t = veyraPick(t, p); seen.push(t === 'done' ? 'done' : t.at) } return seen.join(' ') }
ok(walk(['next', 'asked', 'next', 'where', 'next', 'next', 'next']) === 'open kaels asked1 asked2 where1 where2 send done', 'asked then where, then the send')
ok(walk(['next', 'where', 'next', 'asked', 'next', 'next', 'next']) === 'open kaels where1 where2 asked1 asked2 send done', 'where then asked, then the send')
ok(walk(['next', 'asked', 'next', 'next', 'next']) === 'open kaels asked1 asked2 send done', 'only asked + …: the send after it')
ok(walk(['next', 'where', 'next', 'next', 'next']) === 'open kaels where1 where2 send done', 'only where + …: the send after it')
ok(JSON.stringify(veyraOptions({ at: 'kaels', asked: false, where: false })) === '["asked","where"]', 'the choice: the two questions only')
ok(JSON.stringify(veyraOptions({ at: 'where2', asked: true, where: true })) === '["next"]', 'both asked: no question left, only …')
const k: VeyraTalk = { at: 'kaels', asked: false, where: false }
ok(veyraPick(k, 'next') === k, 'an option not offered does nothing')
ok(veyraPick(veyraOpen('bark'), 'next') === 'done' && veyraOpen('bark').at === 'bark', 'the bark: one line, then done')

// ── M146: held while First Steps is on ──
{
  const H = { packLying: false, now: 5, held: true }, F = { packLying: false, now: 9 }
  const rd = readInvite(newChain(), true)
  ok(rd.read && rd.step === 'invite' && !digActive(rd) && !flipPulse(rd) && !runeHoldPulse(rd), 'held: the note reads, no Dig')
  ok(tick(rd, H).chain === rd, 'held: the tick waits')
  const on = tick(rd, F); ok(on.chain.step === 'dig' && on.say === null && digActive(on.chain), 'back at Greg: The Dig starts, nobody pings a read note')
  const dd = onDeath(newChain()); ok(tick(dd, H).say === null && tick(dd, H).chain === dd, 'held: a death, no ping')
  const pg = tick(dd, F); ok(pg.say === 'ping' && pg.chain.step === 'dig', 'back at Greg: died and unread = the ping')
  ok(tick(newChain(), F).say === null && tick(newChain(), F).chain.step === 'invite', 'back at Greg, alive and unread: nothing yet')
  const both = readInvite(dd, true), b2 = tick(both, F); ok(b2.say === null && b2.chain.step === 'dig' && b2.chain.pinged, 'died and read: The Dig, no ping')
  const dig = { ...newChain(), step: 'dig' as const, read: true }
  ok(!flipPulse(dig, true) && !runeHoldPulse(dig, true) && onFlip(dig, 'athernyx', true) === dig && onGateOpen(dig, true).say === null && tick(dig, H).chain === dig, 'a Dig already on, held: no pulse, no hint')
  ok(flipPulse(dig) && runeHoldPulse(dig), 'and back once First Steps is done')
  ok(onYard(dig, true) === dig && onYard(dig).step === 'yard', 'held: the yard waits too')
  const ng = { ...dig, read: false, pinged: true, pingAt: 0 }; ok(tick(ng, { ...H, now: NUDGE_MS + 1 }).say === null && tick(ng, { ...F, now: NUDGE_MS + 1 }).say === 'nudge', 'held: no nudge')
}

console.log(`opening-chain: ${n - fails}/${n}${fails ? ` · ${fails} FAILED` : ' · pass'}`)
process.exit(fails ? 1 : 0)
