// The keeper's look + body (keeper-look.ts, keeper-figure.ts, BETA M29). Run: npx tsx src/app/shimmer/open/shared/keeper-look.test.ts
import { OPT, ROWS, DEFAULT_LOOK, FRAME_STATS, frameStats, parseLook, setLook, packLook, unpackLook, randomLook, LOOK_KEY, type Look, type LookKey } from './keeper-look'
import { buildKeeper } from './keeper-figure'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// the mock's options, as signed off (Alex 11-19: no body option, no legs colour, no age)
ok(OPT.frame.length === 3 && OPT.hairStyle.length === 8 && OPT.eyes.length === 8 && OPT.brows.length === 3 && OPT.mouth.length === 6, 'options: not the signed-off mock (3 frames, 8 hair, 8 eyes, 3 brows, 6 mouths)')
ok(!('legColor' in OPT) && !('body' in OPT) && !('age' in OPT), 'options: a retired choice is back (legs colour / body / age)')
ok(ROWS.length === Object.keys(OPT).length && ROWS.every(r => r.key in OPT), 'rows: a row without an option, or an option without a row')
ok(LOOK_KEY === 'open.look.v1', 'key: the save key moved (it is registered per keeper)')

// parse: clamps field by field, never throws
ok(parseLook(null) === null && parseLook({ v: 2 }) === null && parseLook('x') === null, 'parse: junk read as a look')
const bad = parseLook({ v: 1, frame: 9, hair: -1, eyes: 3, mouth: 2.5 })!
ok(bad.frame === DEFAULT_LOOK.frame && bad.hair === DEFAULT_LOOK.hair && bad.eyes === 3 && bad.mouth === DEFAULT_LOOK.mouth, 'parse: an out-of-range field was kept, or a good one dropped')
ok(setLook(DEFAULT_LOOK, 'frame', 7) === DEFAULT_LOOK && setLook(DEFAULT_LOOK, 'frame', 2).frame === 2, 'setLook: accepted an out-of-range index')

// pack/unpack (presence, slice 3): round trip for every look the rows can make
let rt = true
for (const r of ROWS) for (let i = 0; i < OPT[r.key].length; i++) { const l = setLook(DEFAULT_LOOK, r.key, i); if (JSON.stringify(unpackLook(packLook(l))) !== JSON.stringify(l)) rt = false }
ok(rt && packLook(DEFAULT_LOOK).length === ROWS.length, 'pack: a look did not survive the round trip')
ok(unpackLook('zz') === null && unpackLook(42) === null, 'unpack: junk read as a look')

// FRAME: the one PvP choice, asserted from BOTH sides with absolute numbers (a bound against its own constant proves nothing)
const S = frameStats({ ...DEFAULT_LOOK, frame: 0 }), M = frameStats(DEFAULT_LOOK), L = frameStats({ ...DEFAULT_LOOK, frame: 2 })
ok(S.speed === 1.05 && S.hit < 1 && S.hit >= 0.85 && S.damage === 1, `frame: Small is not 'smaller hitbox, +5% speed' (${JSON.stringify(S)})`)
ok(M.speed === 1 && M.hit === 1 && M.damage === 1, 'frame: Medium is not the baseline')
ok(L.speed === 1 && L.hit > 1 && L.hit <= 1.2 && Math.abs(L.damage - 0.9) < 1e-9, `frame: Large is not 'bigger hitbox, +10% defence' (${JSON.stringify(L)})`)
ok(FRAME_STATS.length === OPT.frame.length, 'frame: a frame without stats')

// Random: every look row may change, FRAME never (it is a play choice, never rolled for you)
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const rolls = Array.from({ length: 40 }, () => randomLook({ ...DEFAULT_LOOK, frame: 2 }, rnd))
ok(rolls.every(l => l.frame === 2), 'random: Random changed the frame')
ok((Object.keys(OPT) as LookKey[]).filter(k => k !== 'frame').every(k => new Set(rolls.map(l => l[k])).size > 1), 'random: a look row never changes under Random')

// the body: every option builds, floating limbs are named parts, the frame changes the size
let built = true
for (const r of ROWS) for (let i = 0; i < OPT[r.key].length; i++) { try { buildKeeper(setLook(DEFAULT_LOOK, r.key, i)) } catch { built = false } }
ok(built, 'body: an option throws when built')
const b = buildKeeper(DEFAULT_LOOK)
ok(['hand-l', 'hand-r', 'foot-l', 'foot-r', 'head', 'body'].every(n => !!b.group.getObjectByName(n)), 'body: a floating limb is not a named part (third person cannot move it)')
const handY = b.group.getObjectByName('hand-l')!.position.y, footY = b.group.getObjectByName('foot-l')!.position.y
ok(footY < 0.1 && handY > footY + 0.3 && b.headY > handY + 0.4, 'body: hands are not floating between the feet and the head')
const hS = buildKeeper({ ...DEFAULT_LOOK, frame: 0 }).height, hL = buildKeeper({ ...DEFAULT_LOOK, frame: 2 }).height
ok(hS < b.height && b.height < hL && b.height > 1.2 && b.height < 2.2, `body: heights not Small < Medium < Large in a keeper's range (${hS.toFixed(2)} ${b.height.toFixed(2)} ${hL.toFixed(2)})`)
const look2: Look = { ...DEFAULT_LOOK, hairStyle: 5 }
const locks = (l: Look) => { let n = 0; buildKeeper(l).group.traverse(o => { if ((o as { matrixAutoUpdate?: boolean }).matrixAutoUpdate === false) n++ }); return n }
ok(locks(look2) > locks({ ...DEFAULT_LOOK, hairStyle: 0 }), 'body: Long hair has no more locks than Short (the style did nothing)')

if (fails.length) { console.error(`keeper-look: ${pass} pass, ${fails.length} FAIL\n  ` + fails.join('\n  ')); process.exit(1) }
console.log(`keeper-look: ${pass} pass, 0 fail`)
