// Check: THE FIRST ERRAND starts at Greg's (Magii + Alex 11-16). A born keeper (Star) opens Gregory's panel in the Ather:
// the gems box offers the birth letter's material, Take them puts it in the bag, and the box then points to the Fire
// School runesmith in Redstair and on to the Enchant Temple. (The cut + imbue are scripts/runesmith-check.mts.)
// npx tsx scripts/errand-check.mts  (URL= to point elsewhere). Writes /tmp/errand-<n>.png
import puppeteer from 'puppeteer-core'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
// a fresh keeper on the FIRST load only (a reload must keep what Greg gave)
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem('open.inv.v1'); localStorage.removeItem('open.loadout.v1'); localStorage.removeItem('open.errand.v1') } })
await p.setViewport({ width: 960, height: 600 })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
await p.goto(`${URL}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.open, { timeout: 240000 }); await wait(2000)
await p.evaluate(() => (window as any).__ather.open('greg'))
ok(await poll(async () => !!(await p.$('[data-panel="greg"] [data-errand="greg"]'))), "Greg's panel offers the gems for the first letter")
const sendOff = await p.evaluate(() => [...document.querySelectorAll('[data-greg-line]')].map(e => e.textContent ?? ''))
ok(sendOff.length === 4 && /Now then\. A Blankstone, and the gems to go on it\./.test(sendOff[0]) && /Yours is the Fire School runesmith, at Redstair\./.test(sendOff[1]), `Greg's send-off, lark's lines with the seat filled in (${sendOff.length})`)
await p.screenshot({ path: '/tmp/errand-1.png' })
await p.click('[data-errand-take]'); await wait(1200)
const bag = await p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as any[]).filter(Boolean).map(s => `${s.id}x${s.n}`))
ok(bag.includes('blankstonex1') && bag.includes('raw_mana_shardx2') && bag.includes('violet_crystalx1'), `the gems are in the bag (${bag.join(' ')})`)
const txt = await p.evaluate(() => document.querySelector('[data-panel="greg"] [data-errand="smith"]')?.textContent ?? '')
ok(/Redstair first, Keeper, then the Citadel\. Blue and I will keep\./.test(txt), `then Greg's repeat line points the way (lark, signed 11-16): "${txt.trim()}"`)
await p.screenshot({ path: '/tmp/errand-2.png' })
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('open.errand.v1') ?? '{}').given === true), 'the gems are given once (the flag holds)')
await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.open, { timeout: 240000 }); await wait(1500)
await p.evaluate(() => (window as any).__ather.open('greg'))
ok(await poll(async () => !(await p.$('[data-errand-take]')) && !!(await p.$('[data-errand="smith"]'))), 'after a reload Greg does not hand them out again')
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `errand-check: ${fails} FAIL` : 'errand-check: PASS')
process.exit(fails ? 1 : 0)
