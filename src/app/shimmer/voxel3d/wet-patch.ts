// The damp patch on a watered bed — farming ②'s only visual (`voxel3d/watering.ts` owns the state).
//
// ★ WHY A MESH AT ALL. Farming ① shipped a loop whose planted beds drew NOTHING for 26 days, and
// the lesson written on it was that an invisible feature reads as an absent one. A watered bed
// that looks like a dry bed is the same bug: the keeper pours, a sentence flashes, and by the next
// morning nothing says which beds were done. So the water shows — a dark, slightly glossy skin on
// the bed's top face that fades back to the soil over the day, so the fade IS the clock.
//
// ★ NOT A FOURTH BED MATERIAL. Three woods × wet/dry would be three new block ids, three tile
// rows and a `setVoxel` on every pour and every dry (an edit, a re-mesh, a save). A quad per damp
// bed over the top face costs one instanced draw for the whole plot and touches no voxel.
//
// Shaped after `seam.ts`: every GPU resource constructed ONCE inside the factory (render-audit's
// rule), a fixed instance budget, `set` rewrites the matrices and per-instance colours, nothing
// allocated per frame. The colour is the one thing that moves: wet soil is near-black-brown and it
// lerps toward the bed's dry earth as `fraction` falls — which is why `set` takes the fraction and
// not a boolean.
import * as THREE from 'three'

/** Beds the plot can hold at once; canon caps a plot at 8, a keeper can stack more — plenty. */
export const WET_BUDGET = 64

/** `fraction` = water left [0,1]; `fed` = feed left [0,1]. Either alone draws a patch. */
export interface WetSpot { x: number; y: number; z: number; fraction: number; fed?: number }

export interface WetPatches {
  group: THREE.Group
  /** Rewrite every patch. Cheap; called on a beat, never per frame. */
  set(spots: ReadonlyArray<WetSpot>): void
  dispose(): void
}

/** Just-poured: near-black wet earth. */
const WET = new THREE.Color(0x2a1d12)
/** Nearly dry: the patch is barely there. Lerp target, then the instance drops out at 0. */
const DRY = new THREE.Color(0x5a4630)
/** Just-fed: a rich black loam with a green cast — the brew worked in. Reads apart from wet's brown. */
const FED = new THREE.Color(0x1c2416)

export function createWetPatches(): WetPatches {
  const group = new THREE.Group()
  // A unit quad, laid flat (+y normal), sitting a hair over the bed's top face so it never z-fights
  // the soil and sits under a crop's root (`FLORA_PLACE.CROP.root` = 0.97 — the crop stands ON it).
  const geo = new THREE.PlaneGeometry(0.92, 0.92)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: false, transparent: true, opacity: 0.85, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, WET_BUDGET)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(WET_BUDGET * 3), 3)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.renderOrder = 1
  group.add(mesh)
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  return {
    group,
    set(spots) {
      let n = 0
      for (const s of spots) {
        if (n >= WET_BUDGET) break
        const fed = s.fed ?? 0
        if (s.fraction <= 0 && fed <= 0) continue
        m.makeTranslation(s.x + 0.5, s.y + 1.004, s.z + 0.5)
        mesh.setMatrixAt(n, m)
        // The colour is the clock: wet → dry as the fraction falls. Squared, so the first hours
        // stay visibly dark and the last hours do the fading. The feed pulls the same patch toward
        // a green-black loam by ITS fraction, so damp+fed reads darker and greener than either.
        c.copy(DRY).lerp(WET, s.fraction * s.fraction).lerp(FED, fed * fed * 0.8)
        mesh.setColorAt(n, c)
        n++
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
    dispose() {
      geo.dispose(); mat.dispose(); mesh.dispose()
    },
  }
}
