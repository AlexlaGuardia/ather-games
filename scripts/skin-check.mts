// BETA M59 THE MANA SKIN on prod (or a devwin). The bracelet holds Threshold (a field with a 20 shell); Q drops it, the field is
// slid under the keeper, a Shambler is set on them: its blows drain the skin (the highlight + its +N over the health bar), health
// untouched; the skin is set low (cracks/flicker) then the next blow POPS it: the shatter + edge flash draw, the pop sound is
// requested once (proposed = silent: counted by window.__sfx.asked), only the spill reaches health. Shots: full / low / popping.
//   npx tsx scripts/skin-check.mts [origin] [--size WxH] [--tag name] [--keys]
//   --keys: a phone-size viewport driven by the keyboard (Q), for the bar's phone layout; the touch cast path is not this check's
import puppeteer from 'puppeteer-core'
const args = process.argv.slice(2), flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
const origin = args.find(a => a.startsWith('http')) ?? 'https://ather.games'
const [W, H] = (flag('--size') ?? '1100x700').split('x').map(Number), tag = flag('--tag') ?? `${W}x${H}`
const dir = process.env.SHOTS ?? 'shots/skin-1121'
import { mkdirSync } from 'fs'; mkdirSync(dir, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: W, height: H, ...(W < 600 && !args.includes('--keys') ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
const errors: string[] = []
p.on('pageerror', e => errors.push(String(e)))
const cerr: string[] = []; p.on('console', m => { if (m.type() === 'error') cerr.push(m.text().slice(0, 160)) })
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['charred-rifle', 'repeater'], primary: 'charred-rifle', secondary: 'repeater', kael: true,
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: 'Threshold' }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: 'Cyclone Cage' }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
})
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(5000)
await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {})   // the dev overlay sits on the bar
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
if (W >= 600 || args.includes('--keys')) await p.mouse.click(W / 2, H / 2); else await p.touchscreen.tap(W / 2, H / 3)
await sleep(800)
await p.waitForFunction(() => typeof (window as any).__ather?.look === 'function', { timeout: 60000 }); await p.evaluate(() => (window as any).__ather.look(0, -0.25)); await sleep(600)
await p.evaluate(() => { (window as any).__ather.combat().hollows.length = 0 })
// the bar: whichever shield layer is on screen (the wide Health card, or the lip on a phone)
const bar = () => p.evaluate(() => {
  const els = [...document.querySelectorAll('[data-shield]')] as HTMLElement[]
  const el = els.find(e => e.getBoundingClientRect().width > 0 || (e.parentElement?.getBoundingClientRect().width ?? 0) > 0) ?? null
  if (!el) return null
  const card = (el.closest('.w-52') ?? el.closest('.rounded-\\[10px\\]') ?? el.parentElement!.parentElement!) as HTMLElement, r = card.getBoundingClientRect()
  return { trackW: +el.parentElement!.getBoundingClientRect().width.toFixed(1), w: el.style.width, skin: el.dataset.skin ?? null, text: card.innerText.replace(/\s+/g, ' ').trim(), pop: !!card.querySelector('[data-skin-pop]'), box: { x: r.x, y: r.y, width: r.width, height: r.height } }
})
const crop = async (name: string) => { const s = await bar(); const pad = 18
  if (s) await p.screenshot({ path: `${dir}/${tag}-${name}.png`, clip: { x: Math.max(0, s.box.x - pad), y: Math.max(0, s.box.y - pad - 20), width: Math.min(W, s.box.width + pad * 2), height: s.box.height + pad * 2 + 20, scale: 2 } })
  await p.screenshot({ path: `${dir}/${tag}-${name}-full.png` }) }
