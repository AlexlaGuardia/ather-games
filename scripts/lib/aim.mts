// BETA M60: E acts only on what the camera-centre crosshair is on (shared/aim-pick.ts). Call this after the tp, before the E press:
// it turns the keeper (yaw + pitch) from where they now stand to look at the target (x, z) at `ty` metres above the ground there.
// Same maths as interact-check's atherLook, but it reads the position from __ather.state() (px, pz), so it needs no stand coordinates.
//   import { aimAt } from './lib/aim.mts'   ...   await aimAt(p, b.x, b.z, 0.6); await p.keyboard.press('e')
const EYE = 1.6
export async function aimAt(p: any, tx: number, tz: number, ty = 0.7, frames = 8) {
  await p.evaluate((c: number, d: number, e: number, eye: number) => {
    const g = (window as any).__ather, s = g.state(), sx = s.px ?? s.x, sz = s.pz ?? s.z, dx = c - sx, dz = d - sz
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(g.ground(c, d) + e - (g.ground(sx, sz) + eye), Math.hypot(dx, dz))
    g.look(yaw, pitch)
  }, tx, tz, ty, EYE)
  // real frames (the E handler reads what the frame loop picked); a string, because tsx would wrap a named fn in __name
  await p.evaluate(`new Promise(r => { let k = ${frames}; (function tick() { if (--k <= 0) r(0); else requestAnimationFrame(tick) })() })`)
}
