// The brewing as the plot's event (2026-09-21) — in the real page.
//
// ★ A PAGE TEST, the `brew-check.mts` split: `brewing.test.ts` proves the ledger and the physical
// layer (reach, take, settle, light, pour). It cannot prove the PANEL opens on a placed cauldron,
// that `start` spends the bag, that a mortar four blocks away lists the pot and `take` runs it,
// that the pot hears the step without anyone standing at the mortar, that `light` drains mana and
// `pour` lands the bottle + XP — and "the panel worked but nothing was written" is the failure
// shape this world ships when nobody drives the page.
//
// ⚠ NOT COVERED: the physical right-click (pointer lock never comes headless). `/station x y z`
// raises the same panel through the same `openStationAt`, so everything downstream of the click
// is covered; the click itself is `interact.test.ts`'s intent assert. Alex's hands prove the click.
//
// Run: source .env && npx tsx scripts/brewing-check.mts   (WORLD_URL to aim elsewhere)
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SETTLE = Number(process.env.SETTLE ?? 14)
const SP = process.env.SP ?? '/tmp'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
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
  ok(await page.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)), 'harness is keeper of the realm')
  await sleep(SETTLE * 1000)

  // ⚠ The console stays OPEN after a reply, so a bare `T` next would type a "t" into it. Escape
  // first: it closes the console (or a panel, which the flow always closes before a command anyway).
  const cmd = async (line: string, wait = 900) => {
    await page.keyboard.press('Escape'); await sleep(300)
    await page.keyboard.press('KeyT'); await sleep(350)
    await page.keyboard.type(line); await page.keyboard.press('Enter'); await sleep(wait)
  }
  const panel = () => page.evaluate(() => document.querySelector('[data-panel="brewing"]')?.textContent ?? '')
  const press = (label: string) => page.evaluate((l: string) => {
    const b = Array.from(document.querySelectorAll('[data-panel="brewing"] button')).find(x => (x.textContent ?? '').trim() === l)
    if (!b) return false
    ;(b as HTMLElement).click()
    return true
  }, label)
  const pressRowStart = (potion: string) => page.evaluate((n: string) => {
    const row = Array.from(document.querySelectorAll('[data-panel="brewing"] > div > div > div')).find(d => (d.textContent ?? '').includes(n))
    const b = row?.querySelector('button')
    if (!b) return false
    ;(b as HTMLElement).click()
    return true
  }, potion)
  const close = async () => { await page.keyboard.press('Escape'); await sleep(400) }
  const bagHas = async (label: string) => {
    await page.keyboard.press('KeyI'); await sleep(900)
    const n = await page.evaluate((l: string) => {
      const t = Array.from(document.querySelectorAll('[title]')).map(e => e.getAttribute('title') ?? '').find(t => t.startsWith(l + ' ×'))
      return t ? Number(t.split('×')[1]) : 0
    }, label)
    await page.keyboard.press('Escape'); await sleep(500)
    return n
  }
  const bodyTail = () => page.evaluate(() => document.body.innerText.slice(-600))

  // ── the set: a cauldron three blocks off, a mortar four past it (at ~1: a put at foot level lands in the floor), the ingredients of a Shard Tonic ──
  // (alchemy 1, road = grind → pour: one road station, so a fresh keeper walks the whole shape).
  await cmd('/space plot', 8000)   // let the garden's columns land before building on them
  // ⚠ The FIRST put after the crossing does not land (the reply says it did; `/station` then says
  // "no station"; a second put at the same cell does land) — measured 09-21, not chased. Put twice.
  await cmd('/put cauldron ~3 ~1 ~'); await cmd('/put cauldron ~3 ~1 ~')
  await cmd('/put grinder ~7 ~1 ~'); await cmd('/put grinder ~7 ~1 ~')
  await cmd('/give raw_mana_shard 3')
  await cmd('/give goldwood_bark 2')
  ok(!/no such item/.test(await bodyTail()), 'the ingredients are items this world knows')

  // 1. the pot opens on the potion list and START spends the bag
  await cmd('/station ~3 ~1 ~')
  let t = await panel()
  ok(/the pot is empty/.test(t), 'the cauldron opens on an empty pot')
  ok(/Shard Tonic/.test(t) && /mortar → pour/.test(t), 'the Shard Tonic row shows its road: mortar → pour')
  ok(await pressRowStart('Shard Tonic'), 'START is pressable on the Shard Tonic')
  await sleep(600)
  t = await panel()
  ok(/Shard Tonic/.test(t) && /waiting on a mortar/.test(t) && /on the plot/.test(t), `the pot holds the tonic and waits on a mortar — "${t.slice(0, 160)}"`)
  ok(/tip out/.test(t) && !/light/.test(t.replace(/mana to light/g, '')), 'tip out is offered; light is not (the road is not walked)')
  await close()
  ok((await bagHas('Raw Mana Shard')) === 0 && (await bagHas('Goldwood Bark')) === 0, 'the ingredients left the bag at START')
  // the look-label: aim at the pot (east, 20° down from where the keeper stands) and read it
  // (the pitch that lands on the block moves with the spawn's exact feet; scan a few)
  let label = ''
  for (const pitch of [20, 16, 24, 12, 28]) {
    await cmd(`/look 90 ${pitch}`, 1200)
    label = /Cauldron[^\n]*/.exec(await page.evaluate(() => document.body.innerText))?.[0] ?? ''
    if (/Cauldron ·/.test(label)) break
  }
  ok(/Cauldron · Shard Tonic — waiting on a mortar/.test(label), `the pot's look-label says what it holds — "${label}"`)

  // 2. the mortar four blocks away lists the pot, and TAKE runs it
  await cmd('/station ~7 ~1 ~')
  t = await panel()
  ok(/MORTAR/i.test(t) && /1 brewing waiting on a mortar/.test(t) && /Shard Tonic/.test(t), `the mortar sees the pot waiting — "${t.slice(0, 140)}"`)
  ok(await press('take'), 'TAKE is pressable at the mortar')
  await sleep(600)
  t = await panel()
  ok(/goes back to the pot on its own/.test(t), 'the mortar runs the grind and says the pot will hear')
  await close()

  // 3. the pot hears the step with nobody at the mortar — on the clock
  await cmd('/station ~3 ~1 ~')
  t = await panel()
  // The grind is 3s and the walk back to the pot costs ~2.5s of harness latency, so either face
  // is honest here: the mortar still at work, or the step already settled into the pot.
  ok(/mortar at work/.test(t) || /⟳ mortar/.test(t) || /✓ mortar/.test(t), `on the walk back the pot says the mortar is at work, or already done — "${t.slice(0, 140)}"`)
  await close()
  await sleep(3500)                                              // grind = 3s
  await cmd('/station ~3 ~1 ~')
  t = await panel()
  ok(/✓ mortar → pour/.test(t), `the step settled into the pot on its own — "${t.slice(0, 140)}"`)
  ok(/the road is walked/.test(t) && /mana to light/.test(t), 'the pot says the road is walked and names the mana')
  ok(await press('light'), 'LIGHT is pressable')
  await sleep(600)
  t = await panel()
  ok(/⟳ pour/.test(t) && /to the pour/.test(t), `the pot is lit and counting down — "${t.slice(0, 140)}"`)
  const litBlock = await page.evaluate(() => document.body.innerText.includes('the cauldron is lit'))
  ok(litBlock, 'the console line says the cauldron is lit')
  await close()

  // 4. the pour: bottles + XP land, the pot empties
  await sleep(12_500)                                            // brew = 12s
  await cmd('/station ~3 ~1 ~')
  t = await panel()
  ok(/the pour is ready/.test(t), `the pour is ready — "${t.slice(0, 120)}"`)
  ok(await press('pour'), 'POUR is pressable')
  await sleep(700)
  const said = await page.evaluate(() => document.body.innerText)
  ok(/poured — 1× shard tonic/.test(said) && /alchemy xp/.test(said), `the pour says what it gave — "${/poured[^\n]*/.exec(said)?.[0]}"`)
  t = await panel()
  ok(/the pot is empty/.test(t), 'the pot is empty again after the pour')
  await close()
  ok((await bagHas('Shard Tonic')) === 1, 'ONE shard tonic is in the bag — the solo potion exactly')

  // 5. the mortar has nothing now, and says where a brewing starts
  await cmd('/station ~7 ~1 ~')
  t = await panel()
  ok(/nothing waiting on the mortar/.test(t) && /starts at a cauldron/.test(t), 'the idle mortar points at the cauldron')
  await close()

  // 6. tip out gives the ingredients back
  await cmd('/give raw_mana_shard 3'); await cmd('/give goldwood_bark 2')
  await cmd('/station ~3 ~1 ~')
  ok(await pressRowStart('Shard Tonic'), 'a second START')
  await sleep(500)
  ok(await press('tip out'), 'TIP OUT is pressable')
  await sleep(500)
  await close()
  ok((await bagHas('Raw Mana Shard')) === 3 && (await bagHas('Goldwood Bark')) === 2, 'tipping out an unlit pot gave every ingredient back')

  // no panel renders source-comment syntax as text (the 08-26 rule)
  await cmd('/station ~3 ~1 ~')
  ok(!(await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel]')).some(n => /\*\/|\/\*/.test(n.textContent ?? '')))), 'no panel renders source-comment syntax')
  await page.screenshot({ path: `${SP}/brewing-pot.png` })
  await close()
} finally {
  await browser.close()
}
console.log(fails ? `\nbrewing-check: ${fails} FAILED` : '\nbrewing-check: all green')
process.exit(fails ? 1 : 0)
