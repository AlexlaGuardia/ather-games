// The first-rinstick quest (rinquest.ts + the gate in rinsticks.ts, BETA M22). Run: npx tsx src/app/shimmer/open/ather/rinquest.test.ts
import { saveTut, gift, freshTut } from './glade-tutorial'
import { migrate, fresh, onShop, doStep, currentStep, hasStick, noStickLine, questEntries, fennelHere, waitingAt, scaleOnBank, waitTick, SHED_SCALE, RINQUEST_STEPS, RINQUEST_LINES } from './rinquest'
import { loadTools, markBornWithoutStick, saveQuest } from './rinsticks'
import { skillPointerEntries, RINNSHOP_LINE, RINNING_LINE } from '../business/skill-pointers'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// a tiny localStorage so the save-side gate runs for real
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, String(v)) }, removeItem: (k: string) => { mem.delete(k) } }

// migration: no flag = born before M22 = done (keeps the stick); a saved state is kept
ok(migrate(null).state === 'done' && hasStick(migrate(null)), 'migrate: a keeper with no flag (born before M22) lost the worn rinstick')
ok(migrate(fresh()).state === 'none' && !hasStick(migrate(fresh())), 'migrate: a fresh birth flag did not survive the read')
ok(migrate({ v: 1, state: 'active', step: 0 }).state === 'active', 'migrate: an active quest was not kept')
ok(migrate({ v: 2, state: 'none' }).state === 'done' && migrate({ v: 1, state: 'odd', step: 0 }).state === 'done', 'migrate: junk read as a fresh keeper (would take a stick off a live save)')
ok(migrate({ v: 1, state: 'active', step: 99 }).step === RINQUEST_STEPS.length - 1, 'migrate: an active step past the table was not clamped to the last')

// start: only a standing Rinnshop starts it, and only from none
ok(onShop(fresh(), false).state === 'none', 'start: began with no Rinnshop')
ok(onShop(fresh(), true).state === 'active' && onShop(fresh(), true).step === 0, 'start: a standing Rinnshop did not start the quest')
const done = migrate(null)
ok(onShop(done, true) === done, 'start: a keeper who already has the stick was put back on the quest')

// steps (ruling 4½): Fennel -> the Moonwell at dusk -> the scale -> the bind (stick in hand) -> Fennel gets the first catch
const act = onShop(fresh(), true)
ok(currentStep(act)?.id === 'meet' && fennelHere(act), 'step: the quest does not open on meeting Fennel')
const has = (yes: boolean) => (_: string) => yes
const T = (hasCatch = false) => ({ kind: 'talk' as const, who: 'fennel' as const, hasCatch })
const W = { kind: 'waited' as const, at: 'moonwell' as const }, P = { kind: 'picked' as const, item: SHED_SCALE }
const B = (yes: boolean) => ({ kind: 'bench' as const, at: 'rinnshop' as const, has: has(yes) })
// out of order: nothing moves
ok(doStep(act, W).q === act && doStep(act, P).q === act && doStep(act, B(true)).q === act, 'order: a later step finished the first one')
let q = doStep(act, T()).q
ok(currentStep(q)?.id === 'dusk' && !!waitingAt(q) && waitingAt(q)!.phase === 'dusk', 'step: talking to Fennel does not send you to the Moonwell at dusk')
ok(doStep(q, T()).q === q, 'order: talking again skipped the wait')
q = doStep(q, W).q
ok(scaleOnBank(q), 'step: the wait did not leave a scale on the bank')
ok(doStep(q, { kind: 'picked', item: 'bait' }).q === q, 'pickup: the wrong item counted as the scale')
q = doStep(q, P).q
ok(currentStep(q)?.do.kind === 'bench' && !hasStick(q), 'step: the scale gave the stick before the bind')
ok(doStep(q, B(false)).q === q, 'bind: bound with no scale in the bag')
const bound = doStep(q, B(true))
ok(bound.granted && bound.took === SHED_SCALE && hasStick(bound.q) && bound.q.state === 'active', 'bind: did not take the scale and put the stick in hand (quest still open)')
q = bound.q
ok(currentStep(q)?.id === 'catch' && doStep(q, T(false)).q === q, 'catch: Fennel closed the quest with no catch')
const closed = doStep(q, T(true))
ok(closed.q.state === 'done' && hasStick(closed.q) && !closed.granted, 'catch: the first catch did not close the quest (or granted twice)')
q = closed.q
ok(doStep(q, B(true)).q === q && !fennelHere(q), 'done: a closed quest moved, or Fennel still waits')
// the wait clock: only at the water, still, hands empty, at dusk; any break resets it
const ok4 = { at: true, still: true, empty: true, phase: true }
ok(waitTick(0, 5, ok4, 12).t === 5 && !waitTick(0, 5, ok4, 12).done && waitTick(10, 3, ok4, 12).done, 'wait: the clock does not count to its length')
for (const k of ['at', 'still', 'empty', 'phase'] as const) ok(waitTick(10, 1, { ...ok4, [k]: false }, 12).t === 0, `wait: '${k}' breaking does not reset the clock`)
// migration from the one-step placeholder that was live 11-18
ok(migrate({ v: 1, state: 'active', step: 0 }).step === 0 && currentStep(migrate({ v: 1, state: 'active', step: 0 }))?.id === 'meet', 'migrate: a placeholder save mid-quest does not land on meeting Fennel')
ok(migrate({ v: 1, state: 'done', step: 1 }).state === 'done' && hasStick(migrate({ v: 1, state: 'done', step: 1 })), 'migrate: a placeholder save that finished lost its stick')
ok(migrate({ v: 1, state: 'active', step: 3, stick: true }).stick === true, 'migrate: a bound stick was not kept')
// the journal points the Moonwell steps at the water
const mw = { x: -310, z: 293 }
ok(questEntries(doStep(act, T()).q, mw)[0].where?.x === mw.x && questEntries(act, mw)[0].where === null, "journal: the Moonwell step does not point at the water (or Fennel's does)")

