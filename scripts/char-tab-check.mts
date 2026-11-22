// ── Check for the pack's CHARACTER tab as snap sections (BETA M66 s1, 2026-11-22, play lane) ─────────────────────────
// Seeds a loadout (two guns, a blank bracelet = the birth tactical, a glove with a word), opens the pack's Character tab,
// and asserts: the four sections are there in order; after each fling the scroll rests on a section top (or the end);
// every Armory stats window equals the gun's RANGE_GUNS row; every worn vessel's move shows canon's effect line
// (keeper-moves.ts) word for word; the frame fits the viewport; 0 page errors. Shot to --out.
// s2 (11-22): seeds two met companions (one out); the Companion grid shows every COMPANIONS id once, exactly the met ones in
// colour (data-unlocked=1, enabled) and the rest grey + disabled, the avatar names the one out; tapping the other met one moves
// the avatar to it and writes the save.
//   npx tsx scripts/char-tab-check.mts [--url https://ather.games] [--out /tmp] [--phone]
import puppeteer from 'puppeteer-core'
import { RANGE_GUNS } from '../src/app/shimmer/open/shared/gunplay'
import { KEEPER_MOVES } from '../src/app/shimmer/play3d/keeper-moves'
import { COMPANIONS } from '../src/app/shimmer/open/shared/companion'
const MET = ['dustwhisker', 'glowmite'], COMP = { active: 'dustwhisker', met: MET, sentHome: false }
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const glove = KEEPER_MOVES.find(m => m.tier === 'ultimate')!
const LOADOUT = { v: 1, guns: ['charred-rifle', 'repeater', 'backbone'], primary: 'backbone', secondary: 'repeater', kael: true,
  vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: glove.name }],
  tactical: 'starter-bracelet', signature: 'starter-glove' }
const b = await puppeteer.launch({ protocolTimeout: 180000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
if (phone) await p.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
else await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((lo: string, co: string) => { try {
  if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('open.loadout.v1', lo)
  if (!sessionStorage.getItem('ct-seeded')) { localStorage.setItem('open.companion.v1', co); sessionStorage.setItem('ct-seeded', '1') }
} catch {} }, JSON.stringify(LOADOUT), JSON.stringify(COMP))
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction('!!window.__ather?.state', { timeout: 180000 }); await sleep(3000)
const res: Record<string, unknown> = { phone, glove: glove.id }
if (phone) { await p.touchscreen.tap(195, 600).catch(() => {}); await sleep(1200) }   // the intro card: TAP TO START
await p.keyboard.press('KeyP'); await sleep(1200)
res.panel = await p.evaluate(() => document.querySelector('[data-panel^="pack-"]')?.getAttribute('data-panel') ?? null)
res.sections = await p.evaluate(() => [...document.querySelectorAll('[data-char-section]')].map(e => e.getAttribute('data-char-section')))
await p.screenshot({ path: `${out}/char-tab-${phone ? 'phone' : 'desk'}-1-armory.png` })
// stats == gun data
const stats = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-gun-stats]')].map(e => ({ id: e.dataset.gunStats!, damage: +e.dataset.damage!, crit: +e.dataset.crit!, clip: +e.dataset.clip!, reload: +e.dataset.reload! })))
res.stats = stats
// moves: every worn vessel row with a move shows canon's effect, word for word
const moves = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-vessel-move]')].map(e => ({ slot: e.dataset.vesselMove, move: e.dataset.move, text: e.querySelector('[data-move-text]')?.textContent ?? '' })))
res.moves = moves
// the snap: fling the scroll body three times; after each it must rest on a section top (or the very end)
const flings: { top: number; at: string | null }[] = []
for (let k = 0; k < 3; k++) {
  await p.evaluate(() => { const sc = document.querySelector('[data-panel="pack-character"] .hearth-scroll') as HTMLElement; sc.scrollBy({ top: sc.clientHeight * 0.55, behavior: 'smooth' }) })
  // wait for the smooth scroll AND the snap to settle: two reads 300 ms apart that agree (a phone's snap lands late)
  let last = -1
  for (let w = 0; w < 20; w++) { await sleep(300); const t = await p.evaluate(() => (document.querySelector('[data-panel="pack-character"] .hearth-scroll') as HTMLElement).scrollTop); if (Math.abs(t - last) < 0.5) break; last = t }
  flings.push(await p.evaluate(() => {
    const sc = document.querySelector('[data-panel="pack-character"] .hearth-scroll') as HTMLElement, top = sc.scrollTop, r0 = sc.getBoundingClientRect().top
    const hit = [...sc.querySelectorAll<HTMLElement>('[data-char-section]')].find(s => Math.abs(s.getBoundingClientRect().top - r0) <= 4)
    const atEnd = Math.abs(sc.scrollHeight - sc.clientHeight - top) <= 4
    return { top: Math.round(top), at: hit?.dataset.charSection ?? (atEnd ? '(end)' : null) }
  }))
  await p.screenshot({ path: `${out}/char-tab-${phone ? 'phone' : 'desk'}-${k + 2}.png` })
}
res.flings = flings
// s2: the Companion grid
await p.evaluate(() => document.querySelector('[data-char-section="companion"]')?.scrollIntoView({ block: 'start' })); await sleep(900)
const grid = () => p.evaluate(() => ({ avatar: document.querySelector('[data-companion-avatar]')?.getAttribute('data-companion-avatar'),
  cells: [...document.querySelectorAll<HTMLButtonElement>('[data-companion-grid] [data-cell]')].map(e => ({ id: e.dataset.cell!, on: e.dataset.unlocked === '1', disabled: e.disabled,
    grey: getComputedStyle(e.querySelector('svg')!).filter.includes('grayscale') })) }))
