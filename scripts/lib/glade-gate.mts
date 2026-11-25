// M172 (Alex 11-25): the Glade's gate opens the same fold map as every other Ather gate. It used to go straight to the Wilds on one
// E (M67 s1a), so a check that pressed E there now picks the Wilds' stop on the map it opens, as a player does (a real click / tap).
import type { Page } from 'puppeteer-core'
export const stopsOf = async (p: Page) => {
  const out: string[] = []
  for (const e of await p.$$('[data-panel="fold-map"] button')) { const t = await e.evaluate(n => (n as HTMLElement).innerText.split('\n')[0].trim()); if (t) out.push(t) }
  return out
}
export async function pickStop(p: Page, name: string, phone = false) {
  await p.waitForSelector('[data-panel="fold-map"]', { timeout: 20000 })
  for (const e of await p.$$('[data-panel="fold-map"] button')) {
    if ((await e.evaluate(n => (n as HTMLElement).innerText.split('\n')[0].trim())) !== name) continue
    await e.scrollIntoView(); if (phone) await e.tap(); else await e.click(); return true
  }
  return false
}
export const pickWilds = (p: Page, phone = false) => pickStop(p, "Gregory's waymark", phone)