// lines + journal
ok(noStickLine(fresh()) === RINQUEST_LINES.noShop && noStickLine(act) === RINQUEST_LINES.inQuest, 'line: the no-stick line does not point the right way')
ok(questEntries(act, mw, { x: 3, z: 4 })[0].where?.zone === 'ather' && questEntries(act, mw, { x: 3, z: 4 })[0].where?.x === 3, 'journal: given where Fennel stands, the meeting step does not point at her (M33 ping)')
ok(questEntries(fresh()).length === 0, 'journal: a line before the Rinnshop stands (the rinning pointer covers it)')
ok(questEntries(act)[0]?.title === RINQUEST_STEPS[0].title && !questEntries(act)[0].struck, 'journal: the open step is not shown')
ok(!!questEntries(q)[0]?.struck, 'journal: the done quest is not struck')
const noStick = skillPointerEntries({ rinning: false, prospecting: false }, false)[0], withStick = skillPointerEntries({ rinning: false, prospecting: false })[0]
ok(noStick.title === RINNSHOP_LINE.title && withStick.title === RINNING_LINE.title, 'pointer: the rinning pointer is not re-aimed at the Rinnshop while there is no stick')

// the save-side gate (rinsticks.ts)
mem.clear()
ok(loadTools().rinning?.toolId === 'worn_rinstick', 'gate: an old save (no flag) lost its worn rinstick')
markBornWithoutStick()
ok(!loadTools().rinning && !loadTools().forestry && !loadTools().prospecting, 'gate: a tutorial newborn holds no basic tools before the friends (M68 s3a)')
saveTut(gift(gift(freshTut(), 'spike').t, 'pruner').t)   // Otto + Bonn lit the sockets
ok(!loadTools().rinning && !!loadTools().forestry && !!loadTools().prospecting, 'gate: a new keeper got the worn rinstick, or lost the blade/spike')
// a better rinstick in the save is never taken (M133: it never wears out either, tools-permanent.test.ts)
mem.set('open.tools.v1', JSON.stringify({ rinning: { toolId: 'basic_rinstick', usesRemaining: 1, speedBonus: 1, xpBonus: 1.05 } }))
ok(loadTools().rinning?.toolId === 'basic_rinstick', 'gate: an upgraded rinstick was taken off an unearned keeper')
saveQuest({ v: 1, state: 'done', step: RINQUEST_STEPS.length })
mem.delete('open.tools.v1')
ok(loadTools().rinning?.toolId === 'worn_rinstick', 'gate: finishing the quest did not put the worn rinstick in hand')

if (fails.length) { console.error(`rinquest: ${pass} pass, ${fails.length} FAIL\n  ` + fails.join('\n  ')); process.exit(1) }
console.log(`rinquest: ${pass} pass, 0 fail`)
