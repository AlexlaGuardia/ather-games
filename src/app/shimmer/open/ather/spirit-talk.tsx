'use client'
// M109 s2: Feed is real (spirit-feed.ts): one spirit food from the bag, her happy beat, a fed record. Care, not a leash.
// M109 s1 (sprites, 2026-11-23, owner + ?spirits=3d only): E AT A GARDEN SPIRIT. The game's own talk (shared/npc-talk.tsx,
// M13): her name plate + bubble over her, the keeper's answers on the HUD. Three answers, Alex's words: Feed (s2: greyed,
// 'soon'), Follow (she walks with the keeper; the answer reads Stay while she does), Open (the SPIRIT PANEL). Stores nothing
// (glossary > Grimoire): Follow is only "this one walks with me", kept in spirit-follow.ts.
// The spirit panel: Carved Hearth frame, her live model on a turntable, the species' base stats on the Moglin-card radar,
// the moves the data gives her species (spirit-sheet.ts says where each comes from).
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { TalkNode } from '../shared/npc-talk'
import { HearthFrame, H } from '../../ui/hearth'
import { StatRadar } from './moglin-card-view'
import { SpiritAvatar } from './spirit-model'
import { spiritModelFor } from './spirit-models'
import { spiritSheet } from './spirit-sheet'
import { GROWTH_LABEL } from './spirit-growth'   // M118 s1: the growth bar's label
import { loadStats, subscribeStats, previewPlay, poolLeft, TRAIN } from './spirit-stats'   // M110 s1: her trained stats; M118 s2: the pool + preview
import { loadAssign, mayUse, setAssign, subscribeAssign } from './train-assign'   // M118 s2: the keeper assigns pieces
import { loadWorks } from './rooms'
import { FURNITURE } from './furniture'
import { SHEET_LABEL } from './spirit-sheet'
import { isFollowing, setFollowing, spiritHeld, spiritLive, subscribeFollow } from './spirit-follow'
import { SPECIES_NAMES } from '../../spirits/spirit'
import { hudSay } from '../shared/hud-say'
import { getInv, setInv, useInv } from '../shared/bag'
import { itemDef } from '../shared/inventory'
import { feed, foodIn, loadFed, saveFed, spiritCheer } from './spirit-feed'
import { askAlong, inParty } from './spirit-party'
import { FEED_NONE, fedLine, followRefuseLine, talkLine } from './party-spirit-lines'   // M109: the SIGNED lines (canon script, word for word)
import { PARTY_FULL_LINE } from './spirit-roster'


export type SpiritTalkState = { id: string; screen: 'talk' | 'panel' }

export function useSpiritTalk(st: SpiritTalkState | null, set: (s: SpiritTalkState | null) => void, phone: boolean) {
  const following = useSyncExternalStore(subscribeFollow, () => (st ? isFollowing(st.id) : false), () => false)
  // where she stood when the talk opened (she stands still while talked to: spiritHeld), and her species
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const live = useMemo(() => (st ? spiritLive.get(st.id) ?? null : null), [st?.id])
  const food = foodIn(useInv())   // what Feed would give (shown as the answer's tag), or null
  useEffect(() => { spiritHeld.id = st && live ? st.id : null; return () => { spiritHeld.id = null } }, [st, live])
  useEffect(() => { if (st && !live) set(null) }, [st, live, set])
  // M109 signed: E on a PARTY spirit draws one line (generic five + her species' pair) per talk. A garden spirit not in the
  // party is not covered by the script: she keeps the '…'.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const said = useMemo(() => (st && live ? (inParty(st.id) ? talkLine(live.sp) : '…') : ''), [st?.id, live])   // her model is gone (flag off, planter lifted): nothing to talk to
  const node: TalkNode | null = useMemo(() => {
    if (!st || st.screen !== 'talk' || !live) return null
    const id = st.id
    return {
      line: said,
      options: [
        { label: 'Feed', tag: food ? itemDef(food).name : undefined, pick: () => {
          const r = feed(getInv(), loadFed(), id, Date.now())
          if (!r) { hudSay(FEED_NONE, 'info', 4); set(null); return }   // nothing taken
          setInv(r.inv); saveFed(r.book); spiritCheer.add(id)
          hudSay(fedLine(live.sp, itemDef(r.item).name), 'item', 4); set(null)
        } },
        following ? { label: 'Stay', pick: () => { setFollowing(id, false); set(null) } } : { label: 'Follow', pick: () => {
          // M109 s3: the ones who come along are from the party (up to 3 of the 8): Follow asks her along first
          if (!askAlong(id)) hudSay(PARTY_FULL_LINE, 'info', 4)
          else if (!setFollowing(id, true)) hudSay(followRefuseLine(live.sp), 'info', 4)
          set(null) } },
        { label: 'Open', pick: () => set({ id, screen: 'panel' }) },
      ],
    }
  }, [st, live, following, set, food, said])
  const panel = st && st.screen === 'panel' && live ? <SpiritPanel sp={live.sp} id={live.id} phone={phone} onClose={() => set(null)} /> : null
  return {
    node, panel,
    name: live ? SPECIES_NAMES[live.sp] : '',
    head: live ? { x: live.x, y: live.y + live.h, z: live.z } : null,
  }
}

