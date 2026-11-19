'use client'
// FENNEL AT YOUR RINNSHOP (BETA M22). Canon (characters/moonwell-folk.md; rework 4½): Fennel is one of the five free MOGLINS
// of Moonwell Glade, the cook, warm and loud, who trades in rinn; building the Rinnshop brings Fennel, and the first
// rinstick's quest starts and ends in that talk. BUILD (Jin): Fennel stands just outside the Rinnshop door, beside it,
// facing out, for as long as the quest is open (rinquest.ts › fennelHere); the chibi Moglin rig the settlements use, with
// an apron for the kitchen (a build pick, look = Alex's call). The talk itself is use-rinquest.ts › fennelTalk.
import { MoglinModel, furOf, MOGLIN_HEIGHT } from '../shared/moglin-model'
import { ROOMS, toWorld, raised, type Works } from './rooms'

/** Where Fennel stands: beside the first raised Rinnshop's door, 1.4 m out and 1.8 m to the side, facing away from the room.
 *  Null when there is no standing Rinnshop. Pure. */
export function fennelSpot(w: Works, now = Date.now()): { x: number; z: number; yaw: number } | null {
  const r = w.rooms.find(x => x.kind === 'rinnshop' && raised(x, now)); if (!r) return null
  const d = ROOMS.rinnshop.d, at = toWorld(r, 1.8, -d / 2 - 1.4), mid = toWorld(r, 0, 0)
  return { x: at.x, z: at.z, yaw: Math.atan2(at.x - mid.x, at.z - mid.z) }
}
export const FENNEL_HEAD = MOGLIN_HEIGHT.chibi

export function Fennel({ spot, y, talking }: { spot: { x: number; z: number; yaw: number }; y: number; talking: boolean }) {
  return (
    <group position={[spot.x, y, spot.z]} rotation-y={spot.yaw}>
      <MoglinModel build="chibi" action={talking ? 'wave' : 'idle'} garb="apron" tone={furOf('fennel')} seed={3.1} />
    </group>
  )
}
