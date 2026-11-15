// Close shots of Rune Hold storefronts on the continent (signs, doors): npx tsx scripts/front-shot.mts <front ids…> (URL=, HOUR=). Writes /tmp/front-<id>.png
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { planTown } from '../src/app/shimmer/open/towns/plan'
const meta = JSON.parse(readFileSync('public/open/continent.json','utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength/2))
const i = meta.places.findIndex(p=>p.id==='rune-hold'); const pl = planTown(R, meta.places[i], i)
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage(); await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune','star')); await p.setViewport({width:1280,height:720})
await p.goto(`${process.env.URL ?? 'http://localhost:3203'}/shimmer/open/continent?hour=${process.env.HOUR ?? 18}`, { waitUntil:'load', timeout:240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 240000 }); await wait(2000); await p.keyboard.press('KeyX')
const sq = meta.network!.junctions.find(j=>j.kind==='square'&&j.place==='rune-hold')!
await p.evaluate((x,z)=>(window as any).__drive.tp(x,z,0,0), sq.x, sq.z); await wait(15000)
for (const id of process.argv.slice(2)) {
  if (id.startsWith('board:')) {
    // a town's name board from the road, as an arriving driver sees it: board:<place id>
    const pid = id.slice(6), j = meta.places.findIndex(q => q.id === pid), tp = planTown(R, meta.places[j], j), bd = tp.boards?.[0]
    if (!bd) { console.log('no board', pid); continue }
    const cx = bd.x + Math.cos(bd.yaw) * 14 - Math.sin(bd.yaw) * 4, cz = bd.z + Math.sin(bd.yaw) * 14 + Math.cos(bd.yaw) * 4
    await p.evaluate((x,z)=>(window as any).__drive.tp(x,z,0,0), bd.x, bd.z); await wait(12000)
    await p.evaluate(q=>(window as any).__drive.shot(q), [cx, R.heightAt(cx, cz) + 2, cz, bd.x, bd.y + 2, bd.z]); await wait(5000)
    await p.screenshot({ path: `/tmp/front-board-${pid}.png` }); console.log('shot board', pid); continue
  }
  if (id === 'field' && pl.station) {
    // the Station's field from above its town end, looking out over the berths
    const s = pl.station, c = Math.cos(s.yaw), sn = Math.sin(s.yaw), at = (gx: number, gz: number) => [s.x + gx * c - gz * sn, s.z + gx * sn + gz * c]
    const side = process.env.SIDE === '1', ship = process.env.SHIP === '1'
    const [cx, cz] = ship ? at(26, 30) : side ? at(-25, -20) : at(-30, 25), [lx, lz] = ship ? at(38, 12) : side ? at(5, 22) : at(45, 25)
    await p.evaluate((x,z)=>(window as any).__drive.tp(x,z,0,0), lx, lz); await wait(12000)
    await p.evaluate(q=>(window as any).__drive.shot(q), [cx, s.level + (ship ? 7 : side ? 8 : 28), cz, lx, s.level + (ship ? 2 : side ? -4 : 0), lz]); await wait(6000)
    await p.screenshot({ path: '/tmp/front-field.png' }); console.log('shot field'); continue
  }
  const bb = pl.buildings.find(q=>q.front===id); if (!bb) { console.log('none', id); continue }
  const fx=Math.cos(bb.yaw), fz=Math.sin(bb.yaw), d = bb.d/2 + 14
  const cx = bb.x + fx*d, cz = bb.z + fz*d, cy = Math.max(R.heightAt(cx,cz), bb.y1) + 2.2
  await p.evaluate(q=>(window as any).__drive.shot(q), [cx, cy, cz, bb.x, bb.y1 + 3, bb.z]); await wait(5000)
  await p.screenshot({ path: `/tmp/front-${id}.png` }); console.log('shot', id) }
await b.close()
