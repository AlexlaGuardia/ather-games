// Check (BETA M93 s4): a fitted sigil TUNES the gun. (A) Wilds: a keeper (birth Star) whose Repeater carries [star, life]: the
// Armory window shows the sigil, the tuned reload time and half the M78 reload mana (Star first = the birth rune); drawn, the
// combat gun IS the tuned gun (reloadTime, reloadPay) and a reload spends exactly reloadPay. (B) Enchant Temple: RE-CUT with a new
// blank replaces the sigil ([star, life] -> [stone]); the blank is spent, Stone's letter too, the old letters do not come back.
//   npx tsx scripts/m93s4-check.mts  (URL= to point elsewhere; prod via tools/edesk-check.sh). Writes /tmp/m93s4-<n>.png
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorByKey } from '../src/app/shimmer/open/business/doors'
import { letterItem } from '../src/app/shimmer/open/business/letters'
import { newInv, give } from '../src/app/shimmer/open/shared/inventory'
import { DOOR_ASK } from '../src/app/shimmer/open/continent/door-talk'
import { SIGIL_CUT_FEE } from '../src/app/shimmer/open/business/idris'
import { RANGE_GUNS } from '../src/app/shimmer/open/shared/gunplay'
import { armedGun } from '../src/app/shimmer/open/shared/gun-sigil'
import { ECON } from '../src/app/shimmer/open/shared/vitals-economy'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const LO = { v: 1, guns: ['charred-rifle', 'repeater'], primary: 'repeater', secondary: null, kael: true,
  vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove',
  fit: { repeater: { sigil: ['star', 'life'] } } }
const rep = RANGE_GUNS.find(g => g.id === 'repeater')!, want = armedGun(rep, LO as never, 'star')
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
let fails = 0, shot = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await wait(500) } return false }
ok(want.reloadTime < rep.reloadTime && Math.abs(want.reloadPay! - ECON.reloadMana / 2) < 1e-9, `expected tuning: reload ${rep.reloadTime} -> ${want.reloadTime.toFixed(3)} s, mana ${ECON.reloadMana} -> ${want.reloadPay}`)

