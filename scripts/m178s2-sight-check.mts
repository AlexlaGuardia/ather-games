// M178 s2 (Alex 11-25: irons on every gun, "better sights are bought"): a FRESH test keeper (new browser context, never Alex's save;
// the starting 1500 Marks) holding the Backbone walks to Ashfeld's gun shop door, E, BUYS the holo for the Backbone (Marks drop by its
// price once, the save owns it), FITS it at the counter; in the Wilds the drawn Backbone is the holo model, aiming puts the holo's mark
// dead centre (no scope ring, the model stays up); a RELOAD keeps the purchase + the fitting; the Character tab takes it off -> irons
// again, still owned. Desktop 1280x760. Zero page errors. Shots to --out.
//   npx tsx scripts/m178s2-sight-check.mts [--url https://ather.games] [--out docs/looks/m178-s2-2026-11-27]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { SIGHT_PRICES } from '../src/app/shimmer/open/business/gun-shop'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m178s2')
mkdirSync(out, { recursive: true })
const W = 1280, H = 760, AIM_PX = 3
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'ashfeld').find(d => d.key === 'front:gunshop:ashfeld')
if (!door) { console.log('FAIL: no gun shop door in Ashfeld'); process.exit(1) }
const at = shopDoorPoint(door.b)
const LOADOUT = { v: 1, guns: ['backbone', 'repeater'], primary: 'backbone', secondary: 'repeater', kael: true,
  vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
// seeded ONCE per tab session (the reloads below must see what the keeper did, not a fresh seed)
await p.evaluateOnNewDocument((lo: string) => { if (sessionStorage.getItem('m178s2')) return; sessionStorage.setItem('m178s2', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.loadout.v1', lo) }, JSON.stringify(LOADOUT))
const results: [string, boolean, string][] = []
const check = (n: string, c: boolean, d = '') => { results.push([n, c, d]); console.log(c ? 'ok  ' : 'FAIL', n, d) }
const poll = async (fn: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(200) } return false }
const loadout = () => p.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('open.loadout.v1')) return JSON.parse(localStorage.getItem(k)!) } return null })
const G = () => p.evaluate(() => { const g = (window as any).__fpGun; return g ? { shown: g.shown(), key: g.key(), ads: +g.ads().toFixed(2), optic: g.optic(), irons: g.irons?.() ?? null, aim: g.aim(), post: g.post?.() ?? null } : null })
const ring = () => p.$('[data-hud="scope"]').then(Boolean)
const tapR = async () => { await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(600) }
const holdR = async () => { await p.keyboard.down('KeyR'); await sleep(800); await p.keyboard.up('KeyR'); await sleep(800) }
const wilds = async () => {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await dismissStartCard(p)
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fpGun, { timeout: 240000 }); await sleep(4000)
  await p.mouse.click(W / 2, H / 2); await sleep(800)
}
/** draw, aim to full ADS, read, shoot the screen, let go */
const aim = async (name: string, keyWant: string) => {
  await tapR(); await poll(async () => (await G())?.key === keyWant, 10000); await sleep(600)
  const hip = await G(); await p.screenshot({ path: `${out}/${name}-hip.png` })
  await p.mouse.down({ button: 'right' }); const reached = await poll(async () => ((await G())?.ads ?? 0) >= 0.99, 8000); await sleep(900)
  const a = await G(), ringUp = await ring(); await p.screenshot({ path: `${out}/${name}-ads.png` })
  await p.screenshot({ path: `${out}/${name}-ads-centre.png`, clip: { x: W / 2 - 90, y: H / 2 - 70, width: 180, height: 140 } })
  await p.mouse.up({ button: 'right' }); await poll(async () => ((await G())?.ads ?? 1) <= 0.01, 6000)
  await holdR()   // stow
  const aimPx = a?.aim ? [+(a.aim[0] * W / 2).toFixed(2), +(a.aim[1] * H / 2).toFixed(2)] : null
  return { hip, a, reached, ringUp, aimPx }
}

