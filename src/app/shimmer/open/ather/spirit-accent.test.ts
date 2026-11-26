// BETA M204 s2: her glow accent from her bar (spirit-accent.ts). Run: npx tsx src/app/shimmer/open/ather/spirit-accent.test.ts
import { accentOf, accentAt, ACCENT_OPEN_MAX } from './spirit-accent'
import { ELEMENT_COLORS } from '../../spirits/spirit'
import { BAR_SLOTS } from './infusions'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255) }
const lit = (hex: string) => { const c = rgb(hex), m = Math.max(...c); return c.map(v => v / m) }

// 1. no meals = no accent
ok(accentOf(undefined) === null && accentOf([]) === null, '0 meals = no accent')
ok(accentOf(['nonsense', 3]) === null, 'junk in the bar = no accent')
// 2. three earth meals = a partial EARTH glow: the earth slot's hue, lit; 3/10 of the open strength; not locked
const e3 = accentOf(['earth', 'earth', 'earth'])!
ok(!!e3 && e3.n === 3 && !e3.locked, `3 earth: n 3, open (${JSON.stringify(e3)})`)
ok(near(e3.s, ACCENT_OPEN_MAX * 0.3), `3 earth: strength 0.3 x open max (${e3.s})`)
ok(lit(ELEMENT_COLORS.earth).every((v, i) => near(v, e3.rgb[i])), `3 earth: the bar's earth colour, lit (${e3.rgb})`)
ok(Math.max(...e3.rgb) === 1, 'the accent is lit: brightest channel 1')
// 3. grows meal by meal, never past the lock
let last = 0
for (let n = 1; n <= BAR_SLOTS; n++) { const a = accentOf(Array(n).fill('water'))!; ok(a.s > last, `strength grows at ${n} meals (${last} -> ${a.s})`); last = a.s }
ok(last === 1, 'a full bar = strength 1')
// 4. a MIXED 10-meal bar = locked, the colours mixed by count
const mix = ['mana', 'storm', 'earth', 'earth', 'water', 'water', 'water', 'mana', 'storm', 'earth'] as const
const m10 = accentOf([...mix])!
ok(m10.locked && m10.n === 10 && m10.s === 1, `mixed 10: locked, full (${JSON.stringify(m10)})`)
const sum = [0, 0, 0]; for (const el of mix) rgb(ELEMENT_COLORS[el]).forEach((v, i) => { sum[i] += v })
const top = Math.max(...sum)
ok(sum.every((v, i) => near(v / top, m10.rgb[i])), `mixed 10: count-weighted mix of the slot colours (${m10.rgb})`)
ok(m10.hex !== accentOf(['water'])!.hex && m10.hex !== e3.hex, 'mixed is neither pure water nor pure earth')
// 5. locked = can't change: anything past the 10th is ignored; the order fed does not change the colour
ok(accentOf([...mix, 'earth', 'earth', 'earth'])!.hex === m10.hex, 'past 10 nothing changes her accent')
ok(accentOf([...mix].reverse())!.hex === m10.hex, 'the mix is the counts, not the order')
// 5b. every colour fed shows: the slots in feed order, each the bar's own colour lit
ok(m10.slots.length === 10 && m10.slots.every((c, i) => lit(ELEMENT_COLORS[mix[i]]).every((v, j) => near(v, c[j]))), 'the slots: each meal\'s colour, in feed order')
// 6. per frame: an open accent breathes round its strength, a locked one holds
ok(accentAt(null, 3) === 0, 'no accent = 0 every frame')
ok(accentAt(m10, 0.3) === 1 && accentAt(m10, 1.7) === 1, 'locked: steady')
const sv = [0, 0.4, 0.9, 1.4].map(t => accentAt(e3, t))
ok(Math.min(...sv) < e3.s && Math.max(...sv) > e3.s && Math.max(...sv) < 2 * e3.s, `open: breathes round its strength (${sv.map(v => v.toFixed(3))})`)

if (fails.length) { console.log(fails.map(f => `FAIL ${f}`).join('\n')); console.log(`${pass} passed, ${fails.length} failed`); process.exit(1) }
console.log(`spirit-accent.test: ${pass} passed, 0 failed`)
