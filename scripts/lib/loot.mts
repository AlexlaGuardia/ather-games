// M141: a finished node drops its yield on the ground. Walk a check's keeper over every drop (movement only) until the ground is
// bare or the bag is full. Returns the drops that were lying there first.
import type { Page } from 'puppeteer-core'
export interface LootRow { id: string; item: string; n: number; x: number; y: number; z: number; at: number }
export const lootOf = (p: Page) => p.evaluate(() => (window as any).__ather.loot?.() ?? []) as Promise<LootRow[]>
export async function collect(p: Page, frame: () => Promise<unknown>): Promise<LootRow[]> {
  const first = await lootOf(p)
  for (const d of first) {
    if (!(await lootOf(p)).some(o => o.id === d.id)) continue
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z), d.x, d.z)
    for (let i = 0; i < 25 && (await lootOf(p)).some(o => o.id === d.id); i++) { await frame(); await new Promise(r => setTimeout(r, 150)) }
  }
  return first
}
export const sumOf = (rows: { item: string; n: number }[]) => { const r: Record<string, number> = {}; for (const d of rows) r[d.item] = (r[d.item] ?? 0) + d.n; return r }
