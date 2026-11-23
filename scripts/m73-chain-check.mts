// ── THE OPENING CHAIN, PLAYED (BETA M73 s1, play-M73, 11-23) ─────────────────────────────────────────────────────────────
// In the real page, two fresh born keepers (separate browser contexts, phone 390x844):
//   A. the note is in the bag; fall once (hook __ather.fall = the fight's 'down') -> while the pack lies, Morel says nothing;
//      walk back onto the pack -> Morel's ping on the HUD WORD FOR WORD, once; RELOAD -> no second ping (state says pinged)
//   B. open the bag, read the note -> its text WORD FOR WORD, The Dig on, no ping owed; open the gate -> Morel's gate hint
//      word for word, the Flip map button pulses; flip -> it stops, Rune Hold's door pulses; a fall + pack back -> no ping
//   0 page errors.
// SETUP (stated): born keeper (birthRune) only. Hooks: __ather.fall / tp / state / pack / zone / open (movement + panel
// open + reads); __chain.state / said (READ only).   npx tsx scripts/m73-chain-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { KAEL_INVITE_TEXT } from '../src/app/shimmer/open/shared/kael-invite-lines'
import { MOREL_PING, MOREL_DIG_HINT } from '../src/app/shimmer/open/shared/morel-lines'
import { KAEL_INVITE } from '../src/app/shimmer/open/shared/opening-chain'
import { INV_KEY } from '../src/app/shimmer/open/shared/inventory'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []

async function keeper(tag: string) {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: false })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* */ } })
  return p
}
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const W = (p: Page) => ({
  zone: () => p.evaluate(() => (window as any).__ather?.zone?.() ?? null) as Promise<string | null>,
  chain: () => p.evaluate(() => (window as any).__chain?.state?.() ?? null) as Promise<any>,
  said: () => p.evaluate(() => (window as any).__chain?.said?.() ?? null) as Promise<string[] | null>,
  pack: () => p.evaluate(() => (window as any).__ather.pack()) as Promise<any>,
  at: () => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px as number, z: s.pz as number } }),
  inv: () => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), INV_KEY) as Promise<{ slots: ({ id: string; n: number } | null)[] } | null>,
  text: () => p.evaluate(() => document.body.innerText) as Promise<string>,
})
async function intoWilds(p: Page) {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await W(p).zone()) === 'wilds', 240000), 'in the Wilds')
  await poll(async () => p.evaluate(() => typeof (window as any).__ather?.fall === 'function' && typeof (window as any).__ather?.tp === 'function' && !!(window as any).__chain))
  await sleep(3000)
}
async function walkTo(p: Page, x: number, z: number) {
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z), x, z)
  await poll(async () => { const q = await W(p).at(); return Math.hypot(q.x - x, q.z - z) < 0.5 }, 30000)
}
const hasNote = async (p: Page) => ((await W(p).inv())?.slots ?? []).some(s => s?.id === KAEL_INVITE)
async function fallAndRecover(p: Page, tag: string) {
  const w = W(p), a0 = await w.at(), spot = { x: a0.x + 20, z: a0.z - 16 }
  await walkTo(p, spot.x, spot.z)
  await p.evaluate(() => (window as any).__ather.fall())
  ok(await poll(async () => (await w.zone()) === 'plot', 30000), `${tag}: a fall sends the keeper home`)
  const pk = await w.pack()
  ok(!!pk, `${tag}: a pack lies where they fell`)
  ok(await hasNote(p), `${tag}: the note stayed on the keeper (not in the pack)`)
  return pk
}

