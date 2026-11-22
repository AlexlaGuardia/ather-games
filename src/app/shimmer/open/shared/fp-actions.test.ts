// shared/fp-actions.ts (BETA M82): an action is a loop of key poses; sampling lands ON each key once its move is done, eases
// between them, wraps when looping and clamps as a one-shot; the draft survives a reload and junk never loads; and the pose
// stepper hands the right mitt to an action at weight 1 and leaves it alone at weight 0.
//   npx tsx src/app/shimmer/open/shared/fp-actions.test.ts
import { ACTION_DEFAULTS, ACTION_IDS, ACTIONS, ACTIONS_KEY, oneShot, FADE_MS, sampleAction, actionDuration, keyStart, cleanAction, loadActions, setAction, resetAction, exportAction, type HandAction } from './fp-actions'
import { newFpState, stepFpHands, angleQ, eulerQ, type FpInput } from './fp-hands-pose'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e

const key = (x: number, ms: number, hold: number, ease: 'linear' | 'in' | 'out' | 'inout' = 'linear') => ({ x, y: -x, z: -0.5, pitch: x, roll: 0, yaw: 0, ms, hold, ease })
const A: HandAction = { id: 'rinstick.cast', item: 'rinstick', label: 't', keys: [key(0, 100, 50), key(1, 200, 0), key(2, 100, 100)] }

// ── timing ──
ok(actionDuration(A) === 550, `loop duration 550 (${actionDuration(A)})`)
ok(actionDuration(A, false) === 450, `one-shot skips the first move: 450 (${actionDuration(A, false)})`)
ok(keyStart(A, 0) === 0 && keyStart(A, 1) === 150 && keyStart(A, 2) === 350, 'key starts 0 / 150 / 350')

// ── lands on each key when its move is done, holds there ──
for (let i = 0; i < 3; i++) {
  const t = keyStart(A, i) + A.keys[i].ms, p = sampleAction(A, t)
  ok(near(p.x, A.keys[i].x) && near(p.y, A.keys[i].y), `key ${i} reached at ${t} ms (x ${p.x})`)
}
ok(near(sampleAction(A, 120).x, 0), 'holds key 0 through its hold')
// ── between keys: linear midway is the midpoint; an eased move is not ──
ok(near(sampleAction(A, 150 + 100).x, 0.5), `linear midway = 0.5 (${sampleAction(A, 250).x})`)
const E: HandAction = { ...A, keys: [A.keys[0], { ...A.keys[1], ease: 'in' }, A.keys[2]] }
ok(near(sampleAction(E, 250).x, 0.25), `ease-in midway = 0.25 (${sampleAction(E, 250).x})`)
ok(near(sampleAction({ ...A, keys: [A.keys[0], { ...A.keys[1], ease: 'out' }, A.keys[2]] }, 250).x, 0.75), 'ease-out midway = 0.75')
// orientation slerps with the same weight: halfway in angle at the linear midpoint
const p0 = sampleAction(A, 150), pm = sampleAction(A, 250), p1 = sampleAction(A, 350)
ok(near(angleQ(p0.q, pm.q), angleQ(pm.q, p1.q), 1e-6), 'orientation halfway at the midpoint')
// ── the loop: key 0's move comes from the last key, and the clock wraps ──
ok(near(sampleAction(A, 50).x, 1), `looping: key 0 moves in from key 2 (x ${sampleAction(A, 50).x})`)
ok(near(sampleAction(A, 550 + 250).x, sampleAction(A, 250).x) && near(sampleAction(A, -300).x, sampleAction(A, 250).x), 'wraps both ways')
// ── one-shot: starts ON key 0, clamps on the last ──
ok(near(sampleAction(A, 0, false).x, 0) && near(sampleAction(A, 25, false).x, 0), 'one-shot starts on key 0')
ok(near(sampleAction(A, 5000, false).x, 2), 'one-shot stays on the last key')
ok(near(sampleAction(A, 50 + 100, false).x, 0.5), 'one-shot midway key0->key1')
// zero-length moves never divide by zero
const Z: HandAction = { ...A, keys: [key(0, 0, 0), key(1, 0, 0)] }
ok(Number.isFinite(sampleAction(Z, 0).x) && Number.isFinite(sampleAction(Z, 3).x), 'all-zero timings stay finite')

// ── the shipped defaults: every action has >=2 keys and a finite loop ──
for (const id of ACTION_IDS) { const a = ACTION_DEFAULTS[id]; ok(a.id === id && a.keys.length >= 2 && actionDuration(a) > 0, `${id} shipped sane`) }
ok(ACTION_IDS.includes('rinstick.cast') && ACTION_IDS.includes('melee.swing'), 'rinstick cast + melee swing shipped')

