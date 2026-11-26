// M184 s1: THE TOOL DIALS. Three dials by the mana orb (desktop: data-socket; phone 390: data-pip on the lip), EMPTY until
// the friend hands the worn tool, then the stage (0 worn, 1..3 the crafted tiers) and an upgrade's border ring (the arc =
// durability left; full today, M133 tools are permanent). Each case is a fresh browser context with a seeded save:
//   newborn (tutorial live, no gifts, rinstick quest not started) -> 3 dials, all empty
//   gifted  (Bonn's pruner + Otto's spike, rinstick earned)      -> 3 dials, all held, stage 0, no ring
//   upgraded (a Shimmeroak Pruner in the save)                    -> forestry stage 2, NO ring (M185 s1: tint only, Alex 11-26)
//   npx tsx scripts/m184-dials-check.mts [origin]
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const TUT = (gifts: string[]) => ({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts, b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true })
const CASES = {
  newborn: { tut: TUT([]), quest: { v: 1, state: 'none', step: 0 }, tools: null },
  gifted: { tut: TUT(['pruner', 'spike']), quest: { v: 1, state: 'done', step: 0 }, tools: null },
  upgraded: { tut: TUT(['pruner', 'spike']), quest: { v: 1, state: 'done', step: 0 }, tools: { forestry: { toolId: 'shimmeroak_blade', usesRemaining: 100, speedBonus: 0.85, xpBonus: 1.2 } } },
} as const
type Dial = { fam: string; held: string; stage: string; ring: string; tool: string }
for (const [vp, w, h, sel] of [['desktop', 1280, 800, '[data-socket]'], ['phone', 390, 844, '[data-pip]']] as const) {
  for (const [name, c] of Object.entries(CASES)) {
    const p = await (await br.createBrowserContext()).newPage()
    await p.setViewport({ width: w, height: h, ...(vp === 'phone' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
    await p.evaluateOnNewDocument((c: any) => {
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('open.tutorial.v1', JSON.stringify(c.tut))
      localStorage.setItem('open.rinquest.v1', JSON.stringify(c.quest))
      if (c.tools) localStorage.setItem('open.tools.v1', JSON.stringify(c.tools))
    }, c as any)
    await p.goto(`${origin}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
    let dials: Dial[] = []
    for (let i = 0; i < 30; i++) {
      await sleep(2000)
      dials = await p.evaluate((sel: string) => [...document.querySelectorAll(sel)].map(e => {
        const d = (e as HTMLElement).dataset
        return { fam: d.socket ?? d.pip ?? '', held: d.held ?? '', stage: d.stage ?? '', ring: d.ring ?? '', tool: d.tool ?? '' }
      }), sel)
      if (dials.length && dials.every(d => d.held !== '')) { await sleep(3000); break }
    }
    dials = await p.evaluate((sel: string) => [...document.querySelectorAll(sel)].map(e => {
      const d = (e as HTMLElement).dataset
      return { fam: d.socket ?? d.pip ?? '', held: d.held ?? '', stage: d.stage ?? '', ring: d.ring ?? '', tool: d.tool ?? '' }
    }), sel)
    const fams = dials.map(d => d.fam).join(',')
    ok(fams === 'forestry,prospecting,rinning', `${vp} ${name}: three dials (${fams || 'none'})`)
    if (name === 'newborn') ok(dials.length === 3 && dials.every(d => d.held === '0'), `${vp} newborn: all three EMPTY (${dials.map(d => d.held).join('')})`)
    if (name === 'gifted') ok(dials.length === 3 && dials.every(d => d.held === '1' && d.stage === '0'), `${vp} gifted: all three held, worn (${dials.map(d => d.held + ':' + d.stage).join(' ')})`)
    if (name === 'upgraded') {
      const f = dials.find(d => d.fam === 'forestry')
      ok(f?.held === '1' && f.stage === '2', `${vp} upgraded: forestry stage 2 (${JSON.stringify(f)})`)
      // ★ MOVED BY RULING (Alex 11-26, BETA 51fe8cda; M185 s1): steps 1-3 are TINT ONLY, the ring belongs to a fitted metal tip
      // (M134, not built). This assert said "wears its border ring, full" until then; it now says there is none.
      const arc = await p.evaluate((sel: string) => !!document.querySelector(`${sel.slice(0, -1)}="forestry"] [data-ring-arc]`), sel)
      ok(!arc, `${vp} upgraded: no ring on a stage-2 dial (tint only, the ring is the tip's)`)
      ok(!f?.ring, `${vp} upgraded: no ring value (${f?.ring})`)
    }
    ok(errs.length === 0, `${vp} ${name}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
    await p.close()
  }
}
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
