// #262 slice 3 — can a keeper actually pour an infusion into a spirit, in the real page?
//
// ★ THIS IS A PAGE TEST ON PURPOSE. `engine/alchemy.test.ts` proves `applyInfusion` adds a point,
// refuses at the caps and never eats a bottle it refused. It cannot prove the grimoire CALLS it,
// that the button is reachable, or that the pour is persisted — and "the panel worked but nothing
// was written" is the failure that costs a keeper a tier-2 brew. Same split as move-check.mts.
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SETTLE = Number(process.env.SETTLE ?? 14)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1280,900'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'freeze')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['freeze']))
  })
  const KEY = process.env.OWNER_KEY
  if (!KEY) { console.error('OWNER_KEY not set — source /root/ather-games/.env first'); process.exit(2) }
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  ok(await page.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)),
     'harness is keeper of the realm (/give and /party will work)')
  await sleep(SETTLE * 1000)

  const cmd = async (line: string) => {
    await page.keyboard.press('KeyT'); await sleep(350)
    await page.keyboard.type(line); await page.keyboard.press('Enter'); await sleep(900)
    await page.keyboard.press('Escape'); await sleep(400)
  }
  const spirits = () => page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('ather:save:shimmer') ?? '{}').spirits ?? []) as any[] }
    catch { return [] }
  })

  await cmd('/party lend 2 30')
  await cmd('/give storm_infusion 3')
  const before = await spirits()
  ok(before.length === 2, `two spirits in the garden (${before.length})`)

  // open the bag → the grimoire face
  await page.keyboard.press('KeyI'); await sleep(900)
  const clicked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent ?? '').trim() === 'Grimoire')
    if (!b) return false
    ;(b as HTMLElement).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    return true
  })
  ok(clicked, 'the Grimoire tab is reachable from the bag')
  await sleep(700)

  const seen = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[title]'))
      .filter(b => /^(mana|storm|earth|water) ·/.test(b.getAttribute('title') ?? ''))
    return { count: btns.length, titles: btns.slice(0, 4).map(b => b.getAttribute('title')) }
  })
  ok(seen.count >= 8, `both spirits show all four pours (${seen.count} buttons, want 8)`)
  console.log(`    titles · ${JSON.stringify(seen.titles)}`)

  // pour one storm into the first spirit
  const poured = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button[title]'))
      .find(x => (x.getAttribute('title') ?? '').startsWith('storm ·')) as HTMLElement | undefined
    if (!b) return null
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    return true
  })
  ok(poured === true, 'the storm pour is clickable')
  await sleep(800)

  const note = await page.evaluate(() => {
    const d = Array.from(document.querySelectorAll('div')).map(x => (x.textContent ?? '').trim())
      .find(t => /takes the storm infusion/.test(t) && t.length < 120)
    return d ?? null
  })
  ok(!!note, `the panel says what happened — ${JSON.stringify(note)}`)

  const after = await spirits()
  const got = after[0]?.infusions?.storm ?? 0
  ok(got === 1, `★ the pour is PERSISTED to the save (spirits[0].infusions.storm = ${got})`)

  const held = await page.evaluate(() => document.body.innerText)
  ok(/storm/i.test(held), 'the grimoire is still showing after the pour')

  console.log(fails ? `\n${fails} FAILED` : '\nall clear')
} finally { await browser.close() }
process.exit(fails ? 1 : 0)
