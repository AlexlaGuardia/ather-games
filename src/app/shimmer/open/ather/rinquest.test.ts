// The first-rinstick quest (rinquest.ts + the gate in rinsticks.ts, BETA M22). Run: npx tsx src/app/shimmer/open/ather/rinquest.test.ts
import { migrate, fresh, onShop, doStep, currentStep, hasStick, noStickLine, questEntries, RINQUEST_STEPS, RINQUEST_LINES } from './rinquest'
import { loadTools, wearRinstick, markBornWithoutStick, saveQuest } from './rinsticks'
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
ok(migrate({ v: 1, state: 'active', step: 99 }).step === RINQUEST_STEPS.length, 'migrate: a step past the table was not clamped')

// start: only a standing Rinnshop starts it, and only from none
ok(onShop(fresh(), false).state === 'none', 'start: began with no Rinnshop')
ok(onShop(fresh(), true).state === 'active' && onShop(fresh(), true).step === 0, 'start: a standing Rinnshop did not start the quest')
const done = migrate(null)
ok(onShop(done, true) === done, 'start: a keeper who already has the stick was put back on the quest')

// steps: done at the right place, the last one grants
const act = onShop(fresh(), true)
ok(currentStep(act)?.id === RINQUEST_STEPS[0].id, 'step: the first step is not current')
let q = act, granted = false
for (let i = 0; i < RINQUEST_STEPS.length; i++) { const r = doStep(q, RINQUEST_STEPS[i].at); q = r.q; granted = r.granted || granted }
ok(q.state === 'done' && granted, 'step: walking every step did not grant the stick')
ok(doStep(fresh(), 'rinnshop').granted === false && doStep(fresh(), 'rinnshop').q.state === 'none', 'step: the bench granted a stick before the quest started')
ok(doStep(done, 'rinnshop').granted === false, 'step: a done quest granted twice')

// lines + journal
ok(noStickLine(fresh()) === RINQUEST_LINES.noShop && noStickLine(act) === RINQUEST_LINES.inQuest, 'line: the no-stick line does not point the right way')
ok(questEntries(fresh()).length === 0, 'journal: a line before the Rinnshop stands (the rinning pointer covers it)')
ok(questEntries(act)[0]?.title === RINQUEST_STEPS[0].title && !questEntries(act)[0].struck, 'journal: the open step is not shown')
ok(!!questEntries(q)[0]?.struck, 'journal: the done quest is not struck')
const noStick = skillPointerEntries({ rinning: false, prospecting: false }, false)[0], withStick = skillPointerEntries({ rinning: false, prospecting: false })[0]
ok(noStick.title === RINNSHOP_LINE.title && withStick.title === RINNING_LINE.title, 'pointer: the rinning pointer is not re-aimed at the Rinnshop while there is no stick')

// the save-side gate (rinsticks.ts)
mem.clear()
ok(loadTools().rinning?.toolId === 'worn_rinstick', 'gate: an old save (no flag) lost its worn rinstick')
markBornWithoutStick()
ok(!loadTools().rinning && !!loadTools().forestry && !!loadTools().prospecting, 'gate: a new keeper got the worn rinstick, or lost the blade/spike')
// a better rinstick in the save is never taken, and wearing it out leaves an unearned keeper empty-handed
mem.set('open.tools.v1', JSON.stringify({ rinning: { toolId: 'basic_rinstick', usesRemaining: 1, speedBonus: 1, xpBonus: 1.05 } }))
ok(loadTools().rinning?.toolId === 'basic_rinstick', 'gate: an upgraded rinstick was taken off an unearned keeper')
ok(!wearRinstick(loadTools()).tools.rinning, 'gate: a worn-out upgrade handed an unearned keeper the worn rinstick')
saveQuest({ v: 1, state: 'done', step: RINQUEST_STEPS.length })
ok(wearRinstick(loadTools()).tools.rinning?.toolId === 'worn_rinstick', 'gate: an earned keeper did not get the worn one back')
mem.delete('open.tools.v1')
ok(loadTools().rinning?.toolId === 'worn_rinstick', 'gate: finishing the quest did not put the worn rinstick in hand')

if (fails.length) { console.error(`rinquest: ${pass} pass, ${fails.length} FAIL\n  ` + fails.join('\n  ')); process.exit(1) }
console.log(`rinquest: ${pass} pass, 0 fail`)
