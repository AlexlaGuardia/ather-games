/** The fork — trail and chip from flags. Run: `npx tsx src/app/shimmer/play3d/fork.test.ts` */
import { forkTarget, forkObjective, forkFlags, MET_GREG_FLAG, STATION_FLAG } from './fork'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const greg = { x: 24, z: 50 }, door = { x: 23, z: 49 }
const none = forkFlags({})

ok(forkTarget('rune-hold', none, greg, door)?.kind === 'greg', 'fresh on the square → the trail points at Greg')
ok(forkTarget('rune-hold', none, greg, door)?.x === 24, 'at his spot')
ok(forkTarget('rune-hold', forkFlags({ [MET_GREG_FLAG]: true }), greg, door)?.kind === 'door', 'Greg has spoken → the door')
ok(forkTarget('rune-hold', forkFlags({ [STATION_FLAG]: true }), greg, door) === null, '★ the station was chosen by walking → no trail back to the corner (a fork, not a menu)')
ok(forkTarget('rune-hold', forkFlags({ [STATION_FLAG]: true, [MET_GREG_FLAG]: true }), greg, door) === null, 'even after meeting him')
ok(forkTarget('travelers-station', none, greg, door) === null, 'off the square → nothing')
ok(forkTarget('moonwell-glade', none, greg, door) === null, 'never in the Ather')
ok((forkTarget('rune-hold', none, greg, door)?.hideBelow ?? 0) > (forkTarget('rune-hold', forkFlags({ [MET_GREG_FLAG]: true }), greg, door)?.hideBelow ?? 0), 'Greg hides at talk range, the door at a step')

ok(forkObjective('rune-hold', none) === 'the old man at the corner door', 'chip: find Greg')
ok(forkObjective('rune-hold', forkFlags({ [MET_GREG_FLAG]: true })) === 'after Greg — through the corner door', 'chip: follow him')
ok(forkObjective('travelers-station', forkFlags({ [STATION_FLAG]: true }))?.includes('Travelers Station') === true, 'chip on the station branch names the station')
ok(forkObjective('crucible', forkFlags({ [STATION_FLAG]: true })) === null, 'no chip inside the Crucible')
ok(forkObjective('travelers-station', none) === null, 'no chip in the station before the branch is taken (the zone effect sets it on entry)')

console.log(`fork: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
