/**
 * The party in the Ather (2026-09-29): the strip's arrow and distance, and the wiring that makes mates meet in the
 * Wilds but never inside each other's gardens. Run: `npx tsx src/app/shimmer/voxel3d/party-strip.test.ts`
 */
import { readFileSync } from 'node:fs'
import { stripRows } from './party-strip'
import { whereLabel } from '../play3d/lobby-seats'
import type { LobbyState } from '@/lib/party-lobby'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const near = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1e-6
const peer = (name: string, x: number, z: number) => ({ id: 'p_' + name, name, x: 0, y: 0, z: 0, tx: x, ty: 0, tz: z, yaw: 0, tyaw: 0, moving: false, lastSeen: 0 })
const lobby: LobbyState = { code: 'ABCDE', leader: 'u_me', mission: 'survival', launch_gen: 0, members: [
  { id: 'u_me', name: 'Me', zone: 'voxel:wilds', ready: false, trusted: true, look: '' },
  { id: 'u_fern', name: 'Fern', zone: 'voxel:wilds', ready: false, trusted: true, look: '' },
  { id: 'u_moss', name: 'Moss', zone: 'play3d:travelers-station', ready: false, trusted: true, look: '' },
] }
// facing north (aim (0,-1)) → heading atan2(-1, 0) = -π/2
const north = Math.atan2(-1, 0)
const rows = stripRows(lobby, 'u_me', [peer('Fern', 10, 0)], { x: 0, z: 0 }, north)
ok(rows.length === 2 && !rows.some((r) => r.name === 'Me'), 'the strip lists your mates, never you')
const fern = rows.find((r) => r.name === 'Fern')!
ok(fern.dist === 10 && near(fern.arrowRad!, Math.PI / 2), '★ a mate due east while you face north: 10m, arrow turned a quarter clockwise (right)')
const ahead = stripRows(lobby, 'u_me', [peer('Fern', 0, -5)], { x: 0, z: 0 }, north).find((r) => r.name === 'Fern')!
ok(near(ahead.arrowRad!, 0), 'a mate straight ahead: the arrow points up')
const moss = rows.find((r) => r.name === 'Moss')!
ok(moss.arrowRad === null && moss.where === 'at the Station', 'a mate not in your part of the Ather reads where they are')
ok(whereLabel('voxel:plot') === 'in their garden' && whereLabel('voxel:glade') === 'at Moonwell' && whereLabel('voxel:wilds') === 'in the Ather', 'places in the Ather read as places')

const vw = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
ok(vw.includes("enabled: mpPartyReady && !!mpParty && spaceNow !== 'plot', zoneId: 'voxel:' + spaceNow"), '★ presence in the Ather is party-only and never on the plot (a garden is personal)')
ok(vw.includes('mp.y = p.y - PARTY_EYE') && vw.includes('useRef<{ x: number; y: number; z: number } | null>(null)'), 'presence sends feet, and nothing until the walker has reported (never the origin)')
ok(vw.includes('<RemotePlayers peers={mpPeers} />'), 'mates are drawn in the scene')
const mp = readFileSync(new URL('../play3d/multiplayer.ts', import.meta.url), 'utf8')
ok(mp.includes("zone: zoneId.includes(':') ? zoneId : ZONE_PREFIX + zoneId"), 'a voxel zone is not mistaken for a play3d one')

console.log(`party-strip: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
