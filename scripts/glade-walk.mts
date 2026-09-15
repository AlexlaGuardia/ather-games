// The Glade tutorial, walked in the real page — Magii's wiring sheet (athernyx 17e2223) end to end.
//
// ★ THE PURE ORACLE CANNOT REACH THIS. `tutorial.test.ts` proves the machine; it cannot prove the
// five bodies stand where E can reach them, that the box shows the locked lines, that closing it
// LENDS the blade into the real tool slot, that the shard lands in the real bag, or that the fold
// hands out the bag. "The panel worked and nothing was written" is this world's most-repeated
// failure and it has its own harness for that reason (greg-check.mts is the model).
//
// Run: set -a; . ./.env; set +a; npx tsx scripts/glade-walk.mts        (owner-gated: tp/look/give)
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d?hour=12'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

/** Where to stand and which way to look to have each folk under the crosshair. yaw: 0 faces −Z, + turns right. */
const AT: Record<string, { x: number; z: number; yaw: number }> = {
  hazel:  { x: -159, z: -628, yaw: 270 },
  sax:    { x: -125, z: -605, yaw: 270 },
  yarrow: { x: -138, z: -617, yaw: 180 },
  fennel: { x: -155, z: -616, yaw: 270 },
  mallow: { x: -159, z: -600, yaw: 270 },
}

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.evaluateOnNewDocument(() => { localStorage.setItem('ather:epoch', '2') })
  const KEY = process.env.OWNER_KEY
  if (!KEY) { console.error('OWNER_KEY not set — source /root/ather-games/.env first'); process.exit(2) }
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  await sleep(16000)

  const cmd = async (line: string, close = true) => {
    await page.keyboard.press('KeyT'); await sleep(350)
    await page.keyboard.type(line); await page.keyboard.press('Enter'); await sleep(900)
    if (close) { await page.keyboard.press('Escape'); await sleep(500) }
  }
  const panel = () => page.evaluate(() => {
    const p = document.querySelector('[data-panel]')
    return { id: p?.getAttribute('data-panel') ?? null, text: p?.textContent ?? '' }
  })
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('voxel3d:tutorial:1337') ?? 'null'))
  const objective = () => page.evaluate(() => document.body.innerText.match(/OBJECTIVE\s*\n?\s*([^\n]+)/i)?.[1]?.trim() ?? '')
  const corner = () => page.evaluate(() => document.body.innerText.match(/FORE[^\n]*/)?.[0] ?? '')
  /** Stand in front of a folk and press E. Returns the open box. */
  const talkTo = async (id: string) => {
    const a = AT[id]
    await cmd(`/tp ${a.x} ${a.z}`); await sleep(1200)
    await cmd(`/look ${a.yaw}`); await sleep(1200)
    await page.keyboard.press('KeyE'); await sleep(700)
    let p = await panel()
    // A software-GL tab streams columns slowly; the aim test needs the building's blocks to have
    // landed (occlusion reads them). One patient retry, never a loop.
    if (!p.id) { await sleep(2500); await page.keyboard.press('KeyE'); await sleep(700); p = await panel() }
    return p
  }
  const closeBox = async () => { await page.keyboard.press('Escape'); await sleep(600) }

  await cmd('/help')   // warm-up (see greg-check.mts)

  // ── 0. a door before the offer only barks ───────────────────────────────────────────────────
  let p = await talkTo('hazel')
  ok(p.id === 'folk-hazel', `E on Hazel opens her box (${p.id})`)
  ok(/Measure it twice/.test(p.text) && !/Take mine/.test(p.text), 'before Greg has spoken she barks, does not lend')
  await closeBox()
  ok(((await state())?.stage ?? 'greet') === 'greet', 'a bark changes nothing')

  // ── 1. Greg: warning + offer, nothing handed ────────────────────────────────────────────────
  await cmd('/greg', false); await sleep(900)
  p = await panel()
  ok(p.id === 'greg' && /I will not dress it up/.test(p.text) && /Five doors, five folk/.test(p.text), 'Greg says the warning and the offer')
  ok(/Blue leans against his leg/.test(p.text), 'the stage direction is shown')
  await closeBox()
  let s = await state()
  ok(s?.stage === 'doors' && s.met.length === 0, `greet → doors (${JSON.stringify(s)})`)
  ok(/Knock on five doors/.test(await objective()), `objective: ${await objective()}`)
  ok(/FORE —/.test(await corner()), `no blade before Hazel (${await corner()})`)

  // ── 2. Hazel lends ─────────────────────────────────────────────────────────────────────────
  p = await talkTo('hazel')
  ok(/Take mine/.test(p.text) && /What you get is tables/.test(p.text), 'Hazel: greet, want, lend, give')
  if (process.env.GLADE_SHOT) await page.screenshot({ path: process.env.GLADE_SHOT.replace(/\.png$/, '-hazel.png') })
  await closeBox()
  s = await state()
  ok(s?.hazel === 'owed' && s.met.includes('hazel'), `Hazel owed, met (${JSON.stringify(s)})`)
  ok(/Hazel's Blade/i.test(await corner()), `her blade is in the forestry slot (${await corner()})`)
  ok(/Cut a log/.test(await objective()), `objective: ${await objective()}`)
  p = await talkTo('hazel')
  ok(/my blade back/.test(p.text), 'owed bark while the stack is short')
  await closeBox()

  // ── 3. the stack, square ───────────────────────────────────────────────────────────────────
  await cmd('/give goldwood_log 1')
  ok(/Mill planks/.test(await objective()), `a log in hand: ${await objective()}`)
  await cmd('/give goldwood_plank 4')
  ok(/Bring Hazel/.test(await objective()), `four planks: ${await objective()}`)
  p = await talkTo('hazel')
  ok(/Square. Good/.test(p.text) && /My blade back now/.test(p.text), 'turn-in lines')
  await closeBox()
  s = await state()
  ok(s?.hazel === 'done', 'errand done')
  ok(/FORE —/.test(await corner()), `the blade went back (${await corner()})`)

  // ── 4. four visits → the ask ───────────────────────────────────────────────────────────────
  for (const id of ['sax', 'yarrow', 'fennel', 'mallow']) {
    p = await talkTo(id)
    ok(p.id === `folk-${id}`, `E reaches ${id} (${p.id})`)
    await closeBox()
  }
  s = await state()
  ok(s?.stage === 'ask' && s.met.length === 5, `five doors → ask (${JSON.stringify(s)})`)
  await cmd('/greg', false); await sleep(900)
  p = await panel()
  ok(/Take this shard/.test(p.text), "Greg's ask")
  await closeBox()
  s = await state()
  ok(s?.stage === 'lantern', 'ask → lantern')
  await page.keyboard.press('KeyI'); await sleep(600)
  const shard = await page.evaluate(() => [...document.querySelectorAll('[title]')].some(e => /shard/i.test(e.getAttribute('title') ?? '')))
  ok(shard, 'the raw shard is in the bag (a slot is titled with it)')
  await page.keyboard.press('Escape'); await sleep(400)
  await cmd('/greg', false); await sleep(900)
  p = await panel()
  ok(/will not light itself/.test(p.text), 'Greg barks light while the lantern is owed')
  await closeBox()

  // ── 4b. the lantern lands → Greg's lit line, the choice armed ──────────────────────────────
  // Seeded at `light` with a lantern in hand (crafting is the pure recipe table's, proven
  // elsewhere); the placement is a REAL right-click on the glade path under a pointer lock.
  await page.evaluate(() => localStorage.setItem('voxel3d:tutorial:1337', JSON.stringify({ stage: 'light', met: ['hazel', 'sax', 'yarrow', 'fennel', 'mallow'], hazel: 'done' })))
  await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 }); await sleep(14000)
  await cmd('/help')
  await cmd('/give mana_lantern 1')
  // The keeper save keeps their position across the reload (Mallow's counter, last visited), so
  // walk back to the path by Greg first — a right-click on a chest opens the chest.
  await cmd('/tp -148 -640'); await sleep(1500)
  // Slot titles (`<label> ×<count>` / `empty`) exist only inside the bag panel, whose LAST eight
  // titled slots are the hotbar row.
  await page.keyboard.press('KeyI'); await sleep(600)
  const titles = await page.evaluate(() => [...document.querySelectorAll('[title]')].map(e => e.getAttribute('title') ?? '').filter(t => /×\d+$|^empty$/.test(t)).slice(-8))
  const slot = titles.findIndex(t => /lantern/i.test(t))
  ok(slot >= 0, `the lantern sits in hotbar slot ${slot + 1} (${titles.join(' | ')})`)
  await page.keyboard.press('Escape'); await sleep(400)
  await page.keyboard.press(`Digit${slot + 1}`); await sleep(300)
  ok(/Set the lantern/.test(await objective()), `objective: ${await objective()}`)
  await cmd('/look 0 50'); await sleep(800)                   // the ground two blocks out, under the reticle
  await page.mouse.click(640, 380, { button: 'right' }); await sleep(900)
  if (process.env.GLADE_SHOT) await page.screenshot({ path: process.env.GLADE_SHOT.replace(/\.png$/, '-place.png') })
  s = await state()
  ok(s?.stage === 'choice', `placing the lantern arms the choice (${JSON.stringify(s)})`)
  ok(/There now. Look at that/.test(await page.evaluate(() => document.body.innerText)), "Greg's lit line is said")
  await page.keyboard.press('Escape'); await sleep(400)

  // ── 5. the choice and the fold ─────────────────────────────────────────────────────────────
  await page.evaluate(() => localStorage.setItem('voxel3d:tutorial:1337', JSON.stringify({ stage: 'choice', met: ['hazel', 'sax', 'yarrow', 'fennel', 'mallow'], hazel: 'done' })))
  await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 }); await sleep(14000)
  await cmd('/help')
  await cmd('/greg', false); await sleep(900)
  p = await panel()
  ok(/Are you staying/.test(p.text), 'the choice')
  // GLADE_SHOT=/path.png — a picture of the choice box, for the look call
  if (process.env.GLADE_SHOT) await page.screenshot({ path: process.env.GLADE_SHOT })
  const buttons = await page.$$('[data-panel="greg"] button')
  const labels = await Promise.all(buttons.map(b => b.evaluate(e => e.textContent ?? '')))
  ok(labels.some(l => /not yet/i.test(l)) && labels.some(l => /staying/i.test(l)), `two answers (${labels.join(' | ')})`)
  await buttons[labels.findIndex(l => /not yet/i.test(l))].click(); await sleep(400)
  p = await panel()
  ok(/take your time/.test(p.text), "'not yet' answers")
  await closeBox()
  s = await state()
  ok(s?.stage === 'choice', "'not yet' leaves the question armed")
  await cmd('/greg', false); await sleep(900)
  const b2 = await page.$$('[data-panel="greg"] button')
  const l2 = await Promise.all(b2.map(b => b.evaluate(e => e.textContent ?? '')))
  await b2[l2.findIndex(l => /staying/i.test(l))].click(); await sleep(400)
  p = await panel()
  ok(/Nobody folds their own/.test(p.text), 'the fold lines')
  await closeBox()
  s = await state()
  ok(s?.stage === 'done', 'folded')
  ok(/Worn Blade/i.test(await corner()), `the bag arrives with the fold (${await corner()})`)
  ok((await objective()) === '', 'no objective once the gate is open')
  await cmd('/greg', false); await sleep(900)
  p = await panel()
  ok(/entries/.test(p.text), 'post-fold Greg reads the book')
  await closeBox()
} finally {
  await browser.close()
}
console.log(fails ? `\n${fails} FAILED` : '\nglade-walk: all green')
process.exit(fails ? 1 : 0)
