'use client'
// M109 s2: Feed is real (spirit-feed.ts): one spirit food from the bag, her happy beat, a fed record. Care, not a leash.
// M109 s1 (sprites, 2026-11-23, owner + ?spirits=3d only): E AT A GARDEN SPIRIT. The game's own talk (shared/npc-talk.tsx,
// M13): her name plate + bubble over her, the keeper's answers on the HUD. Three answers, Alex's words: Feed (s2: greyed,
// 'soon'), Follow (she walks with the keeper; the answer reads Stay while she does), Open (the SPIRIT PANEL). Stores nothing
// (glossary > Grimoire): Follow is only "this one walks with me", kept in spirit-follow.ts.
// The spirit panel: Carved Hearth frame, her live model on a turntable, the species' base stats on the Moglin-card radar,
// the moves the data gives her species (spirit-sheet.ts says where each comes from).
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { TalkNode } from '../shared/npc-talk'
import { HearthFrame, H } from '../../ui/hearth'
import { StatRadar } from './moglin-card-view'
import { SpiritAvatar } from './spirit-model'
import { spiritModelFor } from './spirit-models'
import { spiritSheet } from './spirit-sheet'
import { isFollowing, setFollowing, spiritHeld, spiritLive, subscribeFollow } from './spirit-follow'
import { SPECIES_NAMES } from '../../spirits/spirit'
import { hudSay } from '../shared/hud-say'
import { getInv, setInv, useInv } from '../shared/bag'
import { itemDef } from '../shared/inventory'
import { feed, foodIn, loadFed, saveFed, spiritCheer } from './spirit-feed'

/** a 4th Follow while FOLLOW_MAX (3) already walk with the keeper: refused with this line */
const FOLLOW_FULL_LINE = '…'   // TODO @lark: the refusal line (three spirits already walk with you)
/** M109 s2: Feed with no spirit food in the bag. Functional UI words (the 'No waymarks in your bag.' pattern): TODO @lark */
const FEED_NONE_LINE = 'No spirit food in your bag.'
/** M109 s2: the HUD note after a feed (functional label, the item-toast pattern): TODO @lark */
const fedLine = (spirit: string, food: string) => `${spirit} · ${food}`

export type SpiritTalkState = { id: string; screen: 'talk' | 'panel' }

export function useSpiritTalk(st: SpiritTalkState | null, set: (s: SpiritTalkState | null) => void, phone: boolean) {
  const following = useSyncExternalStore(subscribeFollow, () => (st ? isFollowing(st.id) : false), () => false)
  // where she stood when the talk opened (she stands still while talked to: spiritHeld), and her species
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const live = useMemo(() => (st ? spiritLive.get(st.id) ?? null : null), [st?.id])
  const food = foodIn(useInv())   // what Feed would give (shown as the answer's tag), or null
  useEffect(() => { spiritHeld.id = st && live ? st.id : null; return () => { spiritHeld.id = null } }, [st, live])
  useEffect(() => { if (st && !live) set(null) }, [st, live, set])   // her model is gone (flag off, planter lifted): nothing to talk to
  const node: TalkNode | null = useMemo(() => {
    if (!st || st.screen !== 'talk' || !live) return null
    const id = st.id
    return {
      line: '…',   // TODO @lark: a spirit's talk line (none written; canon gives spirits no speech here)
      options: [
        { label: 'Feed', tag: food ? itemDef(food).name : undefined, pick: () => {
          const r = feed(getInv(), loadFed(), id, Date.now())
          if (!r) { hudSay(FEED_NONE_LINE, 'info', 4); set(null); return }   // nothing taken
          setInv(r.inv); saveFed(r.book); spiritCheer.add(id)
          hudSay(fedLine(SPECIES_NAMES[live.sp], itemDef(r.item).name), 'item', 4); set(null)
        } },
        following ? { label: 'Stay', pick: () => { setFollowing(id, false); set(null) } } : { label: 'Follow', pick: () => { if (!setFollowing(id, true)) hudSay(FOLLOW_FULL_LINE, 'info', 4); set(null) } },
        { label: 'Open', pick: () => set({ id, screen: 'panel' }) },
      ],
    }
  }, [st, live, following, set, food])
  const panel = st && st.screen === 'panel' && live ? <SpiritPanel sp={live.sp} phone={phone} onClose={() => set(null)} /> : null
  return {
    node, panel,
    name: live ? SPECIES_NAMES[live.sp] : '',
    head: live ? { x: live.x, y: live.y + live.h, z: live.z } : null,
  }
}

export function SpiritPanel({ sp, phone, onClose }: { sp: Parameters<typeof spiritSheet>[0]; phone: boolean; onClose: () => void }) {
  const sheet = useMemo(() => spiritSheet(sp), [sp]), look = spiritModelFor(sp)
  const ink = { label: H.inkSoft, ring: 'rgba(58,39,22,.2)', spoke: 'rgba(58,39,22,.16)' }
  return (
    <HearthFrame title={sheet.name} maxWidth={420} onClose={onClose} fixed dataPanel="spirit">
      <div data-spirit-sheet={sp} data-spirit-name={sheet.name} className="px-4 pt-7 pb-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {look && <SpiritAvatar sp={sp} look={look} size={phone ? 124 : 132} />}
          <StatRadar phone={phone} attr="spirit" ink={ink}
            axes={sheet.axes.map(a => ({ key: a.stat, label: a.label, reach: a.reach, mark: String(a.value), tint: H.ink }))} />
        </div>
        <div className="mt-3 mb-1.5 text-[13px] font-bold" style={{ color: H.inkSoft }}>Moves</div>
        {sheet.moves.length ? (
          <div data-spirit-moves style={{ display: 'grid', gap: 4 }}>
            {sheet.moves.map(m => (
              <div key={m.id} data-spirit-move={m.id} className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-2 text-[13px]"
                style={{ background: 'rgba(255,250,240,.6)', boxShadow: 'inset 0 0 0 1px rgba(58,39,22,.14)' }}>
                <span style={{ fontWeight: 700, color: H.ink }}>{m.name}</span>
                <span style={{ marginLeft: 'auto', color: H.inkFaint, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {m.power ? `${m.power}` : '·'} · Lv {m.level}</span>
              </div>
            ))}
          </div>
        ) : <div data-spirit-moves-empty className="text-[13px] italic" style={{ color: H.inkFaint }}>no moves known yet</div>}
      </div>
    </HearthFrame>
  )
}
