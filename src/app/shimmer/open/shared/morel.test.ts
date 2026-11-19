// node test: npx tsx src/app/shimmer/open/shared/morel.test.ts
import { ammoStep, newAmmoWatch, gemGlow, _resetGem, RED_AT, BUBBLE_HOLD, FADE, PULSE, SHOT_GRACE, hintStep, newHintWatch, STALL, COOL, AWAY, AWAY_M, MAX_HINTS } from './morel'
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

// a semi-auto tap: the trigger is never seen held, but a round leaving shows the bubble (wall-clock grace), then it holds
{
  const s2 = newAmmoWatch(12)
  let q = ammoStep(s2, { ammo: 11, clip: 12, firing: false, reloading: false, now: 200 })
  ok(q.bubble.show && q.bubble.alpha === 1 && q.bubble.n === 11, 'a tap (no held trigger seen) still shows the bubble')
  q = ammoStep(s2, { ammo: 11, clip: 12, firing: false, reloading: false, now: 200 + SHOT_GRACE + BUBBLE_HOLD + FADE + 0.05 })
  ok(!q.bubble.show, 'and it is gone hold + fade after that round, in wall time')
}

// ── S2 stuck hints ──
{
  const h = newHintWatch(); const got: string[] = []
  const run = (from: number, to: number, o: { stage?: 'greg' | 'smith'; active?: boolean; dist?: (t: number) => number | null } = {}) => {
    for (let t = from; t <= to; t += 1) { const r = hintStep(h, { stage: o.stage ?? 'greg', now: t, active: o.active ?? true, dist: o.dist ? o.dist(t) : null }); if (r) got.push(`${r.i}${r.why[0]}@${t}`) }
  }
  run(0, STALL - 2)
  ok(got.length === 0, `no hint before ${STALL} s idle`)
  run(STALL - 1, STALL + 2)
  ok(got.length === 1 && got[0].startsWith('0s'), `one stall hint at ~${STALL} s (${got.join(',')})`)
  run(STALL + 3, STALL + COOL - 2)
  ok(got.length === 1, `quiet through the cooldown (${COOL} s)`)
  run(STALL + COOL - 1, STALL + COOL + STALL + 5)
  ok(got.length === 2 && got[1].startsWith('1'), `the second hint is the other line (${got.join(',')})`)
  run(STALL * 2 + COOL + 6, STALL * 4 + COOL * 3)
  ok(got.length === MAX_HINTS, `never more than ${MAX_HINTS} per stage (${got.length})`)
  run(STALL * 4 + COOL * 3 + 1, STALL * 4 + COOL * 3 + 2, { stage: 'smith' })
  ok(got.length === MAX_HINTS, 'progress (a new stage) says nothing by itself')
  const before = got.length
  run(STALL * 5 + COOL * 4, STALL * 5 + COOL * 4 + STALL * 3, { stage: 'smith', active: false })
  ok(got.length === before, 'paused (menu up / tab hidden / a fight) never counts as stuck')
}
{
  const h = newHintWatch(); const got: string[] = []
  hintStep(h, { stage: 'greg', now: 0, active: true, dist: 20 })
  for (let t = 1; t <= AWAY + 5; t++) { const r = hintStep(h, { stage: 'greg', now: t, active: true, dist: 20 + t * 0.5 }); if (r) got.push(`${r.why}@${t}`) }
  ok(got.length === 1 && got[0].startsWith('away'), `walking away for ~${AWAY} s (> ${AWAY_M} m further) -> one 'away' hint (${got.join(',')})`)
  const h2 = newHintWatch(); const g2: string[] = []
  hintStep(h2, { stage: 'greg', now: 0, active: true, dist: 60 })
  for (let t = 1; t <= AWAY + 5; t++) { const r = hintStep(h2, { stage: 'greg', now: t, active: true, dist: Math.max(3, 60 - t) }); if (r) g2.push(`${r.why}@${t}`) }
  ok(g2.length === 0, 'walking TOWARD the mark: no hint')
}

console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
