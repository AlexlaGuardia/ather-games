// The guide trail's pointer — pure oracle over the tutorial's states.
import { guideTarget, type GuideWorld } from './guide-target'
import { HAZEL_STACK, type TutorialState } from './tutorial'
import { FOLK_IDS } from './folk'
import { GUIDE_LOOK } from './guide-trail'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const W: GuideWorld = {
  greg: { x: 0, z: 0 },
  folk: { hazel: { x: 10, z: 0 }, sax: { x: 30, z: 0 }, yarrow: { x: 0, z: 20 }, fennel: { x: -15, z: 0 }, mallow: { x: 0, z: -40 } },
  sawmill: { x: 12, z: 2 },
  nearestLog: { x: 5, z: 5 },
}
const at = { x: 1, z: 1 }
const none = { logs: 0, planks: 0, hasHazelsBlade: false }
const S = (stage: TutorialState['stage'], met: TutorialState['met'] = [], hazel: TutorialState['hazel'] = 'unmet'): TutorialState => ({ stage, met, hazel })

ok(guideTarget(S('greet'), none, at, W)?.kind === 'greg', 'greet → Greg')
ok(guideTarget(S('doors'), none, at, W)?.kind === 'door', 'doors → a door')
ok(guideTarget(S('doors'), none, at, W)?.x === 10, 'the NEAREST unmet door (Hazel at 10)')
ok(guideTarget(S('doors', ['hazel']), none, at, W)?.x === -15, 'Hazel met → next nearest (Fennel at −15)')
ok(guideTarget(S('doors', ['hazel', 'fennel']), none, at, W)?.z === 20, 'then Yarrow')
ok(guideTarget(S('doors', [...FOLK_IDS]), none, at, W) === null, 'all met, nothing owed → nothing to point at')

// Hazel's errand steps through: log → sawmill → her door
const owed = S('doors', ['hazel'], 'owed')
ok(guideTarget(owed, none, at, W)?.kind === 'log', 'owed, empty-handed → the nearest log')
ok(guideTarget(owed, none, at, { ...W, nearestLog: null }) === null, 'no log in range → no trail (not a wrong one)')
ok(guideTarget(owed, { ...none, logs: 1 }, at, W)?.kind === 'sawmill', 'a log in hand → her sawmill')
ok(guideTarget(owed, { ...none, logs: 1 }, at, { ...W, sawmill: null })?.kind === 'door', 'no sawmill placed → her door')
ok(guideTarget(owed, { ...none, planks: HAZEL_STACK }, at, W)?.x === 10, 'the stack square → Hazel')
ok(guideTarget(S('ask', [...FOLK_IDS], 'owed'), { ...none, planks: HAZEL_STACK }, at, W)?.kind === 'door', 'ask with the errand open → Hazel first')
ok(guideTarget(S('ask', [...FOLK_IDS], 'done'), none, at, W)?.kind === 'greg', 'ask, squared → Greg')
ok(guideTarget(S('lantern', [...FOLK_IDS], 'done'), none, at, W) === null, 'crafting the lantern: no trail, the bag has it all')
const light = guideTarget(S('light', [...FOLK_IDS], 'done'), none, at, W)
ok(light?.kind === 'greg' && light.hideBelow >= 8, 'light → Greg\'s path, gone well before his feet')
ok(guideTarget(S('choice', [...FOLK_IDS], 'done'), none, at, W)?.kind === 'greg', 'choice → Greg')
ok(guideTarget(S('done', [...FOLK_IDS], 'done'), none, at, W) === null, 'done → never again')
for (const s of ['greet', 'doors', 'ask', 'light', 'choice'] as const) {
  const t = guideTarget(S(s, s === 'greet' ? [] : [...FOLK_IDS], s === 'greet' || s === 'doors' ? 'unmet' : 'done'), none, at, W)
  if (t) ok(t.hideBelow >= 3, `${s}: found is found — hides inside ${t.hideBelow}`)
}
ok(GUIDE_LOOK.count <= 128 && GUIDE_LOOK.speed > 0, 'a few dozen motes, moving')

console.log(`guide-target: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
