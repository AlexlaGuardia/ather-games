// Carved Hearth rollout — photograph every PanelFrame panel in a FRESH harness world (never a real
// save: a headless profile with its own storage). Run after a deploy:
//   set -a; . ./.env; set +a; npx tsx scripts/hearth-shots.mts        (SP=<dir> for the shots)
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const SP = process.env.SP ?? '/tmp'
const W = Number(process.env.W ?? 1280), HT = Number(process.env.HT ?? 900)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('OWNER_KEY not set — source .env first'); process.exit(2) }

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${W},${HT}`],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: HT, isMobile: W < 600, hasTouch: W < 600 })
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'freeze')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['freeze']))
  })
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  await sleep(14_000)
  const cmd = async (line: string, wait = 900) => {
    await page.keyboard.press('Escape'); await sleep(300)
    await page.keyboard.press('KeyT'); await sleep(350)
    await page.keyboard.type(line); await page.keyboard.press('Enter'); await sleep(wait)
  }
  const shot = async (name: string) => { const p = `${SP}/hearth-${name}.png`; await page.screenshot({ path: p as `${string}.png` }); console.log('  shot', p) }
  const putUntil = async (line: string) => {
    for (let i = 0; i < 12; i++) {
      await cmd(line, 1500)
      const tail = await page.evaluate(() => document.body.innerText.slice(-600))
      if (/put [A-Z_]+ at/.test(tail)) return true
    }
    return false
  }

  await cmd('/space plot', 8000)
  for (const g of ['shimmeroak_log 12', 'shimmeroak_plank 30', 'cobblestone 40', 'block_sand 20', 'thatch 9', 'raw_mana_shard 3', 'sunfruit 6', 'moonberry 8'])
    await cmd(`/give ${g}`, 500)

  await page.keyboard.press('Escape'); await sleep(300)
  await page.keyboard.press('KeyC'); await sleep(1200)
  await shot('crafter')
  // pick the first tile so the card shows
  await page.evaluate(() => { const b = document.querySelector('.hearth-root .grid button') as HTMLElement | null; b?.click() })
  await sleep(500); await shot('crafter-picked')

  for (const [id, dx] of [['sawmill', 3], ['cauldron', 6], ['grinder', 9]] as const) {
    const landed = await putUntil(`/put ${id} ~${dx} ~1 ~`)
    console.log(`  ${id} landed: ${landed}`)
    await cmd(`/station ~${dx} ~1 ~`, 1500)
    await shot(id)
  }
} finally { await browser.close() }
