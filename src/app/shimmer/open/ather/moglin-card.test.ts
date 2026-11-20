// Moglin card + trust reveal (M46 slices 2+3). Run: npx tsx src/app/shimmer/open/ather/moglin-card.test.ts
import { cardOf, trustShare, tradeLabel } from './moglin-card'
import { SKILLS, rollSkills, rngOf } from './moglin-skills'
import { freshTrust, bring, type Folk } from './settlement-folk'
import { ASK, folkTalk, type FolkTalkActs } from './folk-talk'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const roll = rollSkills('carpenter', rngOf('card-test'))
const base: Folk = { id: '1:s1-3:0', name: 'Cress', home: 's1-3', profession: 'carpenter', grades: { craft: 3, yield: 3, trade: 2 },
  dream: 'a dream', employed: true, wants: [{ id: 'reed', n: 4 }, { id: 'clay', n: 4 }], skills: roll.skills, luck: roll.luck }

// untrusted, nothing brought: trade only
const t0 = freshTrust()
const c0 = cardOf(base, t0, 'Reedbank')
ok(c0.trade === 'Carpenter' && c0.name === 'Cress' && c0.home === 'Reedbank', 'name/home/trade')
ok(c0.rows.length === 9 && c0.rows.every(r => r.grade === null), 'untrusted: no pips')
ok(c0.luck === null && !c0.full && c0.best === 0 && c0.shown === 0, 'untrusted: no luck, no tint')
ok(c0.rows.map(r => r.skill).join() === SKILLS.join(), 'rows keep skill order')

// half the hoop: half the pips, best first
const t1 = bring(t0, base, 'reed', 4).trust
ok(Math.abs(trustShare(base, t1) - 0.5) < 1e-9, 'share 0.5 after half')
const c1 = cardOf(base, t1, 'Reedbank'), lit = c1.rows.filter(r => r.grade !== null)
ok(lit.length === 4, `half: 4 pips lit (got ${lit.length})`)
const minLit = Math.min(...lit.map(r => r.grade!)), maxDark = Math.max(...c1.rows.filter(r => r.grade === null).map(r => roll.skills[r.skill]))
ok(minLit >= maxDark, 'reveal order: best grades first')
ok(c1.best === Math.max(...SKILLS.map(s => roll.skills[s])), 'tint = best shown (the best is lit first)')
ok(c1.luck === null, 'luck stays hidden until trusted')

// trusted: full card
const t2 = bring(t1, base, 'clay', 4).trust
const c2 = cardOf(base, t2, 'Reedbank')
ok(c2.full && c2.shown === 1 && c2.rows.every((r, i) => r.grade === roll.skills[SKILLS[i]]), 'trusted: all nine true grades')
ok(c2.luck === roll.luck, 'trusted: luck shown')

// no hoop (comes for the asking): full from the start
const free: Folk = { ...base, employed: false, wants: [] }
ok(cardOf(free, t0, 'Reedbank').full, 'no hoop: full card')

// old folk without skills (the glade's five) migrate, never crash
const legacy: Folk = { ...free, skills: undefined, luck: undefined }
const cl = cardOf(legacy, t0, 'Moonwell')
ok(cl.full && cl.rows.every(r => r.grade && r.grade >= 1 && r.grade <= 5) && !!cl.luck, 'legacy folk: migrated card')
ok(tradeLabel('stonemason') === 'Stonemason', 'trade label')

// talk: hello offers Inspect, Inspect opens a node carrying the card, Back returns to hello
let at: unknown = null
const act: FolkTalkActs = { go: s => { at = s }, give: () => {}, recruit: () => {}, bye: () => {} }
const ctx = { folk: [base], home: [base], trust: t0, have: () => 0, room: 1, homeName: 'Reedbank' }
const hello = folkTalk(ctx, { fid: base.id, screen: 'hello' }, act)
const insp = hello.options.find(o => o.label === ASK.inspect)
ok(!!insp && !hello.card, 'hello: Inspect answer, no card')
insp?.pick()
ok((at as { screen?: string })?.screen === 'card', 'Inspect goes to the card screen')
const cardNode = folkTalk(ctx, { fid: base.id, screen: 'card' }, act)
ok(!!cardNode.card && cardNode.card.name === 'Cress' && cardNode.card.rows.every(r => r.grade === null), 'card node carries the (untrusted) card')
ok(cardNode.line === hello.line, 'bubble keeps the hello line on the card')
cardNode.options.find(o => o.label === ASK.back)?.pick()
ok((at as { screen?: string })?.screen === 'hello', 'Back returns to hello')

console.log(`moglin-card: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
