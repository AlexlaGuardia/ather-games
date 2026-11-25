// MOMO'S SPOT (BETA M155 s2): by Bonn's boots, wherever Bonn stands (her own spot, or where Place mode put her; ASK AT THE CALL). Canon:
// he is Bonn's mana'mal (never a spirit): he does not battle, is not caught, does not evolve, has no E and says nothing. Pure.
import { gladeKeepers, type Placed } from './glade-cluster'

/** her left first (Hazel stands to her right), a touch behind her boots (nearer, a phone's bars cover him while she talks); then the other ways round if that ground is bad. m */
const SPOTS: readonly { side: number; ahead: number }[] = [{ side: 0.48, ahead: -0.16 }, { side: -0.48, ahead: -0.16 }, { side: 0.3, ahead: 0.5 }, { side: -0.3, ahead: 0.5 }, { side: 0.35, ahead: -0.4 }, { side: -0.35, ahead: -0.4 }]
/** the most his ground may differ from hers (m) */
export const MOMO_STEP = 0.15
export interface MomoSpot { x: number; y: number; z: number; yaw: number }
export function momoSpot(ground: (x: number, z: number) => number, blocked: (x: number, z: number) => boolean = () => false, bonn: Pick<Placed, 'x' | 'z' | 'yaw'> | undefined = gladeKeepers().find(k => k.id === 'bonn')): MomoSpot | null {
  if (!bonn) return null
  const fx = Math.sin(bonn.yaw), fz = Math.cos(bonn.yaw), y0 = ground(bonn.x, bonn.z)
  const all = SPOTS.map(s => { const x = bonn.x + fx * s.ahead + fz * s.side, z = bonn.z + fz * s.ahead - fx * s.side; return { x, y: ground(x, z), z, yaw: bonn.yaw } })
  const level = all.filter(p => Math.abs(p.y - y0) <= MOMO_STEP)
  return level.find(p => !blocked(p.x, p.z)) ?? level[0] ?? { ...all[0], y: y0 }
}
/** he looks a keeper over from this near (m) */
export const MOMO_SEES = 7
