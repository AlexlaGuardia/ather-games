// Run: npx tsx src/app/shimmer/open/ather/last-spot.test.ts
import { validSpot, makeSpot, resumeFrom } from './last-spot'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const s = makeSpot('first-wilds', -310.5, 280.2, 1.2, 1000)
ok(validSpot(s) && s.zone === 'wilds', 'a spot in the Wilds is valid')
ok(!validSpot({ ...s, x: NaN }) && !validSpot({ ...s, tile: '' }) && !validSpot({ ...s, v: 2 }) && !validSpot(null) && !validSpot({ ...s, x: 1e9 }), 'junk is refused (NaN, no tile, other version, nothing, off the map)')
const known = (n: string) => n === 'first-wilds'
ok(resumeFrom('', s, known) === s, 'a plain reload resumes the saved spot')
ok(resumeFrom('?hour=13', s, known) === s, 'other params do not stop it')
ok(resumeFrom('?waymark=greg', s, known) === null, 'a waymark in the address wins (the Hallway)')
ok(resumeFrom('?home=1', s, known) === null, '?home=1 goes home')
ok(resumeFrom('', null, known) === null, 'no saved spot: home as before')
ok(resumeFrom('', { ...s, tile: 'gone-tile' }, known) === null, 'a tile that no longer exists: home, not a hole')
ok(JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s), 'round-trips through storage as JSON')
console.log(`last-spot: ${pass} pass, ${fails.length} fail`); fails.forEach(f => console.log('  FAIL', f)); if (fails.length) process.exit(1)
