// Run: npx tsx src/app/shimmer/open/ather/glade-greg-talk.test.ts
// M68 s2: Greg's tutorial talk walked like a keeper would: welcome (4 lines) -> Moglins? / Spirits? -> The Wilds? only after
// both -> goodbye; every bubble is a SIGNED line; the grimoire is handed on reaching Spirits .3 and only once (a replay, a
// reload, a keeper who already owns a pedestal = no second); a full bag refuses the step and records nothing; leaving
// mid-branch replays it; a legacy keeper never sees the tutorial.
import { tutStart, tutNode, advance, grimoireGift, BRANCH_LINES, GRIMOIRE_AT, type TutCursor } from './glade-greg-talk'
import { freshTut, legacyTut, gift, gregScreen, parseTut, type Tut } from './glade-tutorial'
import { GLADE_LINES, line } from './glade-tutorial-lines'
import { ANSWERS } from './greg-talk'
import { FURNITURE, PIECE_JOBS } from './furniture'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const signed = new Set(Object.values(GLADE_LINES).map(l => l.text))

/** A tiny keeper: holds the tutorial, the cursor, a bag count of pedestals; picks options by label. */
function keeper(t0: Tut, opts: { owns?: boolean; bagFull?: boolean } = {}) {
  const k = { t: t0, c: tutStart(t0) as TutCursor | null, pedestals: opts.owns ? 1 : 0, bubbles: [] as string[], bagFull: !!opts.bagFull }
  const acts = {
    set: (t: Tut) => { k.t = t },
    go: (c: TutCursor | null) => { k.c = c },
    grimoire: () => {
      const g = grimoireGift(k.t.gifts.includes('grimoire'), k.pedestals > 0)
      if (!g.record) return true
      if (g.give) { if (k.bagFull) return false; k.pedestals++ }
      k.t = gift(k.t, 'grimoire').t; return true
    },
  }
  const node = () => tutNode(k.t, k.c!, acts)
  const labels = () => node().options.map(o => o.label)
  const pick = (label: string) => { const o = node().options.find(x => x.label === label); if (!o) throw new Error(`no option ${label} (have ${labels().join(' / ')})`); o.pick() }
  const read = () => { const n = node(); k.bubbles.push(n.line); return n }
  return { k, node, labels, pick, read, acts }
}
const A = line('greg.b1.choice.a'), B = line('greg.b1.choice.b'), C = line('greg.b1.choice.c')

// ── the full walk ──
let K = keeper(freshTut())
ok(K.k.c?.b === 'welcome' && K.k.c.i === 0, 'a newborn starts on welcome .1')
for (let i = 0; i < BRANCH_LINES.welcome - 1; i++) { ok(K.labels().join() === ANSWERS.more, `welcome .${i + 1} offers only "${ANSWERS.more}"`); K.read(); K.pick(ANSWERS.more) }
K.read()
ok(K.k.t.greg.welcome, 'reaching welcome .4 marks it heard')
ok(K.labels().join() === [A, B, ANSWERS.bye].join(), `welcome .4 offers Moglins? / Spirits? / goodbye (${K.labels().join(' / ')})`)
ok(!K.labels().includes(C), 'The Wilds? is not offered before both are heard')
K.pick(A)
for (let i = 0; i < BRANCH_LINES.moglins - 1; i++) { K.read(); K.pick(ANSWERS.more) }
K.read(); ok(K.k.t.greg.moglins, 'reaching moglins .3 marks it heard')
K.pick(ANSWERS.more)
ok(K.k.c?.b === 'hub' && K.read().line === line('greg.b1.hub.back'), 'back at the hub: "Now then. Where were we?"')
ok(K.labels().join() === [B, ANSWERS.bye].join(), `the hub now offers Spirits? and goodbye only (${K.labels().join(' / ')})`)
K.pick(B)
for (let i = 0; i < GRIMOIRE_AT; i++) { ok(K.k.pedestals === 0, `no grimoire before spirits .${i + 1} is passed`); K.read(); K.pick(ANSWERS.more) }
ok(K.read().line === line('greg.b1.spirits.3') && K.k.pedestals === 1 && K.k.t.gifts.includes('grimoire'), 'spirits .3 ("This is a grimoire.") hands ONE pedestal')
for (let i = GRIMOIRE_AT; i < BRANCH_LINES.spirits - 1; i++) { K.pick(ANSWERS.more); K.read() }
ok(K.k.t.greg.spirits, 'reaching spirits .6 marks it heard')
K.pick(ANSWERS.more)
ok(K.labels().join() === [C, ANSWERS.bye].join(), `both heard: the hub offers The Wilds? (${K.labels().join(' / ')})`)
K.pick(C)
for (let i = 0; i < BRANCH_LINES.wilds - 1; i++) { K.read(); K.pick(ANSWERS.more) }
K.read(); ok(K.k.t.greg.wilds, 'reaching wilds .5 marks the Wilds heard')
ok(K.labels().join() === ANSWERS.bye, 'wilds .5 offers goodbye only')
K.pick(ANSWERS.bye); ok(K.k.c === null, 'goodbye closes the tutorial talk')
ok(K.k.bubbles.every(b => signed.has(b)), 'every bubble is a signed line')
ok(K.k.bubbles.length === 4 + 3 + 1 + 6 + 5, `the walk shows each line once (${K.k.bubbles.length})`)
ok(tutStart(K.k.t) === null && gregScreen(K.k.t).kind === 'pending', 'after the Wilds Greg is back to his ordinary talk (pending bark)')
ok(K.k.pedestals === 1, 'the whole walk handed exactly one pedestal')

