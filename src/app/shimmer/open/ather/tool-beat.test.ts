// Run: npx tsx src/app/shimmer/open/ather/tool-beat.test.ts
// BETA M194: the tool-panel beat. Fires on a newborn's FIRST tool held (not before), points at that tool's dial, clears when a
// tool panel opens, the clear survives a reload (save round trip), a veteran (legacy keeper, or First Steps done) never sees
// it, and the line says click on desktop / tap on a phone, with no em dash.
import { freshTut, legacyTut, parseTut, gift, type Tut } from './glade-tutorial'
import { toolBeatFamily, toolBeatOwed, clearToolBeat, toolBeatLine, TOOL_BEAT_LINES } from './tool-beat'
import { OPEN_TOOL_FAMILIES } from '../../ui/tool-stage'
import type { EquippedTools } from '../../engine/tools'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const rt = (t: Tut) => parseTut(JSON.parse(JSON.stringify(t)))!
const F = OPEN_TOOL_FAMILIES
const spike = { prospecting: { id: 'spike' } } as unknown as EquippedTools
const both = { forestry: { id: 'pruner' }, prospecting: { id: 'spike' } } as unknown as EquippedTools

// a newborn with empty sockets: owed, but nothing to point at yet
let t = freshTut()
ok(toolBeatOwed(t), 'a newborn owes the beat')
ok(toolBeatFamily(t, {}, F) === null, 'no tool held = no beat')
ok(toolBeatFamily(t, null, F) === null, 'no tools read yet = no beat')
// the first tool lands (Otto's spike): its dial
t = gift(t, 'spike').t
ok(toolBeatFamily(t, spike, F) === 'prospecting', 'first tool held = its dial glows')
ok(toolBeatFamily(t, both, F) === 'forestry', 'two held = the first dial in dial order')
// still owed across a reload until a panel opens
ok(toolBeatFamily(rt(t), spike, F) === 'prospecting', 'reload before opening = still owed')
// the panel opens: cleared, and the clear is saved
const c = clearToolBeat(t)
ok(c.dial === 'done' && !toolBeatOwed(c), 'opening a panel clears it')
ok(toolBeatFamily(c, spike, F) === null, 'cleared = no glow, no line')
ok(clearToolBeat(c) === c, 'clearing twice = same object (no second save)')
ok(rt(c).dial === 'done' && toolBeatFamily(rt(c), both, F) === null, 'reload after clearing = never again')
ok(rt(t).dial === undefined, 'a save without the field parses as owed (no field invented)')
ok(parseTut({ ...JSON.parse(JSON.stringify(t)), dial: 'bogus' })!.dial === undefined, 'a junk value is dropped')
// veterans never see it
ok(toolBeatFamily(legacyTut(), both, F) === null, 'a legacy keeper never sees it')
ok(toolBeatFamily({ ...t, fs: 'done' }, both, F) === null, 'First Steps done = never sees it')
ok(toolBeatFamily(rt({ ...t, fs: 'done' }), both, F) === null, 'First Steps done, reloaded = never sees it')
ok(toolBeatFamily(null, both, F) === null, 'no tutorial save = no beat')
// the line
ok(/^Click /.test(toolBeatLine('mouse')) && /^Tap /.test(toolBeatLine('touch')), 'desktop says click, phone says tap')
ok(toolBeatLine('pad') === toolBeatLine('mouse'), 'pad (no panel button bound yet) reads the desktop line')
ok(Object.values(TOOL_BEAT_LINES).every(l => !l.includes('—') && l.length <= 60), 'no em dash, short')

console.log(`tool-beat: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