// ── (A) the Wilds: Armory + the gun in hand ──
{
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((lo: string) => { if (sessionStorage.getItem('s4')) return; sessionStorage.setItem('s4', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.loadout.v1', lo) }, JSON.stringify(LO))
  await p.goto(`${URL}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__ather?.combat, { timeout: 240000 }); await wait(4000)
  await p.keyboard.press('KeyP'); await wait(1500)
  const card = await p.evaluate(() => { const e = document.querySelector<HTMLElement>('[data-gun-stats="repeater"]'); if (!e) return null
    return { sigil: e.querySelector('[data-stat-sigil]')?.getAttribute('data-stat-sigil'), mana: Number(e.querySelector('[data-stat-sigil]')?.getAttribute('data-reload-mana')), reload: e.querySelector('[data-stat="reload"]')?.textContent, tuned: [...e.querySelectorAll<HTMLElement>('[data-tuned]')].map(t => t.dataset.tuned) } })
  ok(card?.sigil === 'star,life', `Armory: the sigil shows (${card?.sigil})`)
  ok(card?.mana === want.reloadPay, `Armory: reload mana ${card?.mana} (half the dial: Star first)`)
  ok(!!card?.reload?.includes(String(+want.reloadTime.toFixed(2))), `Armory: tuned reload time (${card?.reload})`)
  ok(!!card?.tuned.includes('reloadSpeed') && !!card?.tuned.includes('velocity'), `Armory: the tuned stats listed (${card?.tuned.join(',')})`)
  await p.screenshot({ path: `/tmp/m93s4-${++shot}.png` })
  await p.keyboard.press('KeyP'); await wait(900)
  await p.mouse.click(640, 380); await wait(800)
  await p.keyboard.down('KeyR'); await wait(80); await p.keyboard.up('KeyR'); await wait(1200)
  const G = () => p.evaluate(() => { const c = (window as any).__ather.combat(); return { id: c.gun.id, reloadTime: c.gun.reloadTime, pay: c.gun.reloadPay, projSpeed: c.gun.projSpeed } })
  ok(await poll(async () => (await G()).id === 'repeater'), `drawn: the combat gun is the Repeater (${(await G()).id})`)
  const g = await G()
  ok(Math.abs(g.reloadTime - want.reloadTime) < 1e-9 && g.pay === want.reloadPay && Math.abs(g.projSpeed - want.projSpeed) < 1e-9, `in hand: tuned (reload ${g.reloadTime}, pay ${g.pay}, speed ${g.projSpeed})`)
  // a reload spends exactly reloadPay from the keeper's bar
  const spent = await p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.ammo = 0; c.keeper.reloading = 0; const m = c.mana; const before = m.cur; c.events.length = 0
    const host = (window as any).__ather; return { before, has: typeof host.reloadNow === 'function' } })
  await p.keyboard.down('KeyR'); await wait(80); await p.keyboard.up('KeyR'); await wait(600)
  const after = await p.evaluate(() => (window as any).__ather.combat().mana.cur)
  ok(Math.abs(spent.before - after - want.reloadPay!) < 1e-6, `a reload spent ${(spent.before - after).toFixed(3)} mana (want ${want.reloadPay})`)
  await p.close()
}

// ── (B) the Temple: re-cut with a new blank ──
{
  let inv = newInv(); inv = give(inv, 'sigil_blank', 1).inv; inv = give(inv, letterItem('stone'), 1).inv
  const p: Page = await br.newPage()
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.goto(`${URL}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
  await p.evaluate((invJson, loJson) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', invJson); localStorage.setItem('open.loadout.v1', loJson); localStorage.removeItem('ather:trade:trial-ledger'); localStorage.setItem('open.idris.met', '1') }, JSON.stringify(inv), JSON.stringify(LO))
  await p.setViewport({ width: 960, height: 640 })
  await p.goto(`${URL}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await wait(2000)
  await p.keyboard.press('KeyW'); await wait(500)
  const key = 'front:enchant-temple'
const goTo = async () => {
  const d = doorByKey(R, key)!, fx = Math.cos(d.b.yaw), fz = Math.sin(d.b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), d.at.x, d.at.z); await wait(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), d.at.x + fx, d.at.z + fz, yaw); await wait(3000)
  ok(await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:enchant-temple'), 'the Temple door in reach')
  await p.keyboard.press('KeyE')
}
const marks = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{"marks":1500}').marks ?? 1500)
const bagHas = (id: string) => p.evaluate((id) => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as any[]).filter(Boolean).filter(s => s.id === id).reduce((a, s) => a + s.n, 0), id)
const sigil = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.loadout.v1') ?? '{}').fit?.repeater?.sigil ?? null)
const answers = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace('›', '').trim()))
const answer = async (label: string) => { await p.evaluate((l) => ([...document.querySelectorAll<HTMLElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l)))?.click(), label); await wait(900) }
const lines = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-panel="idris-panel"] [data-idris-line]')].map(e => e.dataset.idrisLine))
const click = (sel: string) => p.evaluate((s) => { const b = document.querySelector<HTMLElement>(`${s} button`) ?? document.querySelector<HTMLElement>(s); if (!b || (b as HTMLButtonElement).disabled) return false; b.click(); return true }, sel)
const openIdris = async () => {
  await goTo()
  ok(await poll(async () => (await answers()).includes(DOOR_ASK.idris), 15000), `the Temple's answers carry Idris: ${(await answers()).join(' / ')}`)
  await answer(DOOR_ASK.idris)
  ok(await poll(async () => !!(await p.$('[data-panel="idris-panel"]')), 15000), "Idris's counter opens")
}
  const startMarks = await marks()
  await openIdris()
  ok(JSON.stringify(await sigil()) === '["star","life"]', 'the Repeater arrives with [star, life]')
  ok(await click('[data-idris-recut]'), 'New sigil pressed'); await wait(400)
  ok(!!(await p.$('[data-idris-recut="on"]')) && !!(await p.$('[data-idris-recut-note]')), 're-cut on: the warning shows')
  ok(await click('[data-idris-letter="stone"]'), 'pick Stone'); await wait(300)
  ok(await click('[data-idris-cut]'), 'Cut it'); await wait(400)
  ok(await p.evaluate(() => (document.querySelector('[data-idris-confirm]')?.textContent ?? '').includes('replaces the old sigil')), 'confirm names the replacement')
  await p.screenshot({ path: `/tmp/m93s4-${++shot}.png` })
  ok(await click('[data-idris-do]'), 'confirmed'); await wait(1200)
  ok(JSON.stringify(await sigil()) === '["stone"]', `re-cut: the sigil is now ${JSON.stringify(await sigil())}`)
  ok((await bagHas('sigil_blank')) === 0 && (await bagHas(letterItem('stone'))) === 0 && (await bagHas(letterItem('star'))) === 0, 'the blank + Stone spent, the old letters not returned')
  ok((await marks()) === startMarks - SIGIL_CUT_FEE, `one fee (${startMarks} -> ${await marks()})`)
  await p.screenshot({ path: `/tmp/m93s4-${++shot}.png` })
}
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(fails ? `FAIL (${fails})` : 'PASS')
await br.close()
process.exit(fails ? 1 : 0)