res.grid = await grid()
await p.screenshot({ path: `${out}/char-tab-${phone ? 'phone' : 'desk'}-5-companion.png` })
await p.click('[data-companion-grid] [data-cell="glowmite"]'); await sleep(500)
res.afterTap = await p.evaluate(() => ({ avatar: document.querySelector('[data-companion-avatar]')?.getAttribute('data-companion-avatar'), saved: JSON.parse(localStorage.getItem('open.companion.v1') ?? 'null')?.active }))
res.snap = await p.evaluate(() => getComputedStyle(document.querySelector('[data-panel="pack-character"] .hearth-scroll')!).scrollSnapType)
res.fits = await p.evaluate(() => { const f = document.querySelector('[data-panel^="pack-"]')?.getBoundingClientRect(); return f ? f.left >= 0 && f.right <= window.innerWidth + 0.5 : false })
res.errors = errs.slice(0, 5)
console.log(JSON.stringify(res, null, 1))
const bad: string[] = []
if (res.panel !== 'pack-character') bad.push(`panel ${res.panel}`)
if (JSON.stringify(res.sections) !== JSON.stringify(['armory', 'vessels', 'companion', 'keepers'])) bad.push(`sections ${JSON.stringify(res.sections)}`)
if (stats.length !== 2) bad.push(`${stats.length} stats windows, want 2 (primary + secondary)`)
for (const s of stats) { const g = RANGE_GUNS.find(x => x.id === s.id); if (!g) { bad.push(`no gun ${s.id}`); continue }
  if (s.damage !== g.damage || s.crit !== g.crit || s.clip !== g.clip || s.reload !== g.reloadTime) bad.push(`${s.id} stats ${JSON.stringify(s)} != data`) }
const sig = moves.find(m => m.slot === 'signature'), tac = moves.find(m => m.slot === 'tactical')
if (sig?.move !== glove.id) bad.push(`glove shows ${sig?.move}, want ${glove.id}`)
if (!tac?.move) bad.push('blank bracelet shows no birth tactical')
for (const m of moves) { if (!m.move) continue; const k = KEEPER_MOVES.find(x => x.id === m.move); if (!k || m.text.trim() !== k.effect.trim()) bad.push(`${m.slot} ${m.move} text missing or not canon's`) }
if (!String(res.snap).includes('y')) bad.push(`scroll-snap-type ${res.snap}`)
if (flings.some(f => f.at === null)) bad.push(`a fling rested between sections: ${JSON.stringify(flings)}`)
if (!flings.some(f => f.at !== 'armory')) bad.push('the scroll never moved off Armory')
const g = res.grid as { avatar: string; cells: { id: string; on: boolean; disabled: boolean; grey: boolean }[] }
if (JSON.stringify(g.cells.map(c => c.id)) !== JSON.stringify(COMPANIONS.map(c => c.id))) bad.push(`grid ids ${g.cells.map(c => c.id)} != COMPANIONS`)
for (const c of g.cells) { const met = MET.includes(c.id); if (c.on !== met || c.disabled === met || c.grey === met) bad.push(`cell ${c.id} ${JSON.stringify(c)} (met=${met})`) }
if (g.avatar !== 'dustwhisker') bad.push(`avatar ${g.avatar}, want dustwhisker`)
const at = res.afterTap as { avatar: string; saved: string }
if (at.avatar !== 'glowmite' || at.saved !== 'glowmite') bad.push(`tap glowmite -> ${JSON.stringify(at)}`)
if (!res.fits) bad.push('frame overflows the viewport')
if ((res.errors as string[]).length) bad.push('page errors')
console.log(bad.length ? `FAIL: ${bad.join('; ')}` : 'PASS')
await b.close(); process.exit(bad.length ? 1 : 0)
