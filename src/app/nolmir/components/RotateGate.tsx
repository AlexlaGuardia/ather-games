'use client'

// Nolmir is a landscape / command-deck game. The web can't force orientation —
// iOS Safari ignores the Screen Orientation lock API outright — so instead of
// contorting the landscape halls into portrait, we guide the phone to rotate.
//
// On a portrait touch device this drops a full-screen prompt OVER the game (the
// game stays mounted behind, so idle accrual keeps running) and lifts itself the
// instant the device turns landscape. Desktops (pointer: fine) are never gated.

import { useEffect, useState } from 'react'

const QUERY = '(orientation: portrait) and (pointer: coarse)'

export default function RotateGate({ children }: { children: React.ReactNode }) {
  const [portrait, setPortrait] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(QUERY)
    const update = () => setPortrait(mq.matches)
    update()
    // addEventListener is the modern API; older Safari only has addListener.
    if (mq.addEventListener) mq.addEventListener('change', update)
    else mq.addListener(update)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update)
      else mq.removeListener(update)
    }
  }, [])

  return (
    <>
      {children}
      {portrait && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#05060e] px-8 text-center">
          <div className="nolmir-rotate text-6xl" aria-hidden>📱</div>
          <div className="space-y-1.5">
            <p className="text-sky-300 text-sm tracking-[0.3em] uppercase">Turn your device</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Nolmir runs in landscape — the deck is wide.
              <br />
              Rotate to hold the watch.
            </p>
          </div>
          <style>{`
            @keyframes nolmir-rotate-hint {
              0%, 55% { transform: rotate(0deg) }
              75%, 100% { transform: rotate(-90deg) }
            }
            .nolmir-rotate {
              display: inline-block;
              color: #7dd3fc;
              animation: nolmir-rotate-hint 2.4s ease-in-out infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .nolmir-rotate { animation: none; transform: rotate(-90deg) }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
