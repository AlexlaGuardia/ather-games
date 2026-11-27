// The phone "Tap to start" intro card (open/ather/page.tsx: isTouch && !introSeen): a full-screen zIndex-30 overlay that closes on CLICK.
// A real player taps it; so do we (touchscreen tap, falling back to mouse click), then wait until no "Tap to start" text is in the DOM.
// No-op when the card is not there (desktop, or already seen). Throws if it will not go.
//   import { dismissStartCard } from './lib/start-card.mts'   ...   await dismissStartCard(p)
//
// The desktop "Click to play" card (!isTouch && !isLocked && !played, pointerEvents none) has NO click handler: it hides when the canvas
// click's requestPointerLock() succeeds (pointerlockchange -> setPlayed). So a real player clicks the canvas; so do we, then wait for the card to go.
export async function dismissStartCard(p: any, timeoutMs = 15000): Promise<boolean> {
  const t0 = Date.now()
  const desktopUp = async (): Promise<boolean> => p.evaluate(() => [...document.querySelectorAll('div')].some(d => [...d.childNodes].some(n => n.nodeType === 3 && /Click to play/i.test(n.textContent ?? ''))))
  if (await desktopUp()) {
    let clicked = false
    while (Date.now() - t0 < timeoutMs) {
      if (!(await desktopUp())) return clicked
      const vp = p.viewport?.() ?? { width: 1280, height: 720 }
      await p.mouse.click(vp.width / 2, vp.height * 0.6); clicked = true
      await new Promise(r => setTimeout(r, 700))
    }
    throw new Error(`dismissStartCard: the "Click to play" card is still up after ${timeoutMs}ms (pointer lock refused?)`)
  }
  let tapped = false
  const present = async (): Promise<boolean> => p.evaluate(() => [...document.querySelectorAll('div')].some(d => d.children.length === 0 && /^Tap to start$/i.test((d.textContent ?? '').trim())))
  // the card mounts after the scene boots: give it a moment to appear before deciding there is none
  for (let i = 0; i < 12 && !(await present()); i++) { if (tapped) break; await new Promise(r => setTimeout(r, 250)) }
  while (Date.now() - t0 < timeoutMs) {
    if (!(await present())) return tapped
    const box = await p.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(d => d.children.length === 0 && /^Tap to start$/i.test((d.textContent ?? '').trim()))
      const r = el?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
    })
    if (box) { try { await p.touchscreen.tap(box.x, box.y) } catch { await p.mouse.click(box.x, box.y) }; tapped = true }
    await new Promise(r => setTimeout(r, 700))
  }
  throw new Error(`dismissStartCard: the "Tap to start" card is still up after ${timeoutMs}ms`)
}