// ── cleaning a pasted / stored action ──
const base = ACTION_DEFAULTS['rinstick.cast']
const junk = cleanAction({ keys: [{ x: 'no', y: NaN, ms: -5, ease: 'wobble' }, null] }, base)
ok(junk.keys.length === 2 && junk.keys[0].x === base.keys[0].x && junk.keys[0].ms === 0 && junk.keys[0].ease === 'linear', 'junk keys fall back field by field')
ok(cleanAction({ keys: [] }, base).keys.length === base.keys.length, 'no keys -> the defaults')
ok(cleanAction({ id: 'evil', item: 'melee', keys: base.keys }, base).id === base.id, 'id / item come from the base, never the paste')

// ── the draft: saved, survives a reload, resets ──
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
const edited = { ...ACTIONS['rinstick.cast'], keys: [...ACTIONS['rinstick.cast'].keys, key(0.2, 300, 0)] }
setAction(edited)
ACTIONS['rinstick.cast'] = { ...base, keys: [] }   // "reload": wipe the live copy
loadActions()
ok(ACTIONS['rinstick.cast'].keys.length === base.keys.length + 1 && near(ACTIONS['rinstick.cast'].keys.at(-1)!.x, 0.2), 'reload keeps the draft')
ok(ACTIONS['melee.swing'].keys.length === ACTION_DEFAULTS['melee.swing'].keys.length, 'an untouched action loads the default')
store.set(ACTIONS_KEY, '{not json'); loadActions()
ok(ACTIONS['rinstick.cast'].keys.length === base.keys.length, 'a corrupt draft loads the defaults')
setAction(edited); resetAction('rinstick.cast'); loadActions()
ok(ACTIONS['rinstick.cast'].keys.length === base.keys.length, 'reset survives a reload')
ok(ACTIONS['rinstick.cast'].keys !== ACTION_DEFAULTS['rinstick.cast'].keys, 'live copy never aliases the shipped defaults')
const ex = JSON.parse(exportAction(edited))
ok(ex.id === 'rinstick.cast' && ex.keys.length === edited.keys.length && cleanAction(ex, base).keys.length === edited.keys.length, 'export round-trips')

// ── the pose stepper: weight 1 hands the right mitt to the action, weight 0 leaves it alone ──
const target = { x: 0.1, y: -0.2, z: -0.7, pitch: -0.5, roll: 0.2, q: eulerQ(-0.5, 0.3, 0.2) }
const run = (w: number | null) => {
  const s = newFpState()
  const i: FpInput = { now: 0, speed: 0, airborne: false, hidden: false, castAt: -Infinity, working: false, ...(w === null ? {} : { actionR: { ...target, w } }) }
  for (let n = 0; n < 200; n++) stepFpHands(s, i, 0.05)
  return s
}
const on = run(1), off = run(0), none = run(null)
ok(near(on.R.x, target.x, 1e-6) && near(on.R.y, target.y, 1e-6) && near(on.R.z, target.z, 1e-6), `w=1: the mitt sits on the action (${on.R.x.toFixed(4)}, ${on.R.y.toFixed(4)})`)
ok(angleQ(on.R.q, target.q) < 1e-4, `w=1: the mitt is turned as the action (${angleQ(on.R.q, target.q)})`)
ok(near(off.R.x, none.R.x) && near(off.R.y, none.R.y) && angleQ(off.R.q, none.R.q) < 1e-9, 'w=0: identical to no action')
ok(near(on.L.x, none.L.x) && near(on.L.y, none.L.y), 'the left hand is never touched')
const half = run(0.5)
ok(near(half.R.x, (none.R.x + target.x) / 2, 1e-6), 'w=0.5: halfway')

// ── oneShot (M82 s2): the game's cast plays once from the click, full weight, then hands the mitt back ──
{

  const d = actionDuration(A, false)
  ok(oneShot(A, -1) === undefined && oneShot(A, -Infinity) === undefined && oneShot(A, NaN) === undefined, 'oneShot: nothing before the cast')
  ok(oneShot(A, 0)?.w === 1 && near(oneShot(A, 0)!.x, 0), 'oneShot: starts ON key 1 at full weight')
  ok(oneShot(A, d)?.w === 1 && near(oneShot(A, d)!.x, 2), 'oneShot: ends on the last key at full weight')
  ok(near(oneShot(A, d + FADE_MS / 2)!.w, 0.5), 'oneShot: half faded halfway through the fade')
  ok(oneShot(A, d + FADE_MS) === undefined, 'oneShot: gone once faded')
  ok(near(oneShot(A, 50 + 100)!.x, sampleAction(A, 150, false).x), 'oneShot samples the one-shot clock')
  const cast = ACTION_DEFAULTS['rinstick.cast'], flick = keyStart(cast, 2, false) + cast.keys[2].ms
  ok(flick <= 400, `the shipped cast's flick lands by 400 ms (the float leaves on the click): ${flick} ms`)
  const sw = ACTION_DEFAULTS['melee.swing'], hit = keyStart(sw, 2, false) + sw.keys[2].ms
  ok(hit <= 250, `the shipped swing's hit lands by 250 ms (the hit counts on the click): ${hit} ms`)
  ok(actionDuration(sw, false) <= 420, `the whole swing fits the 420 ms swing cooldown: ${actionDuration(sw, false)} ms`)
}

console.log(`fp-actions: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
