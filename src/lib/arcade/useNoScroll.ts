import { useEffect } from 'react'

// ARCADE TOOLKIT — pin a one-screen game to the viewport on mobile. Kills body
// scroll and the iOS rubber-band/page-drag that makes a tap-game feel loose.
// Any genuinely scrollable inner region can opt out by carrying data-scroll="1".
//
// Use only on games whose chrome fits a phone screen (Ward, Mana'nana, Rekindle).
// Do NOT use on content surfaces that need to scroll (Magii lore, Nolmir panels).
export function useNoScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    const html = document.documentElement
    const body = document.body
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOver: html.style.overscrollBehavior,
      bodyOver: body.style.overscrollBehavior,
      touch: body.style.touchAction,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    body.style.touchAction = 'manipulation'

    // React's onTouchMove is passive, so preventDefault there is ignored — a real
    // non-passive listener is the only way to stop the iOS page-drag/bounce.
    const onTouchMove = (e: TouchEvent) => {
      for (let el = e.target as HTMLElement | null; el; el = el.parentElement) {
        if (el.dataset?.scroll) return // allow scrolling inside opted-in regions
      }
      if (e.cancelable) e.preventDefault()
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      html.style.overflow = prev.htmlOverflow
      body.style.overflow = prev.bodyOverflow
      html.style.overscrollBehavior = prev.htmlOver
      body.style.overscrollBehavior = prev.bodyOver
      body.style.touchAction = prev.touch
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [enabled])
}