// ── replay + reload never re-gift ──
const saved = parseTut(JSON.parse(JSON.stringify({ ...K.k.t, greg: { ...K.k.t.greg, spirits: false, wilds: false } })))!   // pretend they left mid-Spirits after the gift
K = keeper(saved); K.k.pedestals = 1
ok(K.k.c?.b === 'hub' && K.labels().includes(B), 'left mid-Spirits: the hub offers Spirits? again')
K.pick(B); for (let i = 0; i < BRANCH_LINES.spirits - 1; i++) K.pick(ANSWERS.more)
ok(K.k.pedestals === 1 && K.k.t.greg.spirits, 'replaying Spirits? after a reload hands nothing new, and still counts')

// ── a keeper who already crafted one from the old recipe keeps it, gets no second ──
K = keeper(freshTut(), { owns: true }); K.k.t = { ...K.k.t, greg: { ...K.k.t.greg, welcome: true } }; K.k.c = { b: 'spirits', i: 0 }
for (let i = 0; i < GRIMOIRE_AT; i++) K.pick(ANSWERS.more)
ok(K.k.pedestals === 1 && K.k.t.gifts.includes('grimoire'), 'an owned pedestal counts as THE pedestal: no second, gift recorded')

// ── a full bag refuses the step and records nothing ──
K = keeper(freshTut(), { bagFull: true }); K.k.t = { ...K.k.t, greg: { ...K.k.t.greg, welcome: true } }; K.k.c = { b: 'spirits', i: 0 }
for (let i = 0; i < GRIMOIRE_AT; i++) K.pick(ANSWERS.more)
ok(K.k.c?.i === GRIMOIRE_AT - 1 && !K.k.t.gifts.includes('grimoire') && K.k.pedestals === 0, 'bag full: Greg holds on .2, nothing given, nothing recorded')
K.k.bagFull = false; K.pick(ANSWERS.more)
ok(K.k.c?.i === GRIMOIRE_AT && K.k.pedestals === 1, 'room made: the next "And then?" hands it')

// ── guard table + legacy + leaving at the welcome ──
ok(JSON.stringify(grimoireGift(true, false)) === JSON.stringify({ record: false, give: false }), 'already given: nothing')
ok(JSON.stringify(grimoireGift(false, true)) === JSON.stringify({ record: true, give: false }), 'owns one: record only')
ok(JSON.stringify(grimoireGift(false, false)) === JSON.stringify({ record: true, give: true }), 'fresh: record + give')
ok(tutStart(legacyTut()) === null, 'a legacy keeper never sees the tutorial talk')
K = keeper(freshTut()); K.pick(ANSWERS.more)
ok(!K.k.t.greg.welcome && tutStart(K.k.t)?.b === 'welcome', 'leaving during the welcome replays it from .1')
// advance on a last line / the hub does nothing
const before = JSON.stringify(K.k); advance(K.k.t, { b: 'hub', i: 0 }, K.acts); advance(K.k.t, { b: 'wilds', i: BRANCH_LINES.wilds - 1 }, K.acts)
ok(JSON.stringify(K.k) === before, 'advance past a last line (or on the hub) is a no-op')
// every id the talk reads exists
for (const b of Object.keys(BRANCH_LINES) as (keyof typeof BRANCH_LINES)[]) for (let i = 1; i <= BRANCH_LINES[b]; i++) ok(GLADE_LINES[`greg.b1.${b}.${i}`], `line greg.b1.${b}.${i} exists`)
ok(!GLADE_LINES[`greg.b1.spirits.${BRANCH_LINES.spirits + 1}`] && !GLADE_LINES[`greg.b1.welcome.${BRANCH_LINES.welcome + 1}`], 'no signed line past a branch end goes unread')

// ── the pedestal is a gift now: not on the carpentry bench, one source ──
ok(FURNITURE.grimoire_pedestal.gift === true && FURNITURE.grimoire_pedestal.recipe.length === 0 && !FURNITURE.grimoire_pedestal.sold, 'the Grimoire Pedestal is given, never made or sold')
ok(!PIECE_JOBS.some(j => j.id === 'grimoire_pedestal'), 'the carpentry bench no longer makes it')

console.log(`glade-greg-talk: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