// ── A: die once, recover the pack, the ping once ──
{
  const p = await keeper('A'), w = W(p)
  await intoWilds(p)
  ok(await poll(() => hasNote(p), 10000), 'A: the bag holds a note from Kael')
  const c0 = await w.chain()
  ok(c0?.step === 'invite' && !c0.read && !c0.died && !c0.pinged, `A: chain at the invite (${JSON.stringify(c0)})`)
  const pk = await fallAndRecover(p, 'A')
  await sleep(4000)
  ok((await w.said())?.length === 0 && (await w.chain()).died, 'A: died, pack lying: Morel says nothing yet')
  await intoWilds(p)
  await walkTo(p, pk.x, pk.z)
  ok(await poll(async () => (await w.pack()) === null, 20000), 'A: walking onto the pack takes it back')
  ok(await poll(async () => (await w.said())?.includes('ping') ?? false, 6000), 'A: Morel pings once the pack is back')
  const shown = await w.text()
  ok(shown.includes(MOREL_PING.unreadNote), 'A: the ping on the HUD, word for word')
  await p.screenshot({ path: `${out}/m73-a-ping.png` })
  await sleep(3000)
  ok((await w.said())?.filter(s => s === 'ping').length === 1, 'A: the ping said exactly once')
  const c1 = await w.chain()
  ok(c1.pinged && c1.step === 'dig', 'A: pinged, The Dig on')
  await intoWilds(p); await sleep(5000)
  ok((await w.said())?.length === 0 && (await w.chain()).pinged && !(await w.text()).includes(MOREL_PING.unreadNote), 'A: after a reload no second ping')
}

// ── B: read the note first ──
{
  const p = await keeper('B'), w = W(p)
  await intoWilds(p)
  ok(await poll(() => hasNote(p), 10000), 'B: the bag holds a note from Kael')
  const at = ((await w.inv())?.slots ?? []).findIndex(s => s?.id === KAEL_INVITE)
  await p.keyboard.press('KeyI'); await sleep(1000)
  if (await p.$('[data-pack-go="bag"]')) { await p.click('[data-pack-go="bag"]'); await sleep(700) }
  await p.click(`[data-slot="${at}"]`); await sleep(500)
  await p.click('[data-act="read-invite"]'); await sleep(800)
  const lines = await p.evaluate(() => [...document.querySelectorAll('[data-invite-line]')].map(e => e.textContent))
  ok(JSON.stringify(lines) === JSON.stringify(KAEL_INVITE_TEXT), `B: the note reads word for word (${lines.length} paragraphs)`)
  const fits = await p.evaluate(() => { const r = document.querySelector('[data-invite-note]')!.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth })
  ok(fits, 'B: the note fits the 390 px phone')
  await p.screenshot({ path: `${out}/m73-b-note.png` })
  const c = await w.chain()
  ok(c.read && c.step === 'dig' && !c.pinged, 'B: read early: The Dig on, no ping')
  await p.keyboard.press('Escape'); await sleep(800)
  await p.evaluate(() => (window as any).__ather.open('gate')); await sleep(1200)
  ok((await w.said())?.includes('hint') && (await w.text()).includes(MOREL_DIG_HINT.digFlip), 'B: at the gate Morel says the hint, word for word')
  ok(!!(await p.$('[data-flip-pulse]')), 'B: the Flip map button pulses')
  await p.screenshot({ path: `${out}/m73-b-gate.png` })
  await p.evaluate(() => { [...document.querySelectorAll('[data-panel="fold-map"] button')].find(b => b.textContent === 'Flip map')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await sleep(1000)
  ok(!(await p.$('[data-flip-pulse]')) && (await w.chain()).flipped, 'B: flipped: the button stops pulsing')
  ok(!!(await p.$('[data-dig-door="rune-hold"]')), 'B: Rune Hold\'s door pulses in the Nyx list')
  await p.screenshot({ path: `${out}/m73-b-nyx.png` })
  await p.keyboard.press('Escape'); await sleep(800)
  await intoWilds(p)
  const pk = await fallAndRecover(p, 'B')
  await intoWilds(p); await walkTo(p, pk.x, pk.z)
  await poll(async () => (await w.pack()) === null, 20000); await sleep(3000)
  ok(!(await w.said())?.includes('ping') && (await w.chain()).pinged, 'B: a note read before the death: no ping, ever')
  ok((await w.said())?.filter(s => s === 'hint').length === 0, 'B: the gate hint does not repeat after a reload')
}

ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `m73-chain-check: ${fails} FAIL` : 'm73-chain-check: PASS')
process.exit(fails ? 1 : 0)
