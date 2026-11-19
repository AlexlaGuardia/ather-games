// ── THE KEEPER CREATOR, PLAYED (BETA M29 slice 1, play / Jin 4 ccb58127, 11-19) ─────────────────────────────────────────
// Alex's signed-off mock (docs/looks/keeper-creator.html) in the game. In the real page:
//   1. a NEW keeper: the birth rune, then (after the born moment) the creator shows; pick Frame Large, Long hair, a scarf;
//      Looks good -> the gate closes and the look is saved per keeper
//   2. reload: the look is kept; the Character tab shows the keeper's figure + 'Large'; Change look opens the creator on the
//      saved choices; Random rolls the look rows and NEVER the frame
//   3. never a gate you can get stuck in (hub 11-19): a second new keeper taps Looks good at once -> the default is saved and
//      the gate closes
//   4. phone 390 x 844: the creator fits (Looks good on screen, no sideways scroll), the preview canvas is there
//   6. (slice 2) the first-person mittens wear the hands colour
//   7. Large in the fight: the combat keeper's hitbox x1.16 and blows cost x0.9 (a 14 blow costs 13)
//   8. Small: the walker's speed x1.05 of Large, hitbox x0.88, full cost
//   5. 0 page errors
// SETUP: a fresh browser per keeper. Hooks: none for the creator (real clicks on real buttons); reading localStorage.
//   npx tsx scripts/creator-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { OPT, LOOK_KEY, FRAME_STATS } from '../src/app/shimmer/open/shared/keeper-look'
import { blowCost } from '../src/app/shimmer/open/ather/combat'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
async function fresh(w: number, h: number): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  return p
}
const tapText = async (p: Page, re: RegExp) => {
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
  await p.mouse.click(box.x, box.y); return true
}
const creatorUp = (p: Page) => p.evaluate(() => !!document.querySelector('[data-panel="keeper-creator"]'))
const pick = (p: Page, row: string, i: number) => p.evaluate((r: string, n: number) => { const b = document.querySelector<HTMLElement>(`[data-creator-row="${r}"] [data-opt="${n}"]`); b?.click(); return !!b }, row, i)
const pressed = (p: Page, row: string) => p.evaluate((r: string) => Number(document.querySelector(`[data-creator-row="${r}"] [aria-pressed="true"]`)?.getAttribute('data-opt') ?? -1), row)
const saved = (p: Page) => p.evaluate((k: string) => JSON.parse(localStorage.getItem(k) ?? 'null'), LOOK_KEY) as Promise<Record<string, number> | null>
const born = async (p: Page, tag: string) => {
  await sleep(6000)
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))), `${tag}: the birth gate shows`)
  ok(await tapText(p, /^BE BORN/), `${tag}: tapped BE BORN`)
}

// ── 1: born, then the creator ──
const p = await fresh(1100, 760)
await born(p, '1')
ok(await poll(() => creatorUp(p), 30000), '1. after the born moment the creator shows')
ok(await p.evaluate(() => !!document.querySelector('[data-creator-preview] canvas, [data-panel="keeper-creator"] canvas')), '1. ...with the turning preview')
const LARGE = OPT.frame.indexOf('Large'), LONG = OPT.hairStyle.indexOf('Long')
ok((await pressed(p, 'ears')) === OPT.ears.indexOf('Pointed'), '1. Ears: Pointed by default (canon, Magii 11-19)')
ok(await pick(p, 'frame', LARGE) && await pick(p, 'hairStyle', LONG) && await pick(p, 'scarf', 3), '1. pick Frame Large, Long hair, scarf 4')
ok((await pressed(p, 'frame')) === LARGE && (await p.evaluate(() => document.querySelector('[data-frame-note]')?.textContent ?? '')).includes('defence'), '1. ...the frame note says what Large does')
await p.evaluate(() => (document.querySelector('[data-creator-done]') as HTMLElement | null)?.click())
ok(await poll(async () => !(await creatorUp(p)) && !(await p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))), 20000), '1. Looks good closes the gate')
const s1 = await saved(p)
ok(s1?.frame === LARGE && s1?.hairStyle === LONG && s1?.scarf === 3, `1. ...and the look is saved per keeper (${JSON.stringify(s1)})`)

