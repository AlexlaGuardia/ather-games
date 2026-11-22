// ── Check for the pack's SKILLS tab (BETA M64, 2026-11-22, play lane) ─────────────────────────────────────────────
// Seeds a known open-world skill save, opens the pack on the Ather (U key on desktop; on --phone the bag button route is
// skipped and the header tab is TAPPED from the Bag), and asserts every skill row shows the seeded level + xp, the bar
// width matches xp/need, the save is unchanged after viewing (read-only), and 0 page errors. Shot to --out.
//   npx tsx scripts/skills-tab-check.mts [--url https://ather.games] [--out /tmp] [--phone]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const SEED = [
  { id: 'farming', level: 1, xp: 0 }, { id: 'forestry', level: 4, xp: 37 }, { id: 'prospecting', level: 2, xp: 11 },
  { id: 'rinning', level: 3, xp: 5 }, { id: 'alchemy', level: 1, xp: 20 }, { id: 'mana', level: 1, xp: 0 },
]
const b = await puppeteer.launch({ protocolTimeout: 180000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
if (phone) await p.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
else await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((seed: string) => { try {
  if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star')
  if (!sessionStorage.getItem('skills-seeded')) { localStorage.setItem('open.skills.v1', seed); sessionStorage.setItem('skills-seeded', '1') }
} catch {} }, JSON.stringify(SEED))
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction('!!window.__ather?.state', { timeout: 180000 }); await sleep(3000)
const res: Record<string, unknown> = { phone }
if (phone) {
  // the intro card says TAP TO START: tap it away (don't hide it by text)
  await p.touchscreen.tap(195, 600).catch(() => {}); await sleep(1200)
  // open the pack the way a phone keeper does: the bag button, then TAP the Skills icon in the header
  const bagBtn = await p.evaluate(() => { const el = [...document.querySelectorAll<HTMLElement>('button,[role=button]')].find(e => /bag/i.test(e.getAttribute('aria-label') ?? '') || e.hasAttribute('data-hud-bag')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  res.bagButton = !!bagBtn
  if (bagBtn) { await p.touchscreen.tap(bagBtn.x, bagBtn.y); await sleep(900) }
  else { await p.keyboard.press('KeyI'); await sleep(900) }
  // the frame scales in: measure the tab AFTER it settles, and re-measure + re-tap if the first tap landed mid-motion
  for (let k = 0; k < 3; k++) {
    await sleep(600)
    const tab = await p.evaluate(() => { const r = document.querySelector('[data-pack-tab="skills"]')?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })
    res.tabFound = !!tab
    if (tab) { await p.touchscreen.tap(tab.x, tab.y); await sleep(900) }
    if (await p.evaluate(() => !!document.querySelector('[data-panel="pack-skills"]'))) { res.taps = k + 1; break }
  }
} else {
  await p.keyboard.press('KeyU'); await sleep(900)
}
res.panel = await p.evaluate(() => document.querySelector('[data-panel^="pack-"]')?.getAttribute('data-panel') ?? null)
const rows = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-skills] [data-skill]')].map(e => {
  const bar = e.querySelector<HTMLElement>('.rounded-full > .rounded-full'), track = bar?.parentElement
  return { id: e.dataset.skill, level: Number(e.dataset.level), xp: Number(e.dataset.xp), need: Number(e.dataset.need),
    text: e.textContent, barPct: bar && track ? bar.getBoundingClientRect().width / track.getBoundingClientRect().width : -1 }
}))
res.rows = rows
// the panel fits the phone: no horizontal overflow of the frame
res.fits = await p.evaluate(() => { const f = document.querySelector('[data-panel^="pack-"]')?.getBoundingClientRect(); return f ? f.left >= 0 && f.right <= window.innerWidth + 0.5 : false })
await p.screenshot({ path: `${out}/skills-tab-${phone ? 'phone' : 'desk'}.png` })
// read-only: the save is byte-identical after viewing
res.saveAfter = await p.evaluate(() => localStorage.getItem('open.skills.v1'))
// keyboard: U again closes (desktop)
if (!phone) { await p.keyboard.press('KeyU'); await sleep(600); res.closedByU = await p.evaluate(() => !document.querySelector('[data-panel^="pack-"]')) }
res.errors = errs.slice(0, 5)
console.log(JSON.stringify(res, null, 1))
const bad: string[] = []
if (res.panel !== 'pack-skills') bad.push(`panel ${res.panel}`)
if (rows.length !== SEED.length) bad.push(`${rows.length} rows, want ${SEED.length}`)
for (const s of SEED) {
  const r = rows.find(x => x.id === s.id)
  if (!r) { bad.push(`no row ${s.id}`); continue }
  if (r.level !== s.level || r.xp !== s.xp) bad.push(`${s.id} shows lv${r.level} ${r.xp}xp, save lv${s.level} ${s.xp}xp`)
  if (!r.text?.includes(`Lv ${s.level}`)) bad.push(`${s.id} text lacks Lv ${s.level}`)
  if (Math.abs(r.barPct - s.xp / r.need) > 0.02) bad.push(`${s.id} bar ${r.barPct.toFixed(3)} vs ${(s.xp / r.need).toFixed(3)}`)
}
if (JSON.stringify(JSON.parse(String(res.saveAfter))) !== JSON.stringify(SEED)) bad.push('save changed by viewing')
if (!res.fits) bad.push('frame overflows the viewport')
if (!phone && !res.closedByU) bad.push('U did not close')
if ((res.errors as string[]).length) bad.push('page errors')
console.log(bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS')
await b.close(); process.exit(bad.length ? 1 : 0)
