// M179 (Alex 11-25): any gun in either slot. A TEST keeper (fresh context, never Alex's save) with five guns; the Character tab:
// an old save loads unchanged; two long guns (Backbone into the secondary); a pick of the gun the other slot wears SWAPS the two;
// the Repeater (the only sidearm) as the primary with a long gun as the secondary; the empty hint names no class; R draws the
// primary first. Desktop 1280x760 and phone 390x844. 0 page errors.
//   npx tsx scripts/m179-slots-check.mts [--url https://ather.games] [--out dir] [--phone|--desk]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m179')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const LOADOUT = { v: 1, guns: ['repeater', 'charred-rifle', 'backbone', 'lance', 'spitter'], primary: 'charred-rifle', secondary: 'repeater', kael: true,
  vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const results: [string, boolean, string][] = []
const check = (n: string, c: boolean, d = '') => { results.push([n, c, d]); console.log(c ? '✓' : '✗', n, d) }
const poll = async (fn: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }

const saved = (p: Page) => p.evaluate(() => { const l = JSON.parse(localStorage.getItem('open.loadout.v1') ?? '{}'); return `${l.primary}/${l.secondary}` }) as Promise<string>
const openSlot = async (p: Page, s: string) => { await p.click(`[data-slot-id="${s}"] > button`); await sleep(500) }
const pick = async (p: Page, s: string, gun: string) => { await openSlot(p, s); await p.click(`[data-slot-id="${s}"] [data-option="${gun}"]`); await sleep(600) }

async function leg(phone: boolean) {
  const tag = phone ? 'phone' : 'desk'
  const p = await (await br.createBrowserContext()).newPage()
  if (phone) await p.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
  else await p.setViewport({ width: 1280, height: 760 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((lo: string) => { if (sessionStorage.getItem('m179')) return; sessionStorage.setItem('m179', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.loadout.v1', lo) }, JSON.stringify(LOADOUT))
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fpGun, { timeout: 240000 }); await sleep(4000)
  if (phone) { await p.touchscreen.tap(195, 300).catch(() => {}); await sleep(1200) } else { await p.mouse.click(640, 380); await sleep(800) }
  check(`${tag}: an old save loads unchanged (charred-rifle/repeater)`, (await saved(p)) === 'charred-rifle/repeater', await saved(p))
  await p.keyboard.press('KeyP'); await sleep(1200)
  check(`${tag}: the Character tab is open`, await poll(async () => !!(await p.$('[data-slot-id="secondary"]'))), '')
  // every owned gun offered in the secondary, long guns included
  await openSlot(p, 'secondary')
  const offered = await p.$$eval('[data-slot-id="secondary"] [data-option]', es => es.map(e => e.getAttribute('data-option')).join())
  check(`${tag}: the secondary offers all five guns`, ['repeater', 'charred-rifle', 'backbone', 'lance', 'spitter'].every(g => offered.split(',').includes(g)), offered)
  const marked = await p.$eval('[data-slot-id="secondary"] [data-option="charred-rifle"]', e => e.querySelector('[data-other-slot]')?.textContent ?? null).catch(() => null)
  check(`${tag}: the gun the primary wears is marked "Primary"`, marked === 'Primary', String(marked))
  await openSlot(p, 'secondary')   // close
  // two long guns
  await pick(p, 'secondary', 'backbone')
  check(`${tag}: two long guns (charred-rifle/backbone)`, (await saved(p)) === 'charred-rifle/backbone', await saved(p))
  await p.screenshot({ path: `${out}/${tag}-1-two-long.png` })
  // swap: the primary takes the gun the secondary wears
  await pick(p, 'primary', 'backbone')
  check(`${tag}: picking the other slot's gun swaps (backbone/charred-rifle)`, (await saved(p)) === 'backbone/charred-rifle', await saved(p))
  // the sidearm as the primary, a long gun the secondary
  await pick(p, 'primary', 'repeater')
  await pick(p, 'secondary', 'lance')
  check(`${tag}: the Repeater as the primary, the Lance the secondary`, (await saved(p)) === 'repeater/lance', await saved(p))
  // a short gun + the sidearm (the only sidearm there is): spitter secondary
  await pick(p, 'secondary', 'spitter')
  check(`${tag}: Repeater + Spitter (repeater/spitter)`, (await saved(p)) === 'repeater/spitter', await saved(p))
  // the empty slot's hint names no class
  await openSlot(p, 'secondary'); await p.evaluate(() => { const b = [...document.querySelectorAll('[data-slot-id="secondary"] button')].find(x => x.textContent === 'Leave this slot empty') as HTMLElement | undefined; b?.click() }); await sleep(600)
  const hint = await p.$eval('[data-slot-id="secondary"] > button', e => e.textContent ?? '')
  check(`${tag}: the empty secondary's hint names no class`, /any gun you own/.test(hint) && !/sidearm|long gun/.test(hint), hint)
  await pick(p, 'secondary', 'lance')
  const fits = await p.evaluate(() => { const f = document.querySelector('[data-panel^="pack-"]')?.getBoundingClientRect(); return f ? f.left >= 0 && f.right <= innerWidth + 0.5 : false })
  check(`${tag}: the panel fits the width`, fits)
  await p.screenshot({ path: `${out}/${tag}-2-repeater-lance.png` })
  // close the pack; R draws the primary first
  await p.keyboard.press('Escape'); await sleep(900)
  await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(900)
  const g = await p.evaluate(() => (window as any).__fpGun?.key?.() ?? null)
  check(`${tag}: R draws the primary (the Repeater) first`, typeof g === 'string' && g.startsWith('repeater'), String(g))
  check(`${tag}: after a reload the mixed loadout holds`, await (async () => { await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); return (await saved(p)) === 'repeater/lance' })(), await saved(p))
  await p.close()
}
if (!process.argv.includes('--phone')) await leg(false)
if (!process.argv.includes('--desk')) await leg(true)
check('no page errors', errs.length === 0, errs.join(' | '))
const pass = results.every(r => r[1])
console.log(pass ? `PASS: ${results.length} checks, shots in ${out}` : `FAIL: ${results.filter(r => !r[1]).map(r => r[0]).join(', ')}`)
await br.close(); process.exit(pass ? 0 : 1)