// ── 2: kept across a reload; the Character tab; Change look; Random never rolls the frame ──
await p.reload({ waitUntil: 'load', timeout: 240000 }); await sleep(6000)
ok(!(await creatorUp(p)) && (await saved(p))?.frame === LARGE, '2. after a reload the look is kept and the creator does not reopen')
await p.keyboard.press('KeyP')
ok(await poll(() => p.evaluate(() => (document.querySelector('[data-look-card]')?.textContent ?? '').includes('Large')), 20000), '2. the Character tab shows the keeper and Frame Large')
await p.evaluate(() => (document.querySelector('[data-change-look]') as HTMLElement | null)?.click())
ok(await poll(() => creatorUp(p), 10000) && (await pressed(p, 'hairStyle')) === LONG && (await pressed(p, 'frame')) === LARGE, '2. Change look opens the creator on the saved choices')
const before = await p.evaluate(() => [...document.querySelectorAll('[data-creator-row] [aria-pressed="true"]')].map(e => e.getAttribute('data-opt')).join(','))
for (let i = 0; i < 3; i++) { await p.evaluate(() => (document.querySelector('[data-creator-random]') as HTMLElement | null)?.click()); await sleep(400) }
const after = await p.evaluate(() => [...document.querySelectorAll('[data-creator-row] [aria-pressed="true"]')].map(e => e.getAttribute('data-opt')).join(','))
ok(after !== before && (await pressed(p, 'frame')) === LARGE, `2. Random rolls the look and never the frame (${before} -> ${after})`)
await p.evaluate(() => (document.querySelector('[data-creator-done]') as HTMLElement | null)?.click()); await sleep(800)
ok((await saved(p))?.frame === LARGE, '2. ...saved, frame still Large')
// ── slice 2: the POV mittens + FRAME in play (still Large, now hands colour 3) ──
const A = (f: string, ...a: unknown[]) => p.evaluate((f, a) => (window as any).__ather[f](...a), f, a)
await p.evaluate((k: string) => { const v = JSON.parse(localStorage.getItem(k)!); v.accent = 3; v.frame = 2; localStorage.setItem(k, JSON.stringify(v)) }, LOOK_KEY)
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await poll(async () => (await p.evaluate(() => (window as any).__ather?.zone?.())) === 'wilds', 240000); await sleep(4000); await p.mouse.click(550, 380); await sleep(800)
ok(await poll(async () => (await p.evaluate(() => (window as any).__fpHands?.() ?? '')) === OPT.accent[3], 20000), `6. the first-person mittens are the hands colour (${await p.evaluate(() => (window as any).__fpHands?.() ?? '')} vs ${OPT.accent[3]})`)
await poll(async () => (await p.evaluate(() => (window as any).__ather.combat?.()?.keeper?.hit)) !== undefined, 30000)
const kL = await p.evaluate(() => { const k = (window as any).__ather.combat().keeper; return { hit: k.hit, takes: k.takes } })
ok(kL.hit === FRAME_STATS[2].hit && kL.takes === FRAME_STATS[2].damage, `7. Large in the fight: hitbox x${kL.hit}, takes x${kL.takes}`)
ok(blowCost({ takes: FRAME_STATS[2].damage } as never, 14) === 13 && blowCost({} as never, 14) === 14, '7. ...a 14 blow costs a Large keeper 13, the baseline 14')
const spL = await A('speedMult') as number
await p.evaluate((k: string) => { const v = JSON.parse(localStorage.getItem(k)!); v.frame = 0; localStorage.setItem(k, JSON.stringify(v)) }, LOOK_KEY)
// back to the WILDS (the page drops ?waymark= once it has landed, so a bare reload would land on the plot, where no fight runs)
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await poll(async () => (await p.evaluate(() => (window as any).__ather?.zone?.())) === 'wilds', 240000); await sleep(4000); await p.mouse.click(550, 380); await sleep(800)
const spS = await A('speedMult') as number
await poll(async () => (await p.evaluate(() => (window as any).__ather.combat?.()?.keeper?.hit)) !== undefined, 30000)   // set by the fight's frame loop: poll, never a fixed wait
const kS = await p.evaluate(() => { const k = (window as any).__ather.combat().keeper; return { hit: k.hit, takes: k.takes } })
ok(Math.abs(spS / spL - 1.05) < 1e-6 && kS.hit === FRAME_STATS[0].hit && kS.takes === 1, `8. Small: walks x1.05 of Large (${spL} -> ${spS}), hitbox x${kS.hit}, takes x${kS.takes}`)
await p.close()

// ── 3 + 4: a phone, and straight through ──
const q = await fresh(390, 844)
await born(q, '3')
ok(await poll(() => creatorUp(q), 30000), '3. phone: the creator shows after the rune')
const fit = await q.evaluate(() => {
  const d = document.querySelector('[data-creator-done]')?.closest('button')?.getBoundingClientRect()
  return { done: !!d && d.bottom <= innerHeight + 1 && d.top >= 0 && d.right <= innerWidth + 1, wide: document.documentElement.scrollWidth <= innerWidth + 1, canvas: !!document.querySelector('[data-panel="keeper-creator"] canvas') }
})
ok(fit.done && fit.wide && fit.canvas, `4. phone 390: Looks good on screen, no sideways scroll, preview there (${JSON.stringify(fit)})`)
await q.evaluate(() => (document.querySelector('[data-creator-done]') as HTMLElement | null)?.click())
ok(await poll(async () => !(await creatorUp(q)), 15000) && (await saved(q))?.frame === 1, '3. Looks good at once: the gate closes with the default look saved (never stuck)')
await q.close()

ok(errs.length === 0, `5. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `creator-check: ${fails} FAIL` : 'creator-check: PASS')
process.exit(fails ? 1 : 0)
