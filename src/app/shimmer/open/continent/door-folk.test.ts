// M26 placement. Run: npx tsx src/app/shimmer/open/continent/door-folk.test.ts
import { standOf, headOf, faceOf, isTalkDoor, STAND_OUT, STAND_SIDE, KEEPER_OUT } from './door-folk'
import { FOLK_HEIGHT, FOLK_EYE_Y } from '../shared/folk-model'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const b = { x: 10, z: 10 } as never
const t = standOf({ key: 'smith:enchant', b, at: { x: 10, y: 3, z: 14 }, name: 'Enchant runesmith' })
ok(Math.abs(t.z - (14 + STAND_OUT)) < 1e-9 && Math.abs(Math.abs(t.x - 10) - STAND_SIDE) < 1e-9 && t.y === 3, `beside the door, a little out from the wall (${t.x},${t.z})`)
ok(Math.hypot(t.x - 10, t.z - (14 + KEEPER_OUT)) > 1.2, 'clear of where the keeper stands to press E')
const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw), kx = 10 - t.x, kz = 14 + KEEPER_OUT - t.z, kl = Math.hypot(kx, kz)
ok(Math.abs(fx * kx / kl + fz * kz / kl - 1) < 1e-9, 'turned to face the keeper at the door')
const e = standOf({ key: 'front:trade-co', b, at: { x: 14, y: 0, z: 10 }, name: 'x' })
ok(e.x > 14 && e.name === 'Clerk' && e.look === 'co-clerk', 'an east door: out along +x; the Co. talker is the Clerk')
ok(standOf({ key: 'front:enchant-temple', b, at: { x: 0, y: 0, z: 0 }, name: 'x' }).name === 'Idony', 'the temple talker is Idony')
ok(t.look === 'runesmith-enchant', 'a runesmith keeps its seat in its look id')
ok(Math.abs(headOf(t).y - (3 + FOLK_HEIGHT + 0.45)) < 1e-9, 'the bubble sits over the head')
ok(Math.abs(faceOf(t).y - (3 + FOLK_EYE_Y)) < 1e-9 && faceOf(t).y < headOf(t).y, 'the camera looks at the face, under the bubble')
ok(isTalkDoor('smith:veradyn') && isTalkDoor('front:trade-co') && !isTalkDoor('front:smithy') && !isTalkDoor('citadel:lot3'), 'only the talk doors')
console.log(`door-folk: ${pass} pass, ${fails.length} fail`); fails.forEach(f => console.log('  FAIL', f)); if (fails.length) process.exit(1)
