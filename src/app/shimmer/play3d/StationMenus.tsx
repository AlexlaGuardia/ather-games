// The walker's five placeable-station menus: Alchemy Station, Crafting Table, Chest, Exchange
// Booth, Farm Planter.
//
// Extracted from Shimmer3D.tsx (2026-07-09), where they lived as five self-contained IIFEs inside a
// 2600-line component. Nothing here owns game state: the walker keeps every ref and every mutating
// action, and hands them down. That's deliberate — these menus read live refs (inventory, mana,
// skills) rather than props, so the walker's tick counters are passed in to force the re-render.
//
// The `void xTick` reads below are that subscription. They look like dead code and are not: without
// them the tick prop is unused, and a transfer/craft/plant would mutate a ref that nothing observes.

import { canBrew, getVisiblePotions } from '../engine/alchemy'
import { potionEffectLine } from '../engine/potion-effects'
import { canCraft, getRecipes } from '../engine/crafting'
import { TOOL_DEFS, canCraft as canCraftTool, wornFraction, repairCost, canRepair, type EquippedTools } from '../engine/tools'
import { countItem, type Inventory, type ChestStorage } from '../engine/inventory'
import { getMarketPrice, GE_ITEM_IDS, TAX_RATE, type GEMarketState } from '../engine/exchange'
import { CROP_DEFS, canPlantCrop, getCropGrowthPhase, isCropReady, getVisibleCrops, type PlantedCrop } from '../engine/farming'
import type { SkillSet, SkillId } from '../engine/skills'
import type { ManaPool } from '../engine/mana'
import type { ItemStack } from '../engine/inventory'
import { prettyItem, menuBtn, TOOL_HUD, GE_BUY_CURATED, SlotGrid, StationShell } from './ui'

// src* — set only on world-view clones (see world-adapter): the logical zone/tile the
// structure is SAVED under, so identity keys survive the world-coordinate translation.
export type PlacedStruct = { itemId: string; tileX: number; tileY: number; facing: number; zoneId: string; srcZoneId?: string; srcTileX?: number; srcTileY?: number }
export type StationKind = 'brew' | 'craft' | 'chest' | 'exchange' | 'farm'

export interface StationMenusProps {
  openMenu: { kind: StationKind; struct: PlacedStruct } | null
  closeStation: () => void
  // Live game state, read at render. Refs (not props) so the walker stays the single owner.
  skillsRef: React.RefObject<SkillSet>
  invRef: React.RefObject<Inventory>
  manaRef: React.RefObject<ManaPool>
  equippedToolsRef: React.RefObject<EquippedTools>
  geRef: React.RefObject<GEMarketState>
  plantedCropsRef: React.RefObject<PlantedCrop[]>
  // Re-render subscriptions — bumped by the walker when a ref above mutates.
  toolTick: number
  chestsTick: number
  cropsTick: number
  // Wallet + trade feedback are real state, so they arrive as values.
  wallet: { marks: number }
  tradeToast: string | null
  // Mutating actions — all owned by the walker.
  brew: (potionId: string) => void
  craft: (recipeId: string) => void
  craftToolAction: (toolId: string) => void
  repairToolAction: (skillId: SkillId) => void
  getChest: (struct: PlacedStruct) => ChestStorage
  transferChestSlot: (struct: PlacedStruct, idx: number, toChest: boolean) => void
  tradeSell: (itemId: string, qty: number) => void
  tradeBuy: (itemId: string, qty: number) => void
  harvestAt: (crop: PlantedCrop) => void
  plantAt: (struct: PlacedStruct, cropId: string) => void
}

const sub = (color: string, children: React.ReactNode) => (
  <div style={{ font: '600 10px ui-monospace, monospace', color, marginBottom: 12 }}>{children}</div>
)
/** A recipe's ingredient chips — green when you have enough, red when short. */
function Reagents({ recipe, inv, okColor, okBorder }: {
  recipe: { itemId: string; count: number }[]; inv: Inventory; okColor: string; okBorder: string
}) {
  return <>
    {recipe.map(r => {
      const have = countItem(inv, r.itemId)
      const short = have < r.count
      return (
        <span key={r.itemId} style={{ font: '700 10px ui-monospace, monospace', color: short ? '#ff8a7a' : okColor, background: '#0007', border: `1px solid ${short ? '#ff5a4d55' : okBorder}`, borderRadius: 6, padding: '2px 7px' }}>
          {prettyItem(r.itemId)} {have}/{r.count}
        </span>
      )
    })}
  </>
}

