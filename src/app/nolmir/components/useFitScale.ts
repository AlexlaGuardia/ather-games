import { useCallback, useLayoutEffect, useRef, useState } from 'react'

// Scale a fixed-size hero (the 640px arenas) down to fit its container without
// scrolling. Returns a ref for the measured box and a CSS scale in (0, 1].
// A CSS `transform: scale()` is click-safe: getBoundingClientRect reports the
// transformed rect, so the arenas' click-to-place math still maps correctly.
export function useFitScale(naturalW: number, naturalH: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  const measure = useCallback(() => {
    const box = ref.current
    if (!box) return
    const { width, height } = box.getBoundingClientRect()
    if (width === 0 || height === 0) return
    setScale(Math.min(width / naturalW, height / naturalH, 1))
  }, [naturalW, naturalH])

  useLayoutEffect(() => {
    measure()
    const box = ref.current
    if (!box || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [measure])

  return { ref, scale }
}
