// BETA M188 s1 (RULED athernyx 62a71de): THE CHORD TAB + CHORDMATES' HEALTH BARS. Two FRESH anonymous keepers (two browser
// contexts, never anyone's save). A: Options (O) › Chord › Start a chord, reads the code. B: Options › Chord, types it, Join.
// Both into the Wilds, B beside A. PASS = each sees the other in the Chord tab (name + colour); each sees the other's health
// bar + nametag stacked ABOVE their own health (desktop: the vitals plate; phone: the hotbar's lip), with a live health
// number (heard over the relay); the tab says 'chord', never 'party' / 'podium'; the Game tab has no 'Play together';
// B leaves: B's bars go and A's bar for B goes. 0 page errors.
//   npx tsx scripts/m188-chord-check.mts [--url https://ather.games] [--phone] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp'), PHONE = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: Record<string, unknown> = { url, phone: PHONE }
const errs: string[] = []
const fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const mp = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__mp?.[k]?.(), f)
const selfId = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id'))
const clickText = (p: Page, sel: string, text: string) => p.evaluate((s: string, t: string) => { const e = [...document.querySelectorAll<HTMLElement>(s)].find(x => (x.textContent ?? '').trim() === t || (x.textContent ?? '').includes(t)); e?.click(); return !!e }, sel, text)
const open = async (tag: string): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/open/ather?hour=14&mp=on`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel && !!(window as any).__mp, { timeout: 240000, polling: 1000 })
  return p
}
const options = async (p: Page) => {
  if (!(await p.$('[data-panel="options"]'))) { await p.keyboard.press('KeyO'); await poll(async () => !!(await p.$('[data-panel="options"]')), 8000) }
  return !!(await p.$('[data-panel="options"]'))
}
const tab = async (p: Page, name: string, sel: string) => {
  for (let i = 0; i < 4; i++) {
    if (await p.$(sel)) return true
    await options(p); await clickText(p, '[data-panel="options"] button', name)
    if (await poll(async () => !!(await p.$(sel)), 5000)) return true
  }
  return false
}
const chordTab = (p: Page) => tab(p, 'Chord', '[data-panel="chord"]')
const closeOpts = async (p: Page) => { for (let i = 0; i < 3 && await p.$('[data-panel="options"]'); i++) { await p.keyboard.press('KeyO'); await sleep(500) } }
const toWilds = async (p: Page) => {
  for (let i = 0; i < 30 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
    await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {})
  }
  return poll(async () => (await mp(p, 'status')) === 'live', 60000)
}
// the bar for `id` on page p: name, hp, and whether the stack sits above this keeper's own health
const bar = (p: Page, id: string, phone: boolean) => p.evaluate((id: string, phone: boolean) => {
  const b = document.querySelector(`[data-chord-bar="${id}"]`) as HTMLElement | null
  const stack = document.querySelector('[data-chord-bars]') as HTMLElement | null
  const own = document.querySelector(phone ? '[data-hud="hotbar"]' : '[data-hud="vitals"]') as HTMLElement | null
  if (!b || !stack || !own) return null
  const s = stack.getBoundingClientRect(), o = own.getBoundingClientRect()
  return { name: b.querySelector('[data-chord-name]')?.textContent ?? '', hp: b.getAttribute('data-hp') ?? '', above: s.bottom <= o.top + 1, onScreen: s.top >= 0 && s.left >= 0 && s.right <= innerWidth,
    gap: Math.round(o.top - s.bottom), colour: getComputedStyle(b).boxShadow }
}, id, phone)
try {
  const A = await open('A'), B = await open('B')
  const aId = await selfId(A), bId = await selfId(B)
  ok(await chordTab(A), 'A opens Options › Chord')
  const gameWords = await A.evaluate(() => document.querySelector('[data-panel="options"]')?.textContent ?? '')
  await A.click('[data-act="start-party"]')
  res.code = await poll(async () => !!(await A.$('[data-party-code]')), 10000) ? await A.$eval('[data-party-code]', e => e.textContent) : null
  ok(typeof res.code === 'string' && (res.code as string).length >= 4, `A started a chord (${res.code})`)
  ok(await chordTab(B), 'B opens Options › Chord')
  await B.type('[data-party-input]', String(res.code)); await B.click('[data-act="join-party"]')
  ok(await poll(async () => (await mp(B, 'party')) === res.code, 10000) && (await mp(A, 'party')) === res.code, 'B rang into the chord (same code)')
  await closeOpts(A); await closeOpts(B)
  ok((await toWilds(A)) && (await toWilds(B)), 'both live in the Wilds')
  const w = await mp(A, 'me') as { x: number; z: number }
  await B.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), w.x + 4, w.z - 4)
  // the Chord tab: each lists the other, with a colour; no 'party' / 'podium' on screen
  for (const [me, other, tag] of [[A, bId, 'A'], [B, aId, 'B']] as const) {
    await chordTab(me)
    const row = await poll(async () => !!(await me.$(`[data-chord-member="${other}"]`)), 30000)
    const r = row ? await me.$eval(`[data-chord-member="${other}"]`, e => ({ text: e.textContent ?? '', colour: e.getAttribute('data-chord-colour') })) : null
    ok(r && r.text.trim().length > 0 && /^#[0-9a-f]{6}$/i.test(r.colour ?? ''), `${tag}'s Chord tab lists the other (${r?.text.trim()}, ${r?.colour})`)
    const words = (await me.$eval('[data-panel="chord"]', e => e.textContent ?? '')).toLowerCase()
    ok(!/\bpart(y|ies)\b/.test(words) && !words.includes('podium'), `${tag}'s Chord tab never says party / podium`)
    res[`tab${tag}`] = r
    if (tag === 'A') try { await A.screenshot({ path: `${out}/m188-${PHONE ? 390 : 'desk'}-1-chord-tab.png` }) } catch { /* slow frame */ }
    await tab(me, 'Game', '[data-panel="options"]')
    await clickText(me, '[data-panel="options"] button', 'Game'); await sleep(400)
    const g = await me.$eval('[data-panel="options"]', e => e.textContent ?? '')
    ok(!/play together/i.test(g) && !/play together/i.test(gameWords), `${tag}: no 'Play together' in Options`)
    await closeOpts(me)
  }
  // the bars: the other's, over my own, with a heard health number
  for (const [me, other, tag] of [[A, bId, 'A'], [B, aId, 'B']] as const) {
    let b: Awaited<ReturnType<typeof bar>> = null
    await poll(async () => { b = await bar(me, other!, PHONE); return !!b && b.hp !== '' }, 40000)
    const t = res[`tab${tag}`] as { text: string } | null
    ok(b && (b as any).name.length > 0 && t?.text.includes((b as any).name), `${tag} sees the other's nametag on the bar (${(b as any)?.name})`)
    ok(b && (b as any).hp !== '' && Number((b as any).hp) > 0, `${tag} hears the other's health (${(b as any)?.hp})`)
    ok(b && (b as any).above && (b as any).onScreen, `${tag}: the bar stacks above my own health (gap ${(b as any)?.gap} px), on screen`)
    res[`bar${tag}`] = b
  }
  try { await A.screenshot({ path: `${out}/m188-${PHONE ? 390 : 'desk'}-2-bars.png` }) } catch { /* slow frame */ }
  // B leaves: B's bars go, and A's bar for B goes
  ok(await chordTab(B), 'B opens the Chord tab to leave')
  await B.click('[data-act="leave-party"]')
  ok(await poll(async () => (await mp(B, 'party')) === null, 10000), 'B left the chord')
  await closeOpts(B)
  ok(await poll(async () => !(await B.$('[data-chord-bars]')), 10000), "B's bars are gone")
  ok(await poll(async () => !(await A.$(`[data-chord-bar="${bId}"]`)), 30000), "A's bar for B is gone")
  try { await A.screenshot({ path: `${out}/m188-${PHONE ? 390 : 'desk'}-3-left.png` }) } catch { /* slow frame */ }
} catch (e) { res.error = String(e).slice(0, 300); fails.push('threw') }
ok(errs.length === 0, `0 page errors (${errs.join(' | ').slice(0, 300)})`)
console.log(JSON.stringify(res)); console.log(fails.length ? `FAIL (${fails.length})` : 'PASS'); await br.close(); process.exit(fails.length ? 1 : 0)
