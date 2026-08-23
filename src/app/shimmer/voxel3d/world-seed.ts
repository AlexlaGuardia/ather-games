// The seed the Wilds and the Home Plot are both generated from.
//
// ★ IT LIVES HERE BECAUSE TWO MODULES NEED IT AND IT BELONGS TO NEITHER. `VoxelWorld` generates
// from it; `page.tsx` needs it to address the save records at boot, before the world module is
// even loaded (it is a deferred `ssr: false` import, and importing a constant out of it would pull
// the whole R3F scene into the page bundle and defeat the deferral).
//
// ⚠ THE ALTERNATIVE WAS WRITING `1337` TWICE, and this repo has paid for that shape twice inside a
// week: the save key was a scattered literal in five places (#682) and three textual readers went
// silently blind when constants moved (2026-08-22). A number two files agree on by coincidence
// stops agreeing the first time one of them changes.
export const WORLD_SEED = 1337
