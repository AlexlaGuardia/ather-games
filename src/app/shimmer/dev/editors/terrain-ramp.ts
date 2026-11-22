// the terrain editors' hypsometric ramp (M62 TerrainEditor 2D view + M83 BuilderFly 3D view share it)
// hypsometric ramp (metres above the water line) -> rgb 0..1
const RAMP: [number, number, number, number][] = [[0, 0.86, 0.80, 0.60], [1.5, 0.52, 0.66, 0.36], [20, 0.40, 0.56, 0.30], [55, 0.56, 0.52, 0.38], [110, 0.60, 0.58, 0.56], [180, 0.95, 0.95, 0.95]]
export function ramp(m: number): [number, number, number] {
  if (m <= RAMP[0][0]) return [RAMP[0][1], RAMP[0][2], RAMP[0][3]]
  for (let i = 1; i < RAMP.length; i++) if (m <= RAMP[i][0]) {
    const a = RAMP[i - 1], b = RAMP[i], t = (m - a[0]) / (b[0] - a[0])
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
  }
  const l = RAMP[RAMP.length - 1]; return [l[1], l[2], l[3]]
}
