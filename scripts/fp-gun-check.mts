// THE GUN IN HAND + ITS SIGHTS (Alex 11-18), played in the Wilds with real input: a keeper with Kael's arms draws (R), the gloves hold
// the gun, right-click aims (the Charred Rifle's 2x: the scope ring takes the screen, the model gives way), a tap swaps to the Repeater
// (its 1x: no ring, the gun stays up with the etched mark centred), a shot flares the mark, the ammo chip names the gun in hand.
// Screenshots to --out for the LOOK (Alex). Zero page errors.
//   npx tsx scripts/fp-gun-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/fp-gun')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  // what Kael's chest hands over (shipyard-check proves the chest): the Charred Rifle primary, the Repeater secondary
  localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['charred-rifle', 'repeater'], primary: 'charred-rifle', secondary: 'repeater', kael: true,
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
})
const res: Record<string, unknown> = { url }
const G = () => p.evaluate(() => { const g = (window as any).__fpGun; return g ? { shown: g.shown(), key: g.key(), ads: +g.ads().toFixed(2), optic: g.optic(), mark: g.mark(), glow: +g.glow().toFixed(2) } : null })
const ring = () => p.$('[data-hud="scope"]').then(Boolean)
const poll = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(150) } return false }
const tapR = async () => { await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(500) }
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fpGun, { timeout: 240000 }); await sleep(4000)
await p.mouse.click(640, 380); await sleep(800)
res.stowed = await G()
// 1 · R draws the primary: the Charred Rifle, held, its 2x, the etching lit faintly
await tapR(); await poll(async () => !!(await G())?.shown); res.drawn = await G()
await p.screenshot({ path: `${out}/1-hip-rifle.png` })
// 2 · right-click: the sights; at full ADS the 2x's scope ring takes the screen and the model gives way
await p.mouse.down({ button: 'right' })
res.adsReached = await poll(async () => ((await G())?.ads ?? 0) >= 0.99)
res.aimedRifle = await G(); res.ringRifle = await ring()
await p.screenshot({ path: `${out}/2-scope-2x.png` })
await p.mouse.up({ button: 'right' })
res.adsLeft = await poll(async () => ((await G())?.ads ?? 1) <= 0.01)
res.ringGone = !(await ring())
// 3 · tap R: swap to the Repeater; aim: the 1x, no ring, the gun stays up
await tapR(); await poll(async () => (await G())?.key === 'repeater:reddot'); res.swapped = await G()
await p.mouse.down({ button: 'right' }); await poll(async () => ((await G())?.ads ?? 0) >= 0.99)
res.aimedRepeater = await G(); res.ringRepeater = await ring()
await p.screenshot({ path: `${out}/3-sight-1x.png` })
// 4 · a shot: the etching flares above its faint idle
const idle = (await G())?.glow ?? 0
await p.mouse.down({ button: 'left' }); let flare = 0
await poll(async () => { flare = Math.max(flare, (await G())?.glow ?? 0); return flare > idle + 0.05 }, 3000); res.flare = flare; await p.mouse.up({ button: 'left' })
await p.mouse.up({ button: 'right' }); await sleep(600)
res.idleGlow = idle
res.chip = await p.evaluate(() => [...document.querySelectorAll('[data-hud] *')].map(e => e.textContent ?? '').find(t => /^(Repeater|Charred rifle)\s*\d+ \/ \d+$/.test(t.trim())) ?? null)
await p.screenshot({ path: `${out}/4-after-shot.png` })
// 5 · THE SIGHT IS THE KEEPER'S (canon, look only): the Character tab re-cuts the rifle's mark to a mana-blue ring; aiming it shows that cut
await p.keyboard.down('KeyR'); await sleep(600); await p.keyboard.up('KeyR'); await sleep(400)   // hold R: stow
await p.keyboard.press('KeyP'); await sleep(900)
await p.click('[data-slot-id="primary"] > button'); await sleep(500)
res.sightRow = !!(await p.$('[data-sight="charred-rifle"]'))
await p.click('[data-sight="charred-rifle"] [data-mark="ring"]').catch(() => {}); await sleep(200)
await p.click('[data-sight="charred-rifle"] [data-tint="mana"]').catch(() => {}); await sleep(300)
await p.screenshot({ path: `${out}/5-sight-menu.png` })
res.savedLook = await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.endsWith('open.sights.v1')); return k ? JSON.parse(localStorage.getItem(k)!)['charred-rifle'] ?? null : null })
await p.keyboard.press('Escape'); await sleep(700); await p.mouse.click(640, 380); await sleep(600)
await tapR(); await poll(async () => (await G())?.key === 'charred-rifle:scope2')
await p.mouse.down({ button: 'right' }); await poll(async () => ((await G())?.ads ?? 0) >= 0.99)
res.recut = await G(); await poll(ring, 4000)   // the ring is DOM: it renders a frame after the sights reach full
res.ringMark = await p.evaluate(() => document.querySelector('[data-hud="scope"]')?.getAttribute('data-mark') ?? null)
await p.screenshot({ path: `${out}/6-scope-recut.png` })
await p.mouse.up({ button: 'right' })
res.pageErrors = errs
console.log(JSON.stringify(res, null, 1))
const d = res.drawn as any, ar = res.aimedRifle as any, sw = res.swapped as any, rp = res.aimedRepeater as any, st = res.stowed as any
const pass = !!st && !st.shown
  && d?.shown && d.key === 'charred-rifle:scope2' && d.optic === 'scope2' && d.glow >= 0.15 && d.glow <= 0.5
  && !!res.adsReached && ar?.ads >= 0.99 && !!res.ringRifle && ar.shown === false
  && !!res.adsLeft && !!res.ringGone
  && sw?.key === 'repeater:reddot' && rp?.ads >= 0.99 && !res.ringRepeater && rp.shown === true
  && (res.flare as number) > idle
  && !!res.sightRow && (res.savedLook as any)?.mark === 'ring' && (res.savedLook as any)?.tint === 'mana'
  && (res.recut as any)?.mark === 'ring:mana' && res.ringMark === 'ring'
  && errs.length === 0
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