export function SpiritPanel({ sp, id, phone, onClose }: { sp: Parameters<typeof spiritSheet>[0]; /** M110: her planter id (the stat record) */ id?: string; phone: boolean; onClose: () => void }) {
  const [statsV, setStatsV] = useState(0)
  useEffect(() => subscribeStats(() => setStatsV(v => v + 1)), [])   // M110 s1: a play while the panel is open shows at once
  const sheet = useMemo(() => spiritSheet(sp, id ? loadStats()[id] : undefined), [sp, id, statsV]), look = spiritModelFor(sp)
  // M118 s2: her training pool, the plot's training pieces, which the keeper lets her use, and what one play there WILL spend
  const [asgV, setAsgV] = useState(0)
  useEffect(() => subscribeAssign(() => setAsgV(v => v + 1)), [])
  const train = useMemo(() => {
    if (!id) return null
    const rec = loadStats()[id], asg = loadAssign()
    const pieces = loadWorks().pieces.flatMap(pc => { const f = FURNITURE[pc.item]; return f?.train ? [{ id: pc.id, name: f.name, on: mayUse(asg, pc.id, id), pv: previewPlay(rec, sp, f.train) }] : [] })
    return { left: poolLeft(rec), pieces }
  }, [sp, id, statsV, asgV])
  const ink = { label: H.inkSoft, ring: 'rgba(58,39,22,.2)', spoke: 'rgba(58,39,22,.16)' }
  return (
    <HearthFrame title={sheet.name} maxWidth={420} onClose={onClose} fixed dataPanel="spirit">
      <div data-spirit-sheet={sp} data-spirit-name={sheet.name} className="px-4 pt-7 pb-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {look && <SpiritAvatar sp={sp} look={look} size={phone ? 124 : 132} />}
          <StatRadar phone={phone} attr="spirit" ink={ink}
            axes={sheet.axes.map(a => ({ key: a.stat, label: a.label, reach: a.reach, mark: String(a.value), tint: H.ink }))} />
        </div>
        {/* M118 s1: her growth bar (levels hidden: a fill, never a number). Label = lark's UNSIGNED draft (aa22eef). */}
        <div data-spirit-growth={sheet.growth.toFixed(3)} className="mt-3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-[13px] font-bold" style={{ color: H.inkSoft }}>{GROWTH_LABEL}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(58,39,22,.12)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(sheet.growth * 100)}%`, height: '100%', background: H.ember, transition: 'width .4s' }} />
          </div>
        </div>
        {train && (
          <div data-spirit-training data-pool-left={train.left} data-pool={TRAIN.pool} className="mt-3">
            {/* M118 s2: words are PLACEHOLDERS for @lark */}
            <div className="mb-1.5 text-[13px] font-bold flex" style={{ color: H.inkSoft }}>
              <span>Training points</span><span className="ml-auto tabular-nums">{train.left} / {TRAIN.pool}</span></div>
            {train.pieces.length ? (
              <div style={{ display: 'grid', gap: 4 }}>
                {train.pieces.map(t => (
                  <div key={t.id} data-train-piece={t.id} data-train-on={t.on ? '1' : '0'} data-preview-stat={t.pv.stat} data-preview-spend={t.pv.spend}
                    data-preview-from={t.pv.from} data-preview-to={t.pv.to} data-preview-left={t.pv.left}
                    className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-2 text-[13px]" style={{ background: 'rgba(255,250,240,.6)', boxShadow: 'inset 0 0 0 1px rgba(58,39,22,.14)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: H.ink }}>{t.name}</div>
                      <div style={{ color: H.inkFaint, fontSize: 12 }}>{t.pv.why === 'ok' ? `One play: ${t.pv.spend} point, ${SHEET_LABEL[t.pv.stat]} ${t.pv.from} → ${t.pv.to}` : t.pv.why === 'cap' ? `${SHEET_LABEL[t.pv.stat]} at its limit` : 'No points left'}</div>
                    </div>
                    <button data-train-toggle={t.id} onClick={() => setAssign(t.id, id!, !t.on)} className="ml-auto rounded-[6px] px-2.5 py-1 text-[12px] font-bold"
                      style={{ minHeight: 32, whiteSpace: 'nowrap', background: t.on ? H.ember : 'rgba(58,39,22,.08)', color: t.on ? '#fff' : H.ink }}>{t.on ? 'Allowed' : 'Allow'}</button>
                  </div>
                ))}
                <div className="text-[12px] italic" style={{ color: H.inkFaint }}>Points spent stay spent.</div>
              </div>
            ) : <div data-spirit-training-empty className="text-[13px] italic" style={{ color: H.inkFaint }}>no training pieces on the plot</div>}
          </div>
        )}
        <div className="mt-3 mb-1.5 text-[13px] font-bold" style={{ color: H.inkSoft }}>Moves</div>
        {sheet.moves.length ? (
          <div data-spirit-moves style={{ display: 'grid', gap: 4 }}>
            {sheet.moves.map(m => (
              <div key={m.id} data-spirit-move={m.id} className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-2 text-[13px]"
                style={{ background: 'rgba(255,250,240,.6)', boxShadow: 'inset 0 0 0 1px rgba(58,39,22,.14)' }}>
                <span style={{ fontWeight: 700, color: H.ink }}>{m.name}</span>
                <span style={{ marginLeft: 'auto', color: H.inkFaint, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {m.power ? `${m.power}` : '·'}</span>
              </div>
            ))}
          </div>
        ) : <div data-spirit-moves-empty className="text-[13px] italic" style={{ color: H.inkFaint }}>no moves known yet</div>}
      </div>
    </HearthFrame>
  )
}
