// Can the keeper MOVE? Wilds, Home Plot, and — the one that shipped broken — a Home Plot save the
// ground has since grown over. (2026-08-18, Alex: "my player is stuck in the home plot unable to move")
//
// ★ THE THIRD CASE IS THE REASON THIS FILE EXISTS, and it is deliberately a PAGE test rather than a
// unit one. `voxel/plot.test.ts` proves `plotStandY` lifts a buried keeper; it cannot prove the
// restore path still CALLS it. That is exactly the gap this repo has been bitten by before — a panel
// that hardcoded its own status while the system underneath worked perfectly. So the assert here is
// the keeper's own sentence: load the buried save, hold W, and see whether they walk.
//
// Same headless setup as void-check.mts — SwiftShader, owner cookie, wall-clock settle. Position is
// sampled as a TIMELINE while W is HELD, because a single before/after pair cannot tell "did not
// move" from "moved and came back", and because this box renders at a few fps.
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SETTLE = Number(process.env.SETTLE ?? 14)

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'freeze')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['freeze']))
  })
  const KEY = process.env.OWNER_KEY
  if (!KEY) { console.error('OWNER_KEY not set — source /root/ather-games/.env first'); process.exit(2) }
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  const owned = await page.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))
  ok(owned, 'harness is keeper of the realm (/space will actually work)')
  await sleep(SETTLE * 1000)

  const readPos = () => page.evaluate(() => {
    for (const d of Array.from(document.querySelectorAll('div'))) {
      const t = (d.textContent ?? '').trim()
      if (/^x -?\d+\s+y -?\d+\s+z -?\d+$/.test(t)) return t
    }
    return null
  })
  const readStats = () => page.evaluate(() => document.querySelector('[data-stats]')?.textContent ?? '')
  const xz = (s: string | null) => {
    const m = s?.match(/x (-?\d+)\s+y (-?\d+)\s+z (-?\d+)/)
    return m ? { x: +m[1], y: +m[2], z: +m[3] } : { x: 0, y: 0, z: 0 }
  }

  const cmd = async (line: string, settleS = SETTLE) => {
    await page.keyboard.press('KeyT'); await sleep(300)
    await page.keyboard.type(line); await page.keyboard.press('Enter')
    let reply = ''
    for (let t = 0; t < 2400; t += 200) { await sleep(200); reply += '\n' + await page.evaluate(() => document.body.innerText) }
    await page.keyboard.press('Escape')
    await sleep(settleS * 1000)
    return reply
  }

  // ── walk test: hold W, sample the position as a timeline ────────────────────────────────────
  const walk = async (label: string) => {
    const before = await readPos()
    await page.keyboard.down('KeyW')
    const track: string[] = []
    for (let i = 1; i <= 6; i++) { await sleep(1000); track.push(`   t+${i}s  ${await readPos()}`) }
    await page.keyboard.up('KeyW')
    await sleep(1500)
    const after = await readPos()
    const a = xz(before), b = xz(after)
    const moved = Math.hypot(b.x - a.x, b.z - a.z)
    console.log(`\n${label}\n  before ${before}\n${track.join('\n')}\n  after  ${after}`)
    console.log(`  stats  ${(await readStats()).slice(0, 70)}`)
    return moved
  }

  console.log(`\nspawn · ${await readPos()}  ·  ${(await readStats()).slice(0, 60)}`)
  const mWilds = await walk('── WILDS: hold W for 6s ──')
  ok(mWilds > 2, `the keeper walks in the Wilds (moved ${mWilds.toFixed(1)} blocks)`)

  console.log('\n/space plot  → cross into the Home Plot')
  const r = await cmd('/space plot')
  console.log(`  reply · ${r.replace(/\s+/g, ' ').slice(-200)}`)
  console.log(`  pos   · ${await readPos()}  ·  ${(await readStats()).slice(0, 60)}`)
  const mPlot = await walk('── HOME PLOT: hold W for 6s ──')
  ok(mPlot > 2, `the keeper walks in the Home Plot (moved ${mPlot.toFixed(1)} blocks)`)

  // ── ★★ THE BURIED SAVE ────────────────────────────────────────────────────────────────────────
  // Alex's real PlayerSave, read out of his browser on 2026-08-18. `plotHeight` answers 97 at this
  // column, so feet stored at 97 are one block INSIDE the topsoil: collision refuses every
  // direction and the autosave writes the position back, so reloading cannot escape it. Verbatim on
  // purpose — a hand-rounded copy would stop being the save that actually shipped broken.
  await page.evaluate(() => new Promise<void>(res => {
    const rec = { v: 1, x: -19.019777003186977, y: 97, z: 3.7860620954651756,
                  rx: -0.04580690762875758, ry: -1.8220469697086112, space: 'plot' }
    const open = indexedDB.open('shimmer-voxel', 1)
    open.onsuccess = () => {
      const tx = open.result.transaction('edits', 'readwrite')
      tx.objectStore('edits').put(rec, '1337:player')
      tx.oncomplete = () => res()
    }
  }))
  await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 })
  await sleep(SETTLE * 1000)
  console.log(`\n/reload with the buried save → ${await readPos()}  ·  ${(await readStats()).slice(0, 40)}`)
  const mBuried = await walk('── BURIED SAVE (feet at y97, grass at y97): hold W for 6s ──')
  ok(mBuried > 2, `a keeper the ground grew over is lifted onto it and walks (moved ${mBuried.toFixed(1)} blocks)`)

  console.log(fails ? `\n${fails} FAILED` : '\nall clear')
} finally { await browser.close() }
process.exit(fails ? 1 : 0)