// 1 · the continent: Ashfeld's gun shop door, the real E
await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await dismissStartCard(p)
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
await p.keyboard.press('KeyW'); await sleep(500)
const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
const reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:gunshop:ashfeld', 60000)
check('Ashfeld gun shop door in reach', reach)
await p.keyboard.press('KeyE')
check('E opens the gun shop', await poll(async () => !!(await p.$('[data-panel="gun-shop"]'))))
const purse = () => p.evaluate(() => { const m = (document.querySelector('[data-panel="gun-shop"]')?.textContent ?? '').match(/Purse · ([\d,]+) Marks/); return m ? Number(m[1].replace(/,/g, '')) : -1 })
const rows = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-panel="gun-shop"] [data-sight-row]')].map(e => e.dataset.sightRow))
check('the counter sells the holo for the Backbone (and the 2x)', rows.includes('backbone:holo') && rows.includes('backbone:scope2'), JSON.stringify(rows))
const before = await purse()
const sel = '[data-panel="gun-shop"] [data-buy="sight:backbone:holo"] button'
await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(300)
const clicked = await p.evaluate((s) => { const bt = document.querySelector<HTMLButtonElement>(s); if (!bt || bt.disabled) return false; bt.click(); return true }, sel)
await sleep(1000)
const after = await purse(), lo1 = await loadout()
check('buy the holo: Marks drop by its price once', clicked && before - after === SIGHT_PRICES.holo, `${before} -> ${after} (price ${SIGHT_PRICES.holo})`)
check('the save owns the holo for the Backbone', (lo1?.fit?.backbone?.owned ?? []).includes('holo'), JSON.stringify(lo1?.fit ?? null))
const again = await p.evaluate((s) => { const bt = document.querySelector<HTMLButtonElement>(s); return { disabled: !!bt?.disabled, text: bt?.textContent ?? '' } }, sel)
const after2 = await purse()
check('a second buy is refused (Yours), nothing more charged', again.disabled && /Yours/.test(again.text) && after2 === after, JSON.stringify(again))
await p.click('[data-fit-at-shop="backbone:holo"] button'); await sleep(700)
const lo2 = await loadout()
check('Fit at the counter: the save fits the holo on the Backbone', lo2?.fit?.backbone?.sight === 'holo', String(lo2?.fit?.backbone?.sight))
check('the counter now offers Take off', await p.evaluate(() => document.querySelector('[data-fit-at-shop="backbone:holo"]')?.getAttribute('data-on') === '1'))
await p.screenshot({ path: `${out}/1-shop-bought-fitted.png` })

// 2 · the Wilds: the Backbone is the holo model; aiming puts the holo's mark dead centre, no ring, the gun stays up
await wilds()
const h = await aim('2-holo', 'backbone:reddot:sholo')
check('drawn: the Backbone wears the holo (key backbone:reddot:sholo)', h.hip?.key === 'backbone:reddot:sholo' && h.hip?.shown === true, JSON.stringify(h.hip?.key))
check('ADS through the holo: 1x optic, full ADS, no scope ring, model up', !!h.reached && h.a?.optic === 'reddot' && h.a?.irons === false && !h.ringUp && h.a?.shown === true, JSON.stringify({ optic: h.a?.optic, ring: h.ringUp, shown: h.a?.shown }))
check(`the holo's mark projects within ${AIM_PX} px of centre`, !!h.aimPx && Math.abs(h.aimPx[0]) <= AIM_PX && Math.abs(h.aimPx[1]) <= AIM_PX, JSON.stringify(h.aimPx))

// 3 · a reload keeps the purchase and the fitting
await wilds()
const r = await aim('3-reload', 'backbone:reddot:sholo')
const lo3 = await loadout()
check('after a reload: still the holo, still owned', r.hip?.key === 'backbone:reddot:sholo' && (lo3?.fit?.backbone?.owned ?? []).includes('holo') && lo3?.fit?.backbone?.sight === 'holo', JSON.stringify({ key: r.hip?.key, fit: lo3?.fit?.backbone }))

// 4 · take it off (the Character tab's fitting row): back to the irons, still owned
await p.keyboard.press('KeyP'); await sleep(1200)
await p.click('[data-slot-id="primary"] button').catch(() => {}); await sleep(600)
const chips = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-fit="backbone"] [data-fit-sight]')].map(e => ({ id: e.dataset.fitSight, on: e.getAttribute('aria-pressed') })))
check('the fitting row offers the irons + the bought holo (pressed)', chips.some(c => c.id === 'irons') && chips.find(c => c.id === 'holo')?.on === 'true', JSON.stringify(chips))
await p.click('[data-fit-sight="irons"]'); await sleep(600)
await p.screenshot({ path: `${out}/4-unfit-panel.png` })
await p.keyboard.press('KeyP'); await sleep(900); await p.mouse.click(W / 2, H / 2); await sleep(800)
const u = await aim('4-irons', 'backbone:irons-long:sirons')
const lo4 = await loadout()
check('unfit: the Backbone aims down its irons again', u.hip?.key === 'backbone:irons-long:sirons' && u.a?.irons === true && u.a?.optic === 'irons-long' && !u.ringUp, JSON.stringify({ key: u.hip?.key, optic: u.a?.optic }))
check('the holo stays owned after taking it off', (lo4?.fit?.backbone?.owned ?? []).includes('holo') && lo4?.fit?.backbone?.sight === 'irons', JSON.stringify(lo4?.fit?.backbone))
check('no page errors', errs.length === 0, errs.join(' | '))
const pass = results.every(x => x[1])
console.log(pass ? `PASS: ${results.length} checks, shots in ${out}` : `FAIL: ${results.filter(x => !x[1]).map(x => x[0]).join(', ')}`)
await br.close(); process.exit(pass ? 0 : 1)