const asked = () => p.evaluate(() => (window as any).__sfx?.asked?.() ?? {})
const trackNone = (await bar())?.trackW ?? -1   // hp 100, no skin: the width the +N must not change
// 1) Q drops Threshold; slide it under the keeper
await p.keyboard.press('KeyQ')
// poll for the field, not a fixed 400 ms: on the slower EliteDesk the cast lands later and every step after this read null (11-21 pm)
await p.waitForFunction(() => ((window as any).__ather.combat().fields ?? []).length > 0, { timeout: 15000 }).catch(() => {})
const placed = await p.evaluate(() => { const c = (window as any).__ather.combat(), f = c.fields?.[0], at = c.keeper.at; if (!f || !at) return null; f.x = at.x; f.z = at.z; f.until = (c.clock ?? 0) + 60; return { shell: f.shell, max: f.shellMax } })
ok(!!placed && placed.shell === 20, `Threshold placed with a 20 Mana Skin (${JSON.stringify(placed)})`)
const barIs = (fn: string) => p.waitForFunction(`(() => { const e = [...document.querySelectorAll('[data-shield]')].find(e => (e.parentElement?.getBoundingClientRect().width ?? 0) > 0); return !!e && (${fn})(e) })()`, { timeout: 60000, polling: 100 }).catch(() => {})
await barIs("e => e.dataset.skin === 'on'"); await sleep(300)
let s = await bar()
ok(!!s && s.skin === 'on' && parseFloat(s.w) > 0 && /\+20/.test(s.text), `full: the highlight lies over the bar with +20 (${JSON.stringify(s && { w: s.w, skin: s.skin, text: s.text })})`)
await crop('full')
const trackFull = s?.trackW ?? -1
ok(Math.abs(trackFull - trackNone) < 0.6, `the health bar keeps its width when the +N shows (hp 100: ${trackNone} -> ${trackFull})`)
// 2) a Shambler at arm's length: its blows land on the skin, health untouched
const hp0 = await p.evaluate(() => (window as any).__fight.hp())
await p.evaluate(() => { const a = (window as any).__ather, c = a.combat(), at = c.keeper.at; c.hollows.length = 0; a.spawn(0, -1.5); const h = c.hollows.at(-1); h.x = at.x + 0.9; h.z = at.z - 0.5; h.state = 'chase' })
await p.waitForFunction(() => { const f = (window as any).__ather.combat().fields?.[0]; return f && f.shell < 20 }, { timeout: 120000 }).catch(() => {})
if (process.env.DBG) for (let i = 0; i < 6; i++) { console.log(JSON.stringify(await p.evaluate(() => { const c = (window as any).__ather.combat(), at = c.keeper.at; return { at, clock: c.clock, h: c.hollows.map((h: any) => ({ s: h.state, x: +h.x.toFixed(1), z: +h.z.toFixed(1), y: +h.y.toFixed(1), fx: h.fx })), active: (window as any).__fight?.hp() } }))); await sleep(1000) }
const mid = await p.evaluate(() => ({ shell: (window as any).__ather.combat().fields?.[0]?.shell, hp: (window as any).__fight.hp() }))
ok(mid.shell !== undefined && mid.shell < 20 && mid.hp === hp0, `a blow drains the skin, health untouched (shell ${mid.shell}, hp ${hp0} -> ${mid.hp})`)
ok(((await asked())['mana-skin-tick'] ?? 0) >= 1, `the glassy tick was requested (${JSON.stringify(await asked())})`)
// 3) low: under 25% the highlight cracks and flickers (stop the Shambler for the shot)
await p.evaluate(() => { const c = (window as any).__ather.combat(); for (const h of c.hollows) { h.state = 'stagger'; h.t = 99 } const f = c.fields[0]; if (f && !f.popped) f.shell = 4 })
await barIs("e => e.dataset.skin === 'low'")
s = await bar()
ok(!!s && s.skin === 'low' && /\+4/.test(s.text), `low: cracked/flickering at +4 (${JSON.stringify(s && { skin: s.skin, text: s.text })})`)
await crop('low')
// 4) the next blow pops it: shatter + flash on the bar, the pop requested once, only the spill reaches health
// freeze the shatter ~150 ms in for the shot (swiftshader screenshots take longer than the 620 ms it lasts)
await p.evaluate(() => { (window as any).__skinPopHold = true })
await p.addStyleTag({ content: '[data-skin-pop] span{animation-delay:-150ms!important;animation-play-state:paused!important}' })
const popsBefore = (await asked())['mana-skin-pop'] ?? 0
const hpBefore = await p.evaluate(() => (window as any).__fight.hp())
await p.evaluate(() => { const c = (window as any).__ather.combat(); for (const h of c.hollows) { h.state = 'chase'; h.t = 0 } })
await p.waitForFunction(() => !!document.querySelector('[data-skin-pop]'), { timeout: 120000, polling: 30 }).catch(() => {})
await sleep(300); await crop('popping')
await p.waitForFunction(() => ((window as any).__ather.combat().fields ?? []).length === 0, { timeout: 60000 }).catch(() => {})
await barIs("e => parseFloat(e.style.width) === 0")
const after = await p.evaluate(() => { const c = (window as any).__ather.combat(); for (const h of c.hollows) { h.state = 'stagger'; h.t = 99 } return { fields: (c.fields ?? []).length, hp: (window as any).__fight.hp() } })
const pops = ((await asked())['mana-skin-pop'] ?? 0) - popsBefore
ok(pops === 1, `the pop (whip-crack) was requested exactly once (${pops})`)
ok(after.fields === 0, `the field is gone with its skin (${after.fields} left)`)
ok(after.hp === hpBefore - 10 || after.hp === hpBefore - 9, `only the spill reached health: 14 - 4 = 10 (hp ${hpBefore} -> ${after.hp})`)
s = await bar()
ok(!!s && (s.w === '0%' || parseFloat(s.w) === 0) && !/\+\d/.test(s.text), `after: no highlight, no +N (${JSON.stringify(s && { w: s.w, text: s.text })})`)
if (cerr.length) console.log('console errors:', [...new Set(cerr)].slice(0, 4).join(' || '))
ok(errors.length === 0, `0 page errors (${errors.slice(0, 2).join(' | ')})`)
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
