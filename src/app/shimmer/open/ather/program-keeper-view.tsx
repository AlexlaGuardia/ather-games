'use client'
import { useFrame } from '@react-three/fiber'
import { pinPrograms } from './program-keeper'
/** Always mounted inside the Canvas (outside any zone): pins each shader program the frame after it first exists. */
export function ProgramKeeper() {
  useFrame(({ gl }) => { pinPrograms(gl.info.programs as unknown as { usedTimes: number }[] | undefined) })
  return null
}
