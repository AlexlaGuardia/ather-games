'use client'
// ── NPC TALK: a conversation, not a menu (Alex 11-18, BETA M13) ──────────────────────────────────────────────────────────────
// E at an NPC: the camera turns to them (the walker eases its look to `focus`), their line sits in a CHAT BUBBLE above their
// NAME, and the keeper answers from a short list: ARROWS (or W/S) move the pick, E / Enter / Space chooses, Esc leaves, a tap
// picks on a phone. Each answer opens ONE thing (a screen, the next line, or goodbye): never errand + shop + upgrades at once.
// Lines are @lark's: a tree only arranges them. The tree is plain data (TalkNode), so any NPC can use this.
import { useEffect, useState, type ReactNode } from 'react'
import { Html } from '@react-three/drei'
import { markMet } from './met'   // BETA M33: a first talk = met (Morel may carry their calls)

export interface TalkOption { label: string; pick: () => void }
export interface TalkNode { line: string; options: TalkOption[]; /** optional HUD panel drawn above the answers (M46: a Moglin's card) */ panel?: ReactNode }

/** In the scene (inside the Canvas): the NPC's name plate with the bubble above it. `at` = the point just over their head. */
export function TalkBubble({ at, name, line, scene }: { at: [number, number, number]; name: string; line: string
  /** optional stage direction above the line, in italics (Idony's beat, M13 part 3) */
  scene?: string }) {
  useEffect(() => { markMet(name) }, [name])
  return (
    <Html position={at} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
      <div data-talk-bubble style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateY(-50%)' }}>
        <div style={{ position: 'relative', maxWidth: 'min(300px, 72vw)', width: 'max-content', padding: '9px 13px', borderRadius: 14,
          background: 'rgba(250,244,232,.96)', color: '#2a2320', font: '500 14px/1.45 system-ui', boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}>
          {scene && <div data-talk-scene style={{ fontStyle: 'italic', opacity: 0.72, fontSize: 13, marginBottom: line ? 5 : 0 }}>{scene}</div>}
          {line}
          <div style={{ position: 'absolute', left: '50%', bottom: -7, marginLeft: -7, width: 14, height: 14, transform: 'rotate(45deg)', background: 'rgba(250,244,232,.96)' }} />
        </div>
        <div data-talk-name style={{ marginTop: 10, padding: '2px 9px', borderRadius: 6, background: 'rgba(20,22,26,.72)', color: '#f3e3c3',
          font: '700 11px system-ui', letterSpacing: '0.16em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{name}</div>
      </div>
    </Html>
  )
}

/** On the HUD (outside the Canvas): the keeper's answers. Arrows / W S move, E Enter Space pick, a tap picks. */
export function TalkChoices({ node, phone }: { node: TalkNode; phone: boolean }) {
  const [sel, setSel] = useState(0)
  useEffect(() => { setSel(0) }, [node])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const n = node.options.length; if (!n) return
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); setSel(s => (s + 1) % n) }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); setSel(s => (s - 1 + n) % n) }
      else if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        e.preventDefault(); e.stopImmediatePropagation(); setSel(s => { node.options[Math.min(s, n - 1)]?.pick(); return s })
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [node])
  return (
    <div data-talk-choices style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: phone ? 150 : 84,
      width: 'min(360px, calc(100vw - 32px))', display: 'grid', gap: 6, zIndex: 30 }}>
      {node.panel}
      {node.options.map((o, i) => (
        <button key={i} type="button" data-talk-option={i} data-talk-sel={i === sel ? '' : undefined}
          onPointerEnter={() => setSel(i)} onClick={() => o.pick()}
          style={{ textAlign: 'left', border: 0, borderRadius: 10, padding: phone ? '11px 14px' : '8px 12px', cursor: 'pointer',
            font: '600 13px system-ui', color: i === sel ? '#fff' : 'rgba(243,227,195,.82)',
            background: i === sel ? 'rgba(224,130,63,.92)' : 'rgba(20,22,26,.78)', boxShadow: i === sel ? '0 0 0 1.5px #f3b47c' : 'none' }}>
          <span style={{ display: 'inline-block', width: 16, opacity: i === sel ? 1 : 0 }}>›</span>{o.label}
        </button>
      ))}
      {!phone && <div style={{ textAlign: 'center', font: '600 10px system-ui', letterSpacing: '0.18em', color: 'rgba(243,227,195,.6)', textShadow: '0 1px 2px #000' }}>
        ↑ ↓ CHOOSE · E ANSWER · ESC LEAVE</div>}
    </div>
  )
}
