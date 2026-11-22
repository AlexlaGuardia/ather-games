// ⚠ SUPERSEDED by scripts/glade-cluster-check.mts (BETA M67 s1a, 11-22): a newborn now opens their eyes in the CLOSED Glade
// (zone 'glade', Greg's garden), so step 2 below (expects the Wilds) fails by design. Kept for its history; run the new check.
// ── BORN AT MOONWELL, PLAYED (BETA M31, play / Jin 2 16e8df5e, 11-19) ───────────────────────────────────────────────────
// Alex 11-19 at the Redstair runesmith: "the start loses new keepers". A first-time keeper opens their eyes at Moonwell
// Glade beside Greg, not on the plot. In the real page, a fresh profile:
//   1. the birth gate, the real BE BORN tap, the creator, the real Looks good tap
//   2. the first frame is the Wilds (zone 'wilds'), within 10 m of Greg's bench, and FACING him (within 45 deg)
//   3. the journal (real J key) points at him: 'bench by the pool at Moonwell Glade', not 'through the gate'
//   4. a returning keeper (reload, born already) still loads on its plot
//   5. 0 page errors
// Hooks READ only (__ather.zone / state, __greg). Phone: --phone runs it at 390 x 844 with taps.
//   npx tsx scripts/born-moonwell-check.mts [--url https://ather.games] [--phone]
import { mkdirSync } from 'node:fs'
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), out = flag('--out', '')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const tapText = async (p: Page, re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  if (phone) await p.touchscreen.tap(box.x, box.y); else await p.mouse.click(box.x, box.y)
  return true
}
const A = (p: Page, fn: string) => p.evaluate((f: string) => (window as any).__ather?.[f]?.(), fn)
try {
  const p = await (await br.createBrowserContext()).newPage()
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  // 1 · born, then the creator
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 90000), '1. the birth gate shows')
  ok(await tapText(p, /^BE BORN/), '1. tapped BE BORN')
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-creator-done]')), 45000), '1. the creator follows the birth')
  const done = await p.$('[data-creator-done]'); if (done) { if (phone) await done.tap(); else await done.click() }
  ok(await poll(() => p.evaluate(() => !document.querySelector('[data-creator-done]')), 15000), '1. Looks good closes the creator')
  // 2 · the first frame: the Glade, beside Greg, facing him
  ok(await poll(async () => (await A(p, 'zone')) === 'wilds', 120000), `2. first frame is the Wilds (zone ${await A(p, 'zone')})`)
  ok(await poll(() => p.evaluate(() => !!(window as any).__greg), 120000), '2. Greg is drawn (his tile streamed in)')
  const s = await A(p, 'state') as { px: number; pz: number; yaw: number }
  const g = await p.evaluate(() => (window as any).__greg) as { x: number; z: number }
  const d = Math.hypot(g.x - s.px, g.z - s.pz)
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), off = Math.acos(Math.max(-1, Math.min(1, (fx * (g.x - s.px) + fz * (g.z - s.pz)) / Math.max(d, 1e-6)))) * 180 / Math.PI
  ok(d < 10, `2. within 10 m of Greg: ${d.toFixed(1)} m (keeper ${s.px.toFixed(1)},${s.pz.toFixed(1)}; Greg ${g.x.toFixed(1)},${g.z.toFixed(1)})`)
  ok(off < 45, `2. facing Greg: ${off.toFixed(0)} deg off`)
  if (out) { mkdirSync(out, { recursive: true }); await p.screenshot({ path: `${out}/born-${phone ? 'phone' : 'desk'}.png` }) }   // the first look, to LOOK at
  // 3 · the journal points at him (real J; the journal is a keyboard panel, so on phone read its entry text from the store page instead)
  await p.keyboard.press('KeyJ'); await sleep(1500)
  const jt = await p.evaluate(() => document.body.innerText)
  ok(/bench by the pool at Moonwell Glade/i.test(jt), "3. journal: 'Gregory sits on the bench by the pool at Moonwell Glade.'")
  ok(!/just through the gate/i.test(jt), "3. journal: no 'just through the gate'")
  await p.keyboard.press('KeyJ'); await sleep(600)
  // 4 · a returning keeper is not re-born, and a refresh in the Wilds keeps them where they stood ('Where you were', Alex
  // 11-19 0c3fbede, after this check was written: it used to expect the plot)
  const before = await p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px as number, z: s.pz as number } })
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(8000)
  ok(!(await p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))), '4. reload: no birth gate (born already)')
  const after = await p.evaluate(() => { const A = (window as any).__ather, s = A.state(); return { zone: A.zone() as string, x: s.px as number, z: s.pz as number } })
  const moved = Math.hypot(after.x - before.x, after.z - before.z)
  ok(after.zone === 'wilds' && moved < 3, `4. reload: resumes in the Wilds where they stood (zone ${after.zone}, ${moved.toFixed(1)} m off)`)
  ok(errs.length === 0, `5. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
