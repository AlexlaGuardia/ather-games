// M184 s2: THE TOOL PANEL. Hover a dial (desktop) and it reacts (grows); click (desktop) / tap (phone 390) opens the tool
// panel with the numbers (hover = Tailwind 4's `scale` + `filter`, not `transform`) the game gathers by (open/ather/tool-panel.ts over gather-dials.ts + TOOL_DEFS). Expected numbers
// are written out here by hand from those tables, so a drift in either side goes red. Fresh anonymous contexts, seeded saves:
//   newborn  -> forestry panel says empty (no rows)
//   gifted   -> Worn Pruner: stage 0, never wears, trees 5 / 10 / 300 / 900 mana, ok ok slow weak;
//               Worn Spike: crystals 7 / 12 / 300 / 1400, ok ok slow weak
//   upgraded -> Shimmeroak Pruner: stage 2, 100 / 100, trees 4 / 9 / 20 / 300, ok ok ok slow
//   npx tsx scripts/m184-panel-check.mts [origin]
import puppeteer, { type Page } from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
// a desktop has a mouse: headless reports (hover: none) and Tailwind 4 gates every hover: on (hover: hover), so the desktop
// browser is told it has one (Blink: hover = 2, fine pointer = 4); the phone keeps the default (no hover, tap)
const MOUSE = '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'
const launch = (mouse: boolean) => puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: mouse ? [...ARGS, MOUSE] : ARGS })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const TUT = (gifts: string[]) => ({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts, b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true })
const CASES = {
  newborn: { tut: TUT([]), quest: { v: 1, state: 'none', step: 0 }, tools: null },
  gifted: { tut: TUT(['pruner', 'spike']), quest: { v: 1, state: 'done', step: 0 }, tools: null },
  upgraded: { tut: TUT(['pruner', 'spike']), quest: { v: 1, state: 'done', step: 0 }, tools: { forestry: { toolId: 'shimmeroak_blade', usesRemaining: 100, speedBonus: 0.85, xpBonus: 1.2 } } },
} as const
type Panel = { fam: string; held: string; stage: string; uses: string; dur: string; name: string; rows: string[] } | null
const readPanel = (p: Page) => p.evaluate(() => {
  const e = document.querySelector('[data-tool-panel]') as HTMLElement | null
  if (!e) return null
  const d = e.dataset
  return { fam: d.toolPanel!, held: d.held!, stage: d.stage!, uses: d.uses!, dur: d.durability!, name: e.querySelector('[data-panel-name]')?.textContent ?? '',
    rows: [...e.querySelectorAll('[data-node-row]')].map(r => { const x = (r as HTMLElement).dataset; return `${x.nodeRow}:${x.mana}:${x.verdict}` }) }
}) as Promise<Panel>
const btn = (fam: string) => `[data-dial-btn="${fam}"]`
async function openPanel(p: Page, fam: string, phone: boolean): Promise<Panel> {
  const el = await p.$(btn(fam)); if (!el) return null
  if (phone) await el.tap(); else await el.click()
  for (let i = 0; i < 10; i++) { await sleep(300); const pn = await readPanel(p); if (pn) return pn }
  return null
}
for (const [vp, w, h] of [['desktop', 1280, 800], ['phone', 390, 844]] as const) {
  const phone = vp === 'phone'
  const br = await launch(!phone)
  for (const [name, c] of Object.entries(CASES)) {
    const p = await (await br.createBrowserContext()).newPage()
    await p.setViewport({ width: w, height: h, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
    await p.evaluateOnNewDocument((c: any) => {
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('open.tutorial.v1', JSON.stringify(c.tut))
      localStorage.setItem('open.rinquest.v1', JSON.stringify(c.quest))
      if (c.tools) localStorage.setItem('open.tools.v1', JSON.stringify(c.tools))
    }, c as any)
    await p.goto(`${origin}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
    for (let i = 0; i < 30; i++) { await sleep(2000); if (await p.$(btn('forestry'))) { await sleep(3000); break } }
    const n = await p.$$eval('[data-dial-btn]', es => es.map(e => (e as HTMLElement).dataset.dialBtn).join(','))
    ok(n === 'forestry,prospecting,rinning', `${vp} ${name}: three dial buttons (${n || 'none'})`)
    if (!phone && n) {
      const before = await p.$eval(btn('forestry'), e => { const c = getComputedStyle(e); return `${c.scale}|${c.filter}` })
      const hit = await p.$eval(btn('forestry'), e => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!t && e.contains(t) })
      ok(hit, `${vp} ${name}: the dial is on top at its centre (not covered)`)
      await p.hover(btn('forestry'))
      // the grow is a 150 ms transition; on a 2 fps swiftshader page it can take a few frames to land
      let after = ''
      for (let i = 0; i < 20; i++) { await sleep(200); after = await p.$eval(btn('forestry'), e => { const c = getComputedStyle(e); return `${c.scale}|${c.filter}|${e.getAnimations().length}` }); if (/^1\.1/.test(after)) break }
      ok(before !== after && /^1\.1/.test(after) && /brightness/.test(after), `${vp} ${name}: hover reacts (${before} -> ${after})`)
    }
    const f = await openPanel(p, 'forestry', phone)
    ok(!!f && f.fam === 'forestry', `${vp} ${name}: ${phone ? 'tap' : 'click'} opens the forestry panel (${JSON.stringify(f)})`)
    if (name === 'newborn') ok(f?.held === '0' && f.rows.length === 0, `${vp} newborn: panel says empty, no node rows`)
    if (name === 'gifted') {
      ok(f?.held === '1' && f.stage === '0' && f.name === 'Worn Pruner' && f.uses === '' , `${vp} gifted: Worn Pruner, stage 0, never wears`)
      ok(f?.rows.join() === 'Goldwood:5:ok,Shimmeroak:10:ok,Starwillow:300:slow,Dawnwood:900:weak', `${vp} gifted: tree rows ${f?.rows.join()}`)
    }
    if (name === 'upgraded') {
      ok(f?.held === '1' && f.stage === '2' && f.name === 'Shimmeroak Pruner' && f.uses === '100' && f.dur === '100', `${vp} upgraded: Shimmeroak Pruner stage 2, 100/100`)
      ok(f?.rows.join() === 'Goldwood:4:ok,Shimmeroak:9:ok,Starwillow:20:ok,Dawnwood:300:slow', `${vp} upgraded: tree rows ${f?.rows.join()}`)
    }
    if (process.env.SHOT_DIR && name === 'upgraded') await p.screenshot({ path: `${process.env.SHOT_DIR}/m184-panel-${vp}.png` }).catch(() => {})   // the panel open
    // the same dial again closes it; then the spike's panel
    const el = await p.$(btn('forestry')); if (el) { if (phone) await el.tap(); else await el.click() }
    await sleep(600)
    ok(!(await readPanel(p)), `${vp} ${name}: the same dial again closes the panel`)
    if (name === 'gifted') {
      const s = await openPanel(p, 'prospecting', phone)
      ok(s?.name === 'Worn Spike' && s.rows.join() === 'Raw Mana:7:ok,Violet / Storm / Earth / Water Crystal:12:ok,Pure Mana Core:300:slow,Ather Crystal:1400:weak', `${vp} gifted: spike rows ${s?.rows.join()}`)
      await p.keyboard.press('Escape'); await sleep(500)
      ok(!(await readPanel(p)), `${vp} gifted: Escape closes it`)
    }
    ok(errs.length === 0, `${vp} ${name}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
    await p.close()
  }
  await br.close()
}
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
