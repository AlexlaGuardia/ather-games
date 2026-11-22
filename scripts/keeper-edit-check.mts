// ── Check for the Character tab's KEEPERS EDIT (BETA M66 s3, 2026-11-22, play lane) ──────────────────────────────────
// A fresh profile signed in as a TEST account (the client's own /api/auth/session answer is faked at the network layer,
// exactly as beta-m12-swap does; no server, cookie or real account is touched, and the cloud lease 401s so nothing is
// pushed). Keeper A is born, keeper B is added as a parked keeper, then on the pack's Character tab:
//   rename A by Enter, B by Save, Escape cancels; the names survive a RELOAD (the round-trip);
//   delete refuses the ACTIVE keeper and a TAP (both say why, both leave the row); a HELD press deletes B: gone from the
//   list, from the roster, its parked keys gone, a tombstone left for the cloud push; still gone after a reload; 0 errors.
//   npx tsx scripts/keeper-edit-check.mts [--url https://ather.games] [--out /tmp/keeper-edit] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL_ = flag('--url', 'https://ather.games'), OUT = flag('--out', '/tmp/keeper-edit'), phone = process.argv.includes('--phone')
mkdirSync(OUT, { recursive: true })
const tag = phone ? 'phone' : 'desk'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const errs: string[] = []
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const profile = mkdtempSync(join(tmpdir(), 'keeper-edit-'))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', userDataDir: profile,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
if (phone) { await p.setUserAgent(UA); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }) }
else await p.setViewport({ width: 1280, height: 760 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.setRequestInterception(true)
p.on('request', r => r.url().includes('/api/auth/session')
  ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: { user_id: 'keeper-edit-test', username: 'keepertest', character_id: null, avatar: null } }) })
  : r.continue())

const ready = async () => {
  await p.waitForFunction(() => !!(window as any).__ather, { timeout: 240000 }).catch(() => {})
  await sleep(6000)   // the owner resolves a few frames late
  if (!(await p.evaluate(() => !!document.querySelector('[data-panel="birth"]')))) { await tapText(/^Tap to start$/); await sleep(800) }   // the intro card
}
const gateUp = () => p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))
const tapText = async (re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  if (phone) await p.touchscreen.tap(box.x, box.y); else await p.mouse.click(box.x, box.y)
  return true
}
const openCharacter = async () => {
  await p.keyboard.press('Escape').catch(() => {}); await sleep(300)
  await p.keyboard.press('KeyP'); await sleep(1500)
  await p.evaluate(() => document.querySelector<HTMLElement>('[data-pack-tab="character"]')?.click()); await sleep(900)
  await p.evaluate(() => document.querySelector('[data-char-section="keepers"]')?.scrollIntoView({ block: 'start' })); await sleep(900)
}
// the Options menu mounts its own list too: scope every selector to the Character tab's Keepers section
const K = '[data-char-section="keepers"] '
const rows = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-char-section="keepers"] [data-keepers] [data-keeper]')].map(e => ({
  id: e.dataset.keeper!, active: e.dataset.active === '1', name: e.dataset.name ?? '', label: e.querySelector('[data-keeper-label]')?.textContent ?? '' })))
const roster = () => p.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; const m = /^u:(.+):ather:roster\.v1$/.exec(k); if (m) return { owner: m[1], r: JSON.parse(localStorage.getItem(k)!) } }
  return null
})
const keys = () => p.evaluate(() => { const o: string[] = []; for (let i = 0; i < localStorage.length; i++) o.push(localStorage.key(i)!); return o })
const hint = (id: string) => p.evaluate((sel: string) => document.querySelector(sel)?.textContent ?? null, `[data-char-section="keepers"] [data-keeper="${id}"] [data-keeper-hint]`)
const center = (sel: string) => p.evaluate((s: string) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null }, sel)
/** Press and hold for `ms` with the REAL input device of the mode: a mouse on desk, a touch on phone. */
const hold = async (sel: string, ms: number) => {
  const c = await center(sel); if (!c) return false
  if (phone) { const t = await p.touchscreen.touchStart(c.x, c.y); await sleep(ms); await t.end() }
  else { await p.mouse.move(c.x, c.y); await p.mouse.down(); await sleep(ms); await p.mouse.up() }
  return true
}
const tapSel = async (sel: string) => { const c = await center(sel); if (!c) return false; if (phone) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y); return true }
const typeName = async (id: string, name: string) => {
  await p.click(`${K}[data-keeper="${id}"] [data-keeper-name-input]`, { clickCount: 3 }).catch(() => {})
  await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control')
  await p.keyboard.press('Backspace'); await p.keyboard.type(name, { delay: 30 })
}

