'use client'
// THE TOOL PANEL (BETA M184 s2): a tool dial clicked (desktop) or tapped (phone) opens this. Data from ather/tool-panel.ts
// (the game's own tables); the words here are plain labels (listed for @lark in the M184 s2 report). Closes on the X, Escape,
// the same dial again, or a press anywhere outside it. data-* carry the numbers for the prod check.
import React, { useEffect, useRef } from 'react'
import { HudPlate } from '../../ui/hearth-hud'
import { HUD_FACES } from '../../ui/hud-face'
import { hearthDisplay, hearthBody } from '../../ui/hearth'
import { SKILL_META, type SkillId } from '../../engine/skills'
import type { ToolPanel } from '../ather/tool-panel'

const FACE = 'full' as const
const VERDICT = { ok: 'ok', slow: 'slow', weak: 'too weak' } as const
const VERDICT_COLOR = { ok: '#4f6e37', slow: '#9a6a1e', weak: '#8a3b2a' } as const
const fmtSecs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)

export function ToolPanelView({ panel, phone, onClose }: { panel: ToolPanel; phone: boolean; onClose: () => void }) {
  const t = HUD_FACES[FACE]
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const down = (e: PointerEvent) => {
      const el = e.target as Element | null
      if (box.current?.contains(el as Node) || el?.closest?.('[data-dial-btn]')) return
      onClose()
    }
    addEventListener('keydown', key); addEventListener('pointerdown', down, true)
    return () => { removeEventListener('keydown', key); removeEventListener('pointerdown', down, true) }
  }, [onClose])
  const skill = SKILL_META[panel.family as SkillId]?.name ?? panel.family
  const stage = panel.stage < 0 ? 'empty' : panel.stage === 0 ? 'worn' : `${panel.stage} of 3`
  const pos: React.CSSProperties = phone
    ? { position: 'fixed', left: 8, right: 8, bottom: 'calc(env(safe-area-inset-bottom) + 150px)', zIndex: 60 }
    : { position: 'fixed', right: 24, bottom: 250, width: 430, zIndex: 60 }
  return (
    <div ref={box} style={pos} className="pointer-events-auto" data-tool-panel={panel.family} data-held={panel.held ? '1' : '0'}
         data-stage={panel.stage} data-uses={panel.uses ?? ''} data-durability={panel.durability ?? ''} data-rung={panel.rung}
         onPointerDown={e => e.stopPropagation()}>
      <HudPlate face={FACE} r={12} style={{ padding: 4 }}>
        <div className="px-3 py-2" style={{ ...hearthBody, color: t.text }}>
          <div className="flex items-center gap-2">
            <b className="text-[15px]" style={{ ...hearthDisplay, color: panel.held ? t.text : t.textDim }} data-panel-name>
              {panel.name ?? skill}
            </b>
            <span className="text-[11px]" style={{ color: t.textDim }}>{skill}</span>
            <button type="button" aria-label="close" onClick={onClose} className="ml-auto w-7 h-7 -mr-1 rounded-full text-[15px] leading-none"
                    style={{ color: t.textDim }} data-panel-close>×</button>
          </div>
          {!panel.held ? (
            <div className="text-[12px] mt-1" style={{ color: t.textDim }} data-panel-empty>Not in hand yet.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] mt-1 tabular-nums">
                <span><span style={{ color: t.textDim }}>Stage </span><b>{stage}</b></span>
                <span data-panel-durability><span style={{ color: t.textDim }}>Durability </span><b>{panel.durability === null ? 'never wears' : `${panel.uses} / ${panel.durability}`}</b></span>
                <span><span style={{ color: t.textDim }}>XP </span><b>×{panel.xpMult}</b></span>
                {panel.ease !== null && <span data-panel-ease><span style={{ color: t.textDim }}>Ease </span><b>×{panel.ease}</b></span>}
              </div>
              {panel.rows.length > 0 && (
                <table className="w-full mt-2 text-[11.5px] tabular-nums border-collapse">
                  <thead><tr style={{ color: t.textDim }} className="text-left">
                    <th className="font-normal pr-2">Node</th><th className="font-normal pr-2 text-right">Mana</th>
                    <th className="font-normal pr-2 text-right">Time</th><th className="font-normal pr-2 text-right">Reset</th><th className="font-normal text-right"> </th>
                  </tr></thead>
                  <tbody>
                    {panel.rows.map(r => (
                      <React.Fragment key={r.name}>
                        <tr data-node-row={r.name} data-mana={r.mana} data-secs={r.secs} data-verdict={r.verdict} style={{ opacity: r.verdict === 'weak' ? 0.75 : 1 }}>
                          <td className="pr-2 pt-1 font-bold">{r.name}</td>
                          <td className="pr-2 pt-1 text-right">{r.mana}</td>
                          <td className="pr-2 pt-1 text-right">{fmtSecs(r.secs)}</td>
                          <td className="pr-2 pt-1 text-right">{r.resetMin}m</td>
                          <td className="pt-1 text-right font-bold whitespace-nowrap" style={{ color: VERDICT_COLOR[r.verdict] }}>{VERDICT[r.verdict]}</td>
                        </tr>
                        <tr><td colSpan={5} className="text-[10.5px] pb-0.5" style={{ color: t.textDim }}>{r.drops}</td></tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </HudPlate>
    </div>
  )
}
