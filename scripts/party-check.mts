// BETA M27 slice 2 (Alex 11-18: "the main thing I'm worried about is playing with friends"): THE PARTY in the open world.
// Three players (browser contexts). A: Options (O) › Play together › Start a party, reads the code. B: the same panel, types
// the code, Join. C: no party. All three travel into the Wilds. PASS = A and B are in the party (same code), A sees B where B
// stands (within 1 m) and B's name in the panel's roster; the party is invisible to C and C to it (the server's party
// instance); B leaves the party and A loses B. 0 page errors. Friend INVITES need two signed-in accounts: not run here.
//   npx tsx scripts/party-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: Record<string, unknown> = { url }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const mp = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__mp?.[k]?.(), f)
const selfId = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id'))
const clickText = (p: Page, sel: string, text: string) => p.evaluate((s: string, t: string) => { const e = [...document.querySelectorAll<HTMLElement>(s)].find(x => (x.textContent ?? '').includes(t)); e?.click(); return !!e }, sel, text)
const open = async (tag: string): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 900, height: 560 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel && !!(window as any).__mp, { timeout: 240000, polling: 1000 })
  return p
}
const panel = async (p: Page) => {   // O opens Options; its Game tab's "Play together" row opens the panel
  for (let i = 0; i < 4; i++) {
    if (await p.$('[data-panel="play-together"]')) return true
    if (!(await p.$('[data-panel="options"]'))) { await p.keyboard.press('KeyO'); await poll(async () => !!(await p.$('[data-panel="options"]')), 8000) }   // O TOGGLES: only press it when Options is shut
    await clickText(p, '[data-panel="options"] button', 'Play together')
    if (await poll(async () => !!(await p.$('[data-panel="play-together"]')), 6000)) return true
  }
  return false
}
const toWilds = async (p: Page) => {
  for (let i = 0; i < 30 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
    await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {})
  }
  return poll(async () => (await mp(p, 'status')) === 'live', 60000)
}
const seen = async (a: Page, b: Page) => { const id = await selfId(b); return ((await mp(a, 'peers')) as { id: string }[]).some(x => x.id === id) }
const near = async (a: Page, b: Page) => {
  const id = await selfId(b), me = await mp(b, 'me') as { x: number; z: number }
  const q = ((await mp(a, 'peers')) as { id: string; x: number; z: number }[]).find(x => x.id === id)
  return !!q && Math.hypot(q.x - me.x, q.z - me.z) < 1
}
let pass = false
try {
  const A = await open('A'), B = await open('B'), C = await open('C')
  // A starts a party in the panel
  res.panelA = await panel(A)
  await A.click('[data-act="start-party"]')
  res.code = await poll(async () => !!(await A.$('[data-party-code]')), 10000) ? await A.$eval('[data-party-code]', e => e.textContent) : null
  // B joins it by typing the code
  res.panelB = await panel(B)
  await B.type('[data-party-input]', String(res.code)); await B.click('[data-act="join-party"]')
  res.bJoined = await poll(async () => (await mp(B, 'party')) === res.code, 10000)
  res.aParty = await mp(A, 'party')
  for (const p of [A, B]) await p.keyboard.press('Escape')
  // all three into the Wilds
  res.live = [await toWilds(A), await toWilds(B), await toWilds(C)]
  const w = await mp(A, 'me') as { x: number; z: number }
  await B.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), w.x + 5, w.z - 5)
  await C.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), w.x - 5, w.z + 5)
  res.aSeesB = await poll(() => near(A, B), 45000)
  res.bSeesA = await poll(() => near(B, A), 20000)
  await sleep(4000)
  res.aSeesC = await seen(A, C); res.cSeesA = await seen(C, A)
  // the roster in A's panel names B
  await panel(A)
  const bId = await selfId(B), bName = ((await mp(A, 'peers')) as { id: string; name: string }[]).find(x => x.id === bId)?.name
  res.bName = bName
  res.roster = await A.$eval('[data-roster]', e => e.textContent ?? ''); res.rosterHasB = !!bName && String(res.roster).includes(bName)
  try { await A.screenshot({ path: `${out}/party-1-panel.png` }) } catch { /* slow frame */ }
  // B leaves the party: B goes back to the public Wilds, A loses B
  await panel(B); await B.click('[data-act="leave-party"]')
  res.bLeft = await poll(async () => (await mp(B, 'party')) === null, 10000)
  res.aLostB = await poll(async () => !(await seen(A, B)), 30000)
  pass = res.panelA === true && typeof res.code === 'string' && (res.code as string).length >= 4 && res.bJoined === true && res.aParty === res.code
    && (res.live as boolean[]).every(Boolean) && res.aSeesB === true && res.bSeesA === true && res.aSeesC === false && res.cSeesA === false
    && res.rosterHasB === true && res.bLeft === true && res.aLostB === true && errs.length === 0
} catch (e) { res.error = String(e).slice(0, 300) }
res.errors = errs
console.log(JSON.stringify(res)); console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
