// The Glade tutorial as a pure walk — Magii's wiring sheet (athernyx 17e2223) as an oracle.
//
// Every transition below is a line of the sheet: greet hands nothing, Hazel lends on first talk and
// barks 'owed' until the square stack AND the blade come back, the five-doors gate arms Greg's ask,
// the shard is handed THERE, the choice re-arms on 'not yet' and folds on 'staying'. The host
// applies effects; this proves the machine names the right one at the right time.
import { talkGreg, talkFolk, answerChoice, migrate, objectiveLabel, stageActions, speakerOf,
         HAZEL_STACK, type TutorialState, type Talk } from './tutorial'
import { FOLK_IDS } from './folk'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const said = (t: Talk) => t.beats.filter(b => 'text' in b).map(b => (b as { text: string }).text).join(' ')

const empty = { planks: 0, hasHazelsBlade: false }
let s: TutorialState = migrate({})
ok(s.stage === 'greet' && s.met.length === 0 && s.hazel === 'unmet', 'fresh: greet, no doors, no errand')
ok(objectiveLabel(s, { logs: 0, ...empty }) === 'Find Gregory', 'fresh objective is Greg')

// A keeper who wanders to a door before Greg has spoken gets a bark, not the greet.
{
  const t = talkFolk(s, 'hazel', empty)
  ok(t.next === s && !t.effect && /Measure it twice/.test(said(t)), 'a door before the offer only barks')
}

// greet: warning + offer, nothing handed
{
  const t = talkGreg(s)
  ok(t.next.stage === 'doors' && !t.effect, 'greet → doors, no effect (no shard at greet)')
  ok(/I will not dress it up/.test(said(t)) && /Five doors, five folk/.test(said(t)), 'greet says warning then offer')
  s = t.next
}
ok(objectiveLabel(s, { logs: 0, ...empty }) === 'Knock on five doors', 'doors objective')
ok(/Five doors, Keeper/.test(said(talkGreg(s))), 'Greg barks while doors are owed')
ok(talkGreg(s).next === s, 'the bark changes nothing')

// Hazel first talk: greet/want/lend/give, blade lent
{
  const t = talkFolk(s, 'hazel', empty)
  ok(t.effect === 'lend_blade' && t.next.hazel === 'owed' && t.next.met.includes('hazel'), 'Hazel lends on first talk')
  ok(/Take mine/.test(said(t)) && /What you get is tables/.test(said(t)), 'her greet, want, lend and give all run')
  ok(speakerOf(t.beats) === 'HAZEL', 'the box is hers')
  s = t.next
}
const lent = { planks: 0, hasHazelsBlade: true }
ok(objectiveLabel(s, { logs: 0, ...lent }) === "Cut a log with Hazel's blade", 'errand step 1: cut')
ok(stageActions(s, { logs: 0, ...lent }).includes('world.mine'), 'cut hint is the mine action')
ok(objectiveLabel(s, { logs: 1, ...lent }) === "Mill planks at Hazel's sawmill", 'errand step 2: mill')
ok(objectiveLabel(s, { logs: 0, planks: HAZEL_STACK, hasHazelsBlade: true }) === 'Bring Hazel the stack', 'errand step 3: bring')
{
  const t = talkFolk(s, 'hazel', lent)
  ok(t.next === s && /my blade back/.test(said(t)), 'owed bark with no planks')
  const t2 = talkFolk(s, 'hazel', { planks: HAZEL_STACK - 1, hasHazelsBlade: true })
  ok(t2.next === s, 'a short stack is not square')
  const t3 = talkFolk(s, 'hazel', { planks: HAZEL_STACK, hasHazelsBlade: false })
  ok(t3.next === s, 'planks without the blade is not a turn-in')
}

// The four visits, in any order, each greet/want/give once then bark
for (const id of ['sax', 'yarrow', 'fennel', 'mallow'] as const) {
  const t = talkFolk(s, id, lent)
  ok(!t.effect && t.next.met.includes(id), `${id}: a visit, no effect`)
  ok(t.beats.filter(b => 'text' in b).length >= 3, `${id}: greet + want + give`)
  s = t.next
  const again = talkFolk(s, id, lent)
  ok(again.next === s && again.beats.filter(b => 'text' in b).length === 1, `${id}: barks after`)
}
ok(s.met.length === FOLK_IDS.length && s.stage === 'ask', 'five doors met → ask')
ok(objectiveLabel(s, { logs: 0, ...lent }) === 'Bring Hazel the stack', 'with the errand open, the chip still points at Hazel')

// Turn-in: blade back, planks stay (the lantern needs them and there is no blade to cut more)
{
  const t = talkFolk(s, 'hazel', { planks: HAZEL_STACK, hasHazelsBlade: true })
  ok(t.effect === 'take_blade' && t.next.hazel === 'done' && /Square. Good/.test(said(t)), 'turn-in takes the blade')
  s = t.next
  ok(talkFolk(s, 'hazel', empty).beats.length === 1 && /Measure it twice/.test(said(talkFolk(s, 'hazel', empty))), 'Hazel barks plain after')
}
ok(objectiveLabel(s, { logs: 0, ...empty }) === 'Return to Gregory', 'ask objective')

// Greg's ask hands the shard
{
  const t = talkGreg(s)
  ok(t.effect === 'give_shard' && t.next.stage === 'lantern' && /Take this shard/.test(said(t)), 'ask → lantern with the shard')
  s = t.next
}
ok(/will not light itself/.test(said(talkGreg(s))), 'Greg barks light while the lantern is owed')
s = { ...s, stage: 'light' }
ok(/will not light itself/.test(said(talkGreg(s))), '…and while it is unplaced')
s = { ...s, stage: 'choice' }
{
  const t = talkGreg(s)
  ok(t.choice === true && t.beats.some(b => 'option' in b) && /Are you staying/.test(said(t)), 'choice shows the question with options')
  const no = answerChoice(s, 'not-yet')
  ok(no.next.stage === 'choice' && !no.effect && /take your time/.test(said(no)), "'not yet' re-arms")
  const yes = answerChoice(s, 'staying')
  ok(yes.next.stage === 'done' && yes.effect === 'fold' && /Nobody folds their own/.test(said(yes)), "'staying' folds")
  s = yes.next
}
ok(talkGreg(s).beats.length === 0, 'post-fold Greg belongs to the fold-widening box, not the script')
ok(answerChoice(s, 'staying').next === s, 'the choice cannot be answered outside its stage')

// Migration of the old chain
ok(migrate({ stage: 'done' }).stage === 'done' && migrate({ stage: 'done' }).met.length === 5, "old 'done' stays done, every door met")
ok(migrate({ stage: 'report' }).stage === 'choice', "old 'report' → choice")
ok(migrate({ stage: 'lantern' }).stage === 'doors', 'old mid-chain restarts at the doors')
ok(migrate({ stage: 'nonsense', met: ['hazel', 'bogus'], hazel: 'owed' }).stage === 'doors', 'garbage stage → doors')
ok(migrate({ stage: 'lantern', met: ['hazel'], hazel: 'owed' }).stage === 'lantern', "new-shape 'lantern' is kept (met present)")
ok(migrate({ stage: 'ask', met: [] }).hazel === 'unmet', 'a missing hazel field reads unmet')
ok(migrate({ stage: 'ask', met: ['hazel', 'bogus'], hazel: 'owed' }).met.join() === 'hazel', 'unknown folk ids are dropped')
ok(migrate(null).stage === 'greet' && migrate('x').stage === 'greet', 'non-objects → fresh')

console.log(`tutorial: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
