// node test: npx tsx src/app/shimmer/open/shared/morel.test.ts
import { ammoStep, newAmmoWatch, gemGlow, _resetGem, RED_AT, BUBBLE_HOLD, FADE, PULSE } from './morel'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

// a 12-round clip, fired one round a tick with the trigger held
_resetGem()
const w = newAmmoWatch(12)
const says: string[] = []
let t = 0
for (let n = 11; n >= 0; n--) { t += 0.2; const r = ammoStep(w, { ammo: n, clip: 12, firing: true, reloading: false, now: t }); if (r.say) says.push(`${r.say}@${n}`) }
ok(says.join(',') === `low@${RED_AT},empty@0`, `one 'low' when crossing ${RED_AT}, one 'empty' at 0, nothing per shot (${says.join(',')})`)
let r = ammoStep(w, { ammo: 0, clip: 12, firing: true, reloading: false, now: t + 0.2 })
ok(r.say === null, 'held trigger on an empty clip does not repeat empty')
ok(r.bubble.show && r.bubble.red && r.bubble.n === 0, 'bubble: shows while held, red when low')

// release: holds BUBBLE_HOLD, then fades over FADE
const rel = t + 0.2
r = ammoStep(w, { ammo: 0, clip: 12, firing: false, reloading: false, now: rel + BUBBLE_HOLD - 0.1 })
ok(r.bubble.show && r.bubble.alpha === 1, `bubble holds ${BUBBLE_HOLD} s after release`)
r = ammoStep(w, { ammo: 0, clip: 12, firing: false, reloading: false, now: rel + BUBBLE_HOLD + FADE / 2 })
ok(r.bubble.alpha > 0 && r.bubble.alpha < 1, 'then fades')
r = ammoStep(w, { ammo: 0, clip: 12, firing: false, reloading: false, now: rel + BUBBLE_HOLD + FADE + 0.01 })
ok(!r.bubble.show, 'and is gone')

// reload re-arms; red only at RED_AT and under
r = ammoStep(w, { ammo: 12, clip: 12, firing: false, reloading: false, now: 50 })
ok(r.say === null && !r.bubble.red, 'reload: silent, not red')
r = ammoStep(w, { ammo: RED_AT + 1, clip: 12, firing: true, reloading: false, now: 51 })
ok(r.say === null && !r.bubble.red, `${RED_AT + 1} rounds: not red, silent`)
r = ammoStep(w, { ammo: RED_AT, clip: 12, firing: true, reloading: false, now: 51.2 })
ok(r.say === 'low' && r.bubble.red, 'after a reload the low line fires again')

// a small clip (<= RED_AT) never says low (it would say it on the first shot of every clip), only empty
const s = newAmmoWatch(5); const ss: string[] = []
for (let n = 4; n >= 0; n--) { const q = ammoStep(s, { ammo: n, clip: 5, firing: true, reloading: false, now: 60 + n }); if (q.say) ss.push(q.say) }
ok(ss.join(',') === 'empty', `a 5-round clip: only 'empty' (${ss.join(',')})`)

// the gem pulses on a round change, then goes quiet
_resetGem()
const g = newAmmoWatch(12); ammoStep(g, { ammo: 11, clip: 12, firing: true, reloading: false, now: 100 })
ok(gemGlow(100) === 1 && gemGlow(100 + PULSE / 2) > 0 && gemGlow(100 + PULSE + 0.01) === 0, 'gem pulses on a round change, then fades')

console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
