'use client'

// THE SKILLS tab (BETA M64, Alex 11-22 playtest: "i dont have a way to view them"). Every open-world skill, its level and
// how far to the next one, read straight off the one open-world skill set (ather/forestry.ts › openSkills). READ-ONLY:
// nothing here writes the save; it re-renders when XP lands (subscribeForestry). Names are the code's own (SKILL_META).

import { useSyncExternalStore } from 'react'
import { H, hearthDisplay } from '../ui/hearth'
import { SKILL_IDS, SKILL_META, xpForSkillLevel } from '../engine/skills'
import { openSkills, subscribeForestry, forestryRev } from './ather/forestry'

export function SkillsBody() {
  useSyncExternalStore(subscribeForestry, forestryRev, () => 0)
  const skills = openSkills()
  return (
    <div className="flex flex-col gap-2.5 px-4 py-1" data-skills>
      {SKILL_IDS.map(id => {
        const sk = skills[id], need = Math.max(1, xpForSkillLevel(sk.level))
        const pct = Math.min(1, Math.max(0, sk.xp / need))
        return (
          <div key={id} data-skill={id} data-level={sk.level} data-xp={sk.xp} data-need={need}>
            <div className="flex items-baseline gap-2">
              <span className="text-[16px] font-bold" style={{ ...hearthDisplay, color: H.ink }}>{SKILL_META[id].name}</span>
              <span className="ml-auto text-[14px] font-bold tabular-nums" style={{ ...hearthDisplay, color: H.emberLo }}>Lv {sk.level}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full" style={{ background: H.paperLo, boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
              <div className="h-full rounded-full" style={{ width: `${(pct * 100).toFixed(1)}%`, background: H.ember }} />
            </div>
            <div className="mt-0.5 text-[12px] tabular-nums" style={{ color: H.inkSoft }}>{sk.xp.toLocaleString()} / {need.toLocaleString()} xp</div>
          </div>
        )
      })}
    </div>
  )
}
