// M199: the wide panel layout. Run: npx tsx src/app/shimmer/open/ather/wide-panel.test.ts
import { widePanels, wideSingle, WIDE_MIN, GUTTER, GAP } from './wide-panel'
let bad = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.log('FAIL', m) } }

for (const vw of [390, 430, 759]) { const l = widePanels(vw); ok(!l.wide && l.store <= vw - 2 * GUTTER && l.craft <= 520, `portrait ${vw}: one column, fits (${JSON.stringify(l)})`) }
for (const vw of [WIDE_MIN, 844, 932, 1024, 1280, 1440, 1920, 2560]) {
  const l = widePanels(vw), used = l.store + GAP + l.craft
  ok(l.wide, `${vw}: wide`)
  ok(used <= vw - 2 * GUTTER, `${vw}: both columns fit with the gutters (${l.store} + ${l.craft})`)
  ok(l.store >= 300 && l.store <= 460, `${vw}: store 300..460 (${l.store})`)
  ok(l.craft > l.store, `${vw}: the crafting centre is the wider side (${l.craft} > ${l.store})`)
  ok(l.craft <= 860, `${vw}: the crafting centre stops at 860 (${l.craft})`)
}
// fills the desk before it scrolls: at 1280 the pair spans most of the screen, not two 400 px cards
{ const l = widePanels(1280); ok(l.store + GAP + l.craft >= 1280 * 0.85, `1280: the pair spans >= 85% of the screen (${l.store + GAP + l.craft})`) }
ok(wideSingle(390) <= 390 - 2 * GUTTER && wideSingle(1280) >= 900 && wideSingle(2560) <= 980, `one station: ${wideSingle(390)} / ${wideSingle(1280)} / ${wideSingle(2560)}`)
console.log(`${n - bad}/${n} wide-panel${bad ? ' FAIL' : ''}`)
if (bad) process.exit(1)
