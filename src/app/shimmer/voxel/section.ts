// A voxel SECTION — the mesh unit and the compression unit.
//
// ★ PURE CORE. Nothing in src/app/shimmer/voxel/ may import react, three, @react-three/*, or touch
// the DOM. That is port-boundary rule 4 from VOXEL-WORLD-MODEL.md, and `purity.test.ts` enforces it
// by walking the import graph — because "we'll port it to Supra later" dies the day the world model
// grows a useState, and it will, unless something fails loudly.
//
// Storage is a flat Uint16Array, never an object per voxel: a Uint16Array is a Vec<u16> in Rust,
// and it is also the difference between a browser voxel game that runs and one that GC-stutters.
// Value 0 is AIR. Every other value is a palette index (§ 3 of the design doc); the palette itself
// is not needed to MESH, only to skin, which is why the mesher below never looks at it.

export const AIR = 0

/** A cubic section of edge length `size`. Indexing is x-major within a row so a u-sweep is linear. */
export class Section {
  readonly size: number
  readonly data: Uint16Array

  constructor(size: number, data?: Uint16Array) {
    this.size = size
    this.data = data ?? new Uint16Array(size * size * size)
  }

  /** idx = (y * size + z) * size + x — x contiguous, which is the axis the mask sweep walks fastest. */
  idx(x: number, y: number, z: number): number {
    return (y * this.size + z) * this.size + x
  }

  get(x: number, y: number, z: number): number {
    return this.data[(y * this.size + z) * this.size + x]
  }

  set(x: number, y: number, z: number, v: number): void {
    this.data[(y * this.size + z) * this.size + x] = v
  }

  /**
   * Does this section hold exactly one value? Then it serialises to a one-entry palette with NO
   * packed array at all — Anvil's single-value-section trick (research steal #5), and the reason
   * a 128-tall world costs ~3.9MB rather than 49MB: most sections are all-air or all-stone.
   */
  uniformValue(): number | null {
    const first = this.data[0]
    for (let i = 1; i < this.data.length; i++) if (this.data[i] !== first) return null
    return first
  }

  /** Distinct non-air values — the section's local palette size, before bit-packing. */
  paletteSize(): number {
    const seen = new Set<number>()
    for (let i = 0; i < this.data.length; i++) seen.add(this.data[i])
    return seen.size
  }
}
