// ── BUILD MODE IS THE HOME PLOT'S, AND A PIECE CAN ALWAYS BE TAKEN BACK — a call-site guard ─────
// Run: npx tsx src/app/shimmer/voxel3d/build-lock.test.ts
//
// Two rulings from Alex, 2026-09-12, after a Tab press in the Wilds put him in a mode he did not
// ask for and left him with pieces he could not remove:
//   1. build mode is locked to the Home Plot;
//   2. a placed piece is removable OUTSIDE build mode — it used to be a `STRUCTURE` cell with no
//      registry row, which the mine path could neither name nor break.
// Neither is a pure function; both are host wiring in `VoxelWorld.tsx`, so this reads the source
// under the channel-wiring rules: every anchor matches EXACTLY ONCE, a miss is BLIND (exit 1), and
// negative asserts read `codeOnly` so a comment quoting the old shape cannot fail them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly, noComments, blockAt } from '../testing/guard'

let ok = 0, bad = 0, blind = 0
const chk = (name: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ok   ${name}`) }
  else { bad++; console.log(`  FAIL: ${name} ${extra}`) }
}
const HOST = join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx')
const src = readFileSync(HOST, 'utf8')
// ⚠ `code` blanks string CONTENTS too — an anchor that carries `'plot'` or `'ui.build'` must read
// `nc` (comments gone, strings intact) or it goes blind on correct code. Bit this file on its
// first run; the house note on `codeOnly` says so and was right.
const code = codeOnly(src)
const nc = noComments(src)
const chain = noComments(readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/ui-chain.ts'), 'utf8'))

const count = (hay: string, needle: string): number => hay.split(needle).length - 1
const once = (label: string, needle: string, hay = code): boolean => {
  const n = count(hay, needle)
  if (n === 1) return true
  blind++
  console.log(`  BLIND: ${label} — matched ${n} times, expected exactly 1 (the code moved, or was duplicated)`)
  return false
}

console.log('\n── 1. the plot lock, all three layers ──')
// (a) the key: Tab OFF the plot says why and does not flip the mode.
const tb = blockAt(code, 'toggleBuild: () =>', '\n')
chk('★ toggleBuild refuses off the plot, out loud, BEFORE the flip',
  tb.at > 0 && /if \(!onPlot\) \{ say\(.*\); return \}/.test(tb.code) && tb.code.indexOf('!onPlot') < tb.code.indexOf('setBuild'),
  tb.code.trim())
// ⚠ The refusal lives in the THUNK, not in the chain's `when`. An unrun `ui.build` step is a Tab
// the browser keeps (SUPPRESS_DEFAULT only fires for steps that ran), and the next keystroke
// leaves the canvas. Gating it in the chain would be the tidier-looking bug.
chk('★ the chain step stays `when: true` — a false `when` hands Tab to the browser',
  once('ui.build step', "act('ui.build', true, () => a.toggleBuild(), false)", chain))
chk('...and the chain state knows nothing of the plot', !/onPlot/.test(chain))
// (b) the crossing: walking out of the fold with the palette up drops the mode.
chk('★ leaving the plot drops build mode (effect on [build, onPlot])',
  once('drop effect', 'useEffect(() => { if (build && !onPlot) setBuild(false) }, [build, onPlot])'))
// (c) the frame: the ghost/place/deconstruct branch reads the SPACE REF, not just `build`, so the
// render-later gap between a crossing and the effect cannot show a ghost over Moonwell.
chk('★ the frame branch is gated on the space ref as well as `build`',
  once('build branch', "if (build && space.current === 'plot') {", nc))
chk('...and there is no bare `if (build) {` branch left for the ghost to escape through',
  count(code, 'if (build) {') === 0)

console.log('\n── 2. the parent learns the space from the frame, not from `enterSpace` ──')
// The restore path writes `space.current = savedSpace` directly and never calls `enterSpace`, so
// a callback inside `enterSpace` would miss a keeper who RELOADS on the plot: `onPlot` false,
// Tab refused on their own island. The edge detector on the ref sees both roads.
chk('★ World edge-reports the space ref every frame it changes',
  once('space edge', 'if (space.current !== lastSpace.current) { lastSpace.current = space.current; onSpace(space.current) }'))
chk('the parent derives onPlot from that report', once('onSpace prop', "onSpace={s => setOnPlot(s === 'plot')}", nc))
chk('the edge starts unset, so the first frame reports', once('lastSpace init', 'const lastSpace = useRef<Space | null>(null)'))

console.log('\n── 3. one deconstruct body, reachable from both modes ──')
chk('★ deconstruct is ONE closure', once('deconstruct decl', 'const deconstruct = (found: Placement & { gen?: string }) =>'))
chk('★ ...called from build mode AND from the mine side (exactly two call sites)',
  count(code, 'deconstruct(found)') === 2, `saw ${count(code, 'deconstruct(found)')}`)
const piece = blockAt(code, 'let pieceLook:', '// ── mine ──')
chk('the piece branch exists and sits ABOVE the mine path (a STRUCTURE cell has no blockDef to fall into)',
  piece.at > 0 && piece.at < code.indexOf('const hitDef = blockDef(hit.material)'))
chk('it asks for a STRUCTURE cell, both heights',
  /hit\.material === STRUCTURE \|\| hit\.material === STRUCTURE_HALF/.test(piece.code))
chk('★ a generated piece is NOT yours outside build mode — the swing is refused, not tombstoned',
  /const yours = !!found && !found\.gen/.test(piece.code)
  && /if \(found && yours && mouse\.current\.left && !weaponDrawn\) \{ deconstruct\(found\)/.test(piece.code))
chk('the refusal is said on the HUD line, not silent', /not yours to take/.test(src))
chk('★ the HUD reads the piece name — the cell used to be nameless',
  once('pieceLook in onLook', 'if (pieceLook) onLook({ ...pieceLook, progress: 0, channel: false })\n    else onLook(hit && def'))
chk('the mine-side swing still respects the draw lock', /deconstruct\(found\); mouse\.current\.left = false \}\n\s*pieceLook/.test(code))

console.log(`\nbuild-lock oracle: ${ok} passed, ${bad} failed, ${blind} blind`)
process.exit(bad || blind ? 1 : 0)
