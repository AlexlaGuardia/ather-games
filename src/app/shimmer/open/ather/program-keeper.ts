// M44: keep every compiled shader program alive for the life of the renderer. r3f disposes a zone's materials on
// unmount and three releases a program when its last material goes (WebGLPrograms.releaseProgram: --usedTimes === 0
// destroys it), so every return to a zone recompiled its programs after the fade lifted. One extra reference per
// program means a zone swap can never take the count to 0. Geometry/texture disposal is untouched (M34 heap): only
// the program cache (bounded by distinct shader keys, a few dozen) is retained.
type Prog = { usedTimes: number }
const pinned = new WeakSet<object>()
export function pinPrograms(programs: readonly Prog[] | undefined): number {
  let n = 0
  if (!programs) return 0
  for (const p of programs) if (!pinned.has(p)) { pinned.add(p); p.usedTimes++; n++ }
  return n
}