console.log(`M66 s3 keeper edit  url=${URL_}  ${tag}\n`)
await p.goto(`${URL_}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await ready()
ok(await poll(gateUp, 30000), 'keeper A: the birth gate shows')
ok(await tapText(/^BE BORN/), 'keeper A: tapped BE BORN')
ok(await poll(async () => !(await gateUp()), 30000), 'keeper A: gate closes')
await sleep(2500); await tapText(/^Tap to start$/); await sleep(1000)

// keeper B: a parked keeper with A's rune (exactly what addKeeper + a birth would leave), A stays active
const r0 = await roster()
ok(!!r0 && r0.r.keepers.length === 1, `one keeper in the roster (${JSON.stringify(r0?.r)})`)
const A = r0!.r.active as string, B = 'k_b0b0b0b0b0b0', owner = r0!.owner
await p.evaluate((o: string, bId: string) => {
  const rk = `u:${o}:ather:roster.v1`, r = JSON.parse(localStorage.getItem(rk)!)
  r.keepers.push({ id: bId, created_at: Date.now() }); localStorage.setItem(rk, JSON.stringify(r))
  localStorage.setItem(`u:${o}:k:${bId}:ather:shimmer:birthRune`, localStorage.getItem(`u:${o}:ather:shimmer:birthRune`) ?? 'star')
  localStorage.setItem(`u:${o}:k:${bId}:open.inv.v1`, '{"slots":[]}')
}, owner, B)
await p.reload({ waitUntil: 'load', timeout: 240000 }); await ready()
ok(!(await gateUp()), 'A is not sent through the birth gate')
await openCharacter()
let rs = await rows()
ok(rs.length === 2 && rs.find(x => x.id === A)?.active === true && rs.find(x => x.id === B)?.active === false, `Character lists A (active) + B (${JSON.stringify(rs)})`)
await p.screenshot({ path: `${OUT}/${tag}-1-two.png` })

// RENAME A by Enter
ok(await tapSel(`${K}[data-keeper="${A}"] [data-keeper-act="rename"]`), 'tapped Rename on A')
await sleep(400)
ok(await p.evaluate((sel: string) => document.activeElement === document.querySelector(sel), `${K}[data-keeper="${A}"] [data-keeper-name-input]`), 'the name field takes focus')
await typeName(A, 'Wren of the Glade'); await p.screenshot({ path: `${OUT}/${tag}-2-renaming.png` })
await p.keyboard.press('Enter'); await sleep(500)
rs = await rows()
ok(rs.find(x => x.id === A)?.name === 'Wren of the Glade' && rs.find(x => x.id === A)?.label === 'Wren of the Glade', `Enter saved A's name (${JSON.stringify(rs.find(x => x.id === A))})`)
ok(await p.evaluate((o: string) => localStorage.getItem(`u:${o}:open.keeper.name.v1`), owner) === 'Wren of the Glade', 'A (active) name stored in the live slot')
ok(await p.evaluate(() => !!document.querySelector('[data-panel^="pack-"]')), 'typing did not close the pack (keys stayed in the field)')
// ESCAPE cancels
await tapSel(`${K}[data-keeper="${A}"] [data-keeper-act="rename"]`); await sleep(400)
await typeName(A, 'zzz'); await p.keyboard.press('Escape'); await sleep(500)
ok((await rows()).find(x => x.id === A)?.name === 'Wren of the Glade', 'Escape cancelled the edit')
// RENAME B by Save
await tapSel(`${K}[data-keeper="${B}"] [data-keeper-act="rename"]`); await sleep(400)
await typeName(B, 'Pip'); await tapSel(`${K}[data-keeper="${B}"] [data-keeper-act="save"]`); await sleep(500)
ok((await rows()).find(x => x.id === B)?.name === 'Pip', 'Save stored B\'s name')
ok(await p.evaluate((o: string, id: string) => localStorage.getItem(`u:${o}:k:${id}:open.keeper.name.v1`), owner, B) === 'Pip', 'B (parked) name stored in its parked slot')

// a pointer/touch log on the delete buttons, printed when a delete assert fails (the phone lost a pointerup once)
await p.evaluate(() => { const w = window as any; w.__pe = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'pointerleave', 'touchstart', 'touchend', 'touchcancel', 'click', 'lostpointercapture'])
  window.addEventListener(t, e => { const el = (e.target as HTMLElement)?.closest?.('[data-keeper-act]') as HTMLElement | null; w.__pe.push(`${Math.round(e.timeStamp)} ${t} ${el ? el.dataset.keeperAct + '@' + (el.closest('[data-keeper]') as HTMLElement)?.dataset.keeper?.slice(-4) : (e.target as HTMLElement)?.tagName}`) }, true) })