export function StationMenus(p: StationMenusProps) {
  if (!p.openMenu) return null
  const { kind, struct } = p.openMenu

  // ── ALCHEMY STATION ────────────────────────────────────────────────────────────────────────
  if (kind === 'brew') {
    const alch = p.skillsRef.current.alchemy.level
    return (
      <StationShell accent="#c88ae6" border="#5a3f74" bg="#130f1c" title="⚗ ALCHEMY STATION"
        onClose={p.closeStation} subtitle={sub('#9b86b8', `Alchemy Lv ${alch}`)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {getVisiblePotions(alch).map(def => {
            const locked = alch < def.minAlchemyLevel
            const ok = !locked && canBrew(def.id, p.invRef.current, alch, p.manaRef.current)
            return (
              <div key={def.id} style={{ background: '#1c1730', border: '1px solid #ffffff14', borderRadius: 10, padding: '9px 11px', opacity: locked ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: '800 13px ui-monospace, monospace', color: '#eadcff' }}>{def.name}</span>
                  <span style={{ font: '700 10px ui-monospace, monospace', color: '#9b86b8' }}>{locked ? `Lv ${def.minAlchemyLevel}` : `${def.manaCost}◈ · +${def.xpGrant}xp`}</span>
                </div>
                {/* what drinking it DOES — the whole point of brewing it */}
                {potionEffectLine(def.id) && (
                  <div style={{ font: '600 10px ui-monospace, monospace', color: '#8fd9c4', marginTop: 3 }}>{potionEffectLine(def.id)}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <Reagents recipe={def.recipe} inv={p.invRef.current} okColor="#9fd9c4" okBorder="#2f5c4f" />
                  <span style={{ flex: 1 }} />
                  <button onClick={() => p.brew(def.id)} disabled={!ok} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: ok ? '#7a4fc0' : '#2a2540', color: ok ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ok ? 'pointer' : 'default', touchAction: 'none' }}>Brew{def.resultCount > 1 ? ` ×${def.resultCount}` : ''}</button>
                </div>
              </div>
            )
          })}
        </div>
      </StationShell>
    )
  }

  // ── CRAFTING TABLE ─── skill-less: gated by materials + mana only ──────────────────────────
  if (kind === 'craft') {
    void p.toolTick // re-render after a craft/break changes the equipped set
    const craftableTools = (['forestry', 'prospecting', 'rinning'] as const).flatMap(skill =>
      Object.values(TOOL_DEFS).filter(t => t.skillId === skill && !t.basic).sort((a, b) => a.tier - b.tier))
    return (
      <StationShell accent="#e0b64e" border="#6b5220" bg="#171205" title="🔨 CRAFTING TABLE"
        onClose={p.closeStation} subtitle={sub('#b09660', 'Build stations from gathered materials')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {getRecipes().map(def => {
            const ok = canCraft(def.id, p.invRef.current, p.manaRef.current)
            return (
              <div key={def.id} style={{ background: '#241b09', border: '1px solid #ffffff14', borderRadius: 10, padding: '9px 11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: '800 13px ui-monospace, monospace', color: '#f0e2c4' }}>{def.name}</span>
                  <span style={{ font: '700 10px ui-monospace, monospace', color: '#b09660' }}>{def.manaCost}◈</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <Reagents recipe={def.recipe} inv={p.invRef.current} okColor="#d9c78a" okBorder="#5c4f2f" />
                  <span style={{ flex: 1 }} />
                  <button onClick={() => p.craft(def.id)} disabled={!ok} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: ok ? '#b0862a' : '#3a3018', color: ok ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ok ? 'pointer' : 'default', touchAction: 'none' }}>Craft{def.resultCount > 1 ? ` ×${def.resultCount}` : ''}</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* TOOLS — the tiered blades / spikes / rinsticks. Better than Greg's free basics (faster +
            more XP + no under-tooled mana penalty at their tier) but they wear out and break,
            dropping you back to the basic. Crafting one equips it for its skill. */}
        <div style={{ font: '800 11px ui-monospace, monospace', color: '#e0b64e', margin: '18px 0 4px', letterSpacing: '0.08em' }}>⚒ TOOLS</div>
        <div style={{ font: '600 10px ui-monospace, monospace', color: '#b09660', marginBottom: 10 }}>Sharper than Greg&apos;s basics — but they wear out</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {craftableTools.map(def => {
            const ok = canCraftTool(def.id, p.invRef.current)
            const eq = p.equippedToolsRef.current[def.skillId]
            const equipped = eq?.toolId === def.id
            return (
              <div key={def.id} style={{ background: equipped ? '#1c2417' : '#241b09', border: `1px solid ${equipped ? '#7fe3c855' : '#ffffff14'}`, borderRadius: 10, padding: '9px 11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: '800 13px ui-monospace, monospace', color: '#f0e2c4' }}>
                    <span style={{ marginRight: 5 }}>{TOOL_HUD[def.skillId]?.glyph}</span>{def.name}
                    <span style={{ marginLeft: 6, font: '700 9px ui-monospace, monospace', color: '#0d1a17', background: TOOL_HUD[def.skillId]?.tint, borderRadius: 5, padding: '1px 5px' }}>T{def.tier}</span>
                  </span>
                  <span style={{ font: '700 10px ui-monospace, monospace', color: '#8fd9c4', whiteSpace: 'nowrap' }}>
                    +{Math.round((def.xpBonus - 1) * 100)}% XP · {def.durability} uses
                  </span>
                </div>
                {equipped && eq ? (() => {
                  // EQUIPPED → maintenance: show wear + repair (a wear-scaled slice of the recipe)
                  const frac = Math.max(0, eq.usesRemaining / def.durability)
                  const worn = wornFraction(eq)
                  const rep = repairCost(eq)
                  const repOk = canRepair(eq, p.invRef.current)
                  const barCol = frac > 0.5 ? 'linear-gradient(90deg,#6fd08f,#a7e07f)' : frac > 0.25 ? 'linear-gradient(90deg,#e0c060,#e0a860)' : 'linear-gradient(90deg,#e0806a,#e05a4d)'
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 7, background: '#0009', borderRadius: 4, border: '1px solid #0007', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${frac * 100}%`, background: barCol, transition: 'width .2s' }} />
                        </div>
                        <span style={{ font: '700 10px ui-monospace, monospace', color: '#cdbd8e', whiteSpace: 'nowrap' }}>{eq.usesRemaining}/{def.durability} uses</span>
                      </div>
                      {worn >= 0.25 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                          <span style={{ font: '700 9px ui-monospace, monospace', color: '#b09660' }}>repair:</span>
                          <Reagents recipe={rep} inv={p.invRef.current} okColor="#d9c78a" okBorder="#5c4f2f" />
                          <span style={{ flex: 1 }} />
                          <button onClick={() => p.repairToolAction(def.skillId)} disabled={!repOk} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: repOk ? '#3a7a52' : '#243a2f', color: repOk ? '#eafff4' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: repOk ? 'pointer' : 'default', touchAction: 'none' }}>Repair</button>
                        </div>
                      ) : (
                        <div style={{ font: '700 10px ui-monospace, monospace', color: '#7fe3c8', marginTop: 7, textAlign: 'right' }}>✓ equipped · good condition</div>
                      )}
                    </div>
                  )
                })() : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <Reagents recipe={def.recipe} inv={p.invRef.current} okColor="#d9c78a" okBorder="#5c4f2f" />
                    <span style={{ flex: 1 }} />
                    <button onClick={() => p.craftToolAction(def.id)} disabled={!ok} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: ok ? '#b0862a' : '#3a3018', color: ok ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ok ? 'pointer' : 'default', touchAction: 'none' }}>Craft</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ font: '600 9px ui-monospace, monospace', color: '#7d6a3e', marginTop: 12, textAlign: 'center' }}>Crafted stations go to your hotbar — double-tap to place them.</div>
      </StationShell>
    )
  }

  // ── CHEST ─── tap a slot to move that stack (chest ⇄ satchel); no drag needed ───────────────
  if (kind === 'chest') {
    void p.chestsTick // subscribe: re-render this menu after a transfer bumps the tick
    const chest = p.getChest(struct)
    return (
      <StationShell accent="#c9a86a" border="#6b5220" bg="#171205" title="📦 CHEST"
        onClose={p.closeStation} subtitle={sub('#b09660', 'Tap an item to move it — chest ⇄ satchel')}>
        <div style={{ font: '800 11px ui-monospace, monospace', color: '#d9c78a', marginBottom: 6 }}>CHEST ({chest.slots.filter(Boolean).length}/{chest.slots.length})</div>
        <SlotGrid slots={chest.slots} onTap={(i) => p.transferChestSlot(struct, i, false)} accent="#c9a86a" />
        <div style={{ font: '800 11px ui-monospace, monospace', color: '#d9c78a', margin: '14px 0 6px' }}>SATCHEL</div>
        <SlotGrid slots={p.invRef.current.slots} onTap={(i) => p.transferChestSlot(struct, i, true)} accent="#7fd0e6" />
      </StationShell>
    )
  }

  // ── EXCHANGE BOOTH ─── instant buy/sell vs the single shared market ─────────────────────────
  // Sell = whatever's tradeable in your satchel; Buy = the early-game staple shortlist.
  if (kind === 'exchange') {
    const sellIds = Array.from(new Set(p.invRef.current.slots.filter((s): s is ItemStack => !!s).map(s => s.itemId))).filter(id => GE_ITEM_IDS.includes(id))
    const buyIds = GE_BUY_CURATED.filter(id => GE_ITEM_IDS.includes(id))
    return (
      <StationShell accent="#6ad0a0" border="#2f5c4f" bg="#0b1613" title="💰 EXCHANGE BOOTH" onClose={p.closeStation}
        subtitle={<>
          <div style={{ font: '600 10px ui-monospace, monospace', color: '#8fc4ae', marginBottom: 8 }}>✦ {p.wallet.marks} marks · {Math.round(TAX_RATE * 100)}% tax on sales</div>
          {p.tradeToast && <div style={{ font: '700 11px ui-monospace, monospace', color: '#ffe08a', marginBottom: 8 }}>{p.tradeToast}</div>}
        </>}>
        <div style={{ font: '800 11px ui-monospace, monospace', color: '#8fd9c4', marginBottom: 6 }}>SELL</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {sellIds.length === 0 && <span style={{ font: '600 11px ui-monospace, monospace', color: '#5a7a6e' }}>Nothing tradeable in your satchel.</span>}
          {sellIds.map(id => {
            const have = countItem(p.invRef.current, id)
            const price = getMarketPrice(p.geRef.current, id)
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#12201d', border: '1px solid #ffffff14', borderRadius: 9, padding: '7px 10px' }}>
                <span style={{ flex: 1, font: '700 12px ui-monospace, monospace', color: '#eafff6' }}>{prettyItem(id)}</span>
                <span style={{ font: '700 10px ui-monospace, monospace', color: '#8fd9c4' }}>{price}◆ ×{have}</span>
                <button onClick={() => p.tradeSell(id, 1)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#2f8f5f', color: '#fff', font: '800 11px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}>Sell 1</button>
                {have > 1 && <button onClick={() => p.tradeSell(id, have)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#1c5c3f', color: '#fff', font: '800 11px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}>All</button>}
              </div>
            )
          })}
        </div>
        <div style={{ font: '800 11px ui-monospace, monospace', color: '#8fd9c4', marginBottom: 6 }}>BUY</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {buyIds.map(id => {
            const price = getMarketPrice(p.geRef.current, id)
            const afford = p.wallet.marks >= price
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#12201d', border: '1px solid #ffffff14', borderRadius: 9, padding: '7px 10px' }}>
                <span style={{ flex: 1, font: '700 12px ui-monospace, monospace', color: '#eafff6' }}>{prettyItem(id)}</span>
                <span style={{ font: '700 10px ui-monospace, monospace', color: '#8fd9c4' }}>{price}◆</span>
                <button onClick={() => p.tradeBuy(id, 1)} disabled={!afford} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: afford ? '#2f8f5f' : '#1a2a24', color: afford ? '#fff' : '#ffffff55', font: '800 11px ui-monospace, monospace', cursor: afford ? 'pointer' : 'default', touchAction: 'none' }}>Buy 1</button>
              </div>
            )
          })}
        </div>
      </StationShell>
    )
  }

  // ── FARM PLANTER ─── plant a seed → watch it grow (real time) → harvest when ready ──────────
  // ONE crop per planter, keyed by tile+zone (matches the 2D game's farming save shape).
  void p.cropsTick // subscribe: re-render on plant/harvest
  const crop = p.plantedCropsRef.current.find(c => c.tileX === struct.tileX && c.tileY === struct.tileY && c.zoneId === struct.zoneId) ?? null
  const farmLvl = p.skillsRef.current.farming.level
  return (
    <StationShell accent="#8fd06a" border="#4a6b2f" bg="#0f1608" title="🌱 PLANTER"
      onClose={p.closeStation} subtitle={sub('#94b073', `Farming Lv ${farmLvl}`)}>
      {crop ? (() => {
        const def = CROP_DEFS[crop.cropId]
        const ready = isCropReady(crop)
        const phaseLabel = ['seed', 'sprout', 'growth', 'ready'][getCropGrowthPhase(crop)]
        const pct = Math.min(100, Math.round(((Date.now() - crop.plantedAt) / crop.growthDuration) * 100))
        return (
          <div style={{ background: '#182410', border: '1px solid #ffffff14', borderRadius: 10, padding: 12 }}>
            <div style={{ font: '800 13px ui-monospace, monospace', color: '#eafff6', marginBottom: 6 }}>{def.name}</div>
            <div style={{ font: '700 11px ui-monospace, monospace', color: ready ? '#8fd06a' : '#c9d6bd', marginBottom: 8 }}>{ready ? 'Ready to harvest!' : `Growing — ${phaseLabel}`}</div>
            <div style={{ height: 6, background: '#0008', borderRadius: 4, overflow: 'hidden', border: '1px solid #0006' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#4a6b2f,#8fd06a)' }} />
            </div>
            <button onClick={() => p.harvestAt(crop)} disabled={!ready} style={{ marginTop: 12, width: '100%', padding: '9px 0', borderRadius: 9, border: 'none', background: ready ? '#4a8f3f' : '#25301c', color: ready ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ready ? 'pointer' : 'default', touchAction: 'none' }}>Harvest</button>
          </div>
        )
      })() : (() => {
        const plantable = getVisibleCrops(farmLvl).filter(def => countItem(p.invRef.current, def.seedItemId) > 0)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {plantable.length === 0 && <span style={{ font: '600 11px ui-monospace, monospace', color: '#5a7a4a' }}>No plantable seeds in your satchel.</span>}
            {plantable.map(def => {
              const ok = canPlantCrop(def.id, p.invRef.current, farmLvl, p.manaRef.current)
              const have = countItem(p.invRef.current, def.seedItemId)
              return (
                <div key={def.id} style={{ background: '#182410', border: '1px solid #ffffff14', borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: '800 13px ui-monospace, monospace', color: '#eafff6' }}>{def.name}</span>
                    <span style={{ font: '700 10px ui-monospace, monospace', color: '#94b073' }}>{def.manaCost}◈ · seed ×{have}</span>
                  </div>
                  <button onClick={() => p.plantAt(struct, def.id)} disabled={!ok} style={{ marginTop: 8, width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', background: ok ? '#4a8f3f' : '#25301c', color: ok ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ok ? 'pointer' : 'default', touchAction: 'none' }}>Plant</button>
                </div>
              )
            })}
          </div>
        )
      })()}
    </StationShell>
  )
}
