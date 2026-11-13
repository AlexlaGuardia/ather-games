// A REGION of the continent, as exported by tools/worldmap/export_region.py: a 5 m height grid (int16 decimetres)
// with the Atlas roads already cut in, plus the roads' centre lines and the places, in metres. x east, z south,
// origin at the region's centre.
//
// ★ As with land.ts: what you see is what you drive on. `heightAt` interpolates the SAME two triangles per cell the
// mesh draws, split on the (i,j)→(i+1,j+1) diagonal.

export interface RegionRoad { id: string; kind: 'paved' | 'road' | 'trail' | 'pass'; from: string; to: string; width: number; pts: [number, number, number][] }
export interface RegionPlace { id: string; name: string | null; kind: string; x: number; z: number; y: number }
export interface RegionMeta {
  name: string; cell: number; nx: number; nz: number; sizeX: number; sizeZ: number; scale: number
  roads: RegionRoad[]; places: RegionPlace[]
}
export interface Region {
  meta: RegionMeta
  h: Float32Array                     // metres, row-major (z rows of nx)
  heightAt: (x: number, z: number) => number
  vertex: (i: number, j: number) => number
}

export function makeRegion(meta: RegionMeta, raw: Int16Array): Region {
  const { nx, nz, cell, sizeX, sizeZ, scale } = meta
  if (raw.length !== nx * nz) throw new Error(`region ${meta.name}: ${raw.length} samples, expected ${nx * nz}`)
  const h = new Float32Array(raw.length)
  for (let k = 0; k < raw.length; k++) h[k] = raw[k] * scale
  const hx = sizeX / 2, hz = sizeZ / 2
  const vertex = (i: number, j: number) => h[j * nx + i]
  const heightAt = (x: number, z: number) => {
    const gx = (x + hx) / cell, gz = (z + hz) / cell
    if (gx < 0 || gz < 0 || gx > nx - 1 || gz > nz - 1) return -Infinity
    const i = Math.min(nx - 2, Math.floor(gx)), j = Math.min(nz - 2, Math.floor(gz))
    const fx = gx - i, fz = gz - j
    const h00 = h[j * nx + i], h10 = h[j * nx + i + 1], h01 = h[(j + 1) * nx + i], h11 = h[(j + 1) * nx + i + 1]
    return fx >= fz
      ? h00 + (h10 - h00) * fx + (h11 - h10) * fz
      : h00 + (h11 - h01) * fx + (h01 - h00) * fz
  }
  return { meta, h, heightAt, vertex }
}

/** Browser: fetch the pair from /open/<name>.{json,bin}. */
export async function loadRegion(name: string): Promise<Region> {
  const [meta, bin] = await Promise.all([
    fetch(`/open/${name}.json`).then(r => r.json() as Promise<RegionMeta>),
    fetch(`/open/${name}.bin`).then(r => r.arrayBuffer()),
  ])
  return makeRegion(meta, new Int16Array(bin))
}

/** The nearest point on any road's centre line: distance (m) and the road. For "on road?" and callouts. */
export function nearestRoad(region: Region, x: number, z: number): { d: number; road: RegionRoad | null } {
  let best = Infinity, road: RegionRoad | null = null
  for (const r of region.meta.roads) {
    const p = r.pts
    for (let k = 0; k < p.length - 1; k++) {
      const ax = p[k][0], az = p[k][1], bx = p[k + 1][0], bz = p[k + 1][1]
      const abx = bx - ax, abz = bz - az, L = abx * abx + abz * abz || 1
      const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / L))
      const d = Math.hypot(ax + abx * t - x, az + abz * t - z)
      if (d < best) { best = d; road = r }
    }
  }
  return { d: best, road }
}