const peLog = async () => console.log('    events: ' + (await p.evaluate(() => ((window as any).__pe ?? []).splice(0).join(' | '))))
// DELETE refusals: the active keeper, and a tap
await hold(`${K}[data-keeper="${A}"] [data-keeper-act="delete"]`, 1600); await sleep(200)
ok((await hint(A)) === 'Switch to another keeper first' && (await rows()).some(x => x.id === A), `held delete on the ACTIVE keeper refused, says why (${await hint(A)})`)
await sleep(2400)
await tapSel(`${K}[data-keeper="${B}"] [data-keeper-act="delete"]`); await sleep(250)
ok((await hint(B)) === 'Hold to delete' && (await rows()).some(x => x.id === B), `a TAP on delete only explains (${await hint(B)})`); await peLog()
await p.screenshot({ path: `${OUT}/${tag}-3-hint.png` })
await sleep(2400)
// the short hold is driven IN THE PAGE with exact timing: a headless touch stretched a "0.5 s" hold to 1.8 s of page time
// once, which honestly deletes. Real PointerEvents through React's own listeners, so the product path is the same.
await p.evaluate((sel: string) => new Promise<void>(res => {
  const el = document.querySelector(sel)!, o = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, pointerId: 7 }
  el.dispatchEvent(new PointerEvent('pointerdown', o)); setTimeout(() => { el.dispatchEvent(new PointerEvent('pointerup', o)); res() }, 500)
}), `${K}[data-keeper="${B}"] [data-keeper-act="delete"]`); await sleep(1200)
ok((await rows()).some(x => x.id === B), 'a SHORT hold (0.5 s) does not delete'); await peLog()

// round-trip: reload, names still there
await p.reload({ waitUntil: 'load', timeout: 240000 }); await ready(); await openCharacter()
rs = await rows()
ok(rs.length === 2 && rs.find(x => x.id === A)?.name === 'Wren of the Glade' && rs.find(x => x.id === B)?.name === 'Pip', `names survive a reload (${JSON.stringify(rs.map(x => x.name))})`)
await p.screenshot({ path: `${OUT}/${tag}-4-named.png` })

// HELD delete of B
await hold(`${K}[data-keeper="${B}"] [data-keeper-act="delete"]`, 1700); await sleep(500)
rs = await rows()
ok(rs.length === 1 && rs[0].id === A && rs[0].active, `held delete removed B, A still active (${JSON.stringify(rs)})`)
const r1 = await roster()
ok(!r1!.r.keepers.some((k: { id: string }) => k.id === B) && r1!.r.active === A, 'B gone from the roster record')
ok(Array.isArray(r1!.r.retired) && r1!.r.retired.some((t: { id: string }) => t.id === B), `a tombstone for the cloud push (${JSON.stringify(r1!.r.retired)})`)
ok(!(await keys()).some(k => k.startsWith(`u:${owner}:k:${B}:`)), 'B\'s parked keys are gone')
ok(await p.evaluate((o: string) => localStorage.getItem(`u:${o}:open.keeper.name.v1`), owner) === 'Wren of the Glade', 'A\'s live data untouched')
await p.screenshot({ path: `${OUT}/${tag}-5-deleted.png` })
await p.reload({ waitUntil: 'load', timeout: 240000 }); await ready(); await openCharacter()
rs = await rows()
ok(rs.length === 1 && rs[0].id === A && rs[0].name === 'Wren of the Glade', 'still one keeper, still named, after a reload')
ok(await p.evaluate(() => { const f = document.querySelector('[data-panel^="pack-"]')?.getBoundingClientRect(); return f ? f.left >= 0 && f.right <= window.innerWidth + 0.5 : false }), 'the pack fits the viewport')
ok(errs.length === 0, `no page errors${errs.length ? ': ' + [...new Set(errs)].slice(0, 4).join(' | ') : ''}`)
await b.close(); try { rmSync(profile, { recursive: true, force: true }) } catch { /* tmp */ }
console.log(fails ? `\nkeeper-edit-check: ${fails} FAIL` : '\nkeeper-edit-check: PASS')
process.exit(fails ? 1 : 0)
