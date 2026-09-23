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
//
// ★ THE CARVED HEARTH (2026-09-23). These five were the last dark station panels in the game — the
// Ather's crafter, stations, brewing and alchemy moved in Phases 1-8. They wear the SAME kit now:
// a HearthFrame (wood, parchment, a plaque, the close knob), recipes as HearthRows with CostChips
// (moss when covered, rust when short), HearthButtons (ember = the act), HearthProgress grooves. The
// logic is untouched — every ref read, tick subscription, gate and action is exactly as it was.
// ⚠ The shell lives HERE, not in `ui.tsx`: `farming.test.ts` imports `ui.tsx`, and the hearth kit
// pulls `next/font`, which cannot load under node.

import { canBrew, getVisiblePotions } from '../engine/alchemy'
import { potionEffectLine } from '../engine/potion-effects'
import { canCraft, getRecipes } from '../engine/crafting'
import { TOOL_DEFS, canCraft as canCraftTool, wornFraction, repairCost, canRepair, type EquippedTools } from '../engine/tools'
import { countItem, type Inventory, type ChestStorage } from '../engine/inventory'
import { bankUsed, bankCount, CHEST_CAPACITY, type BankState } from '../engine/bank'
import { ITEMS } from '../sprites/items'
import { getMarketPrice, GE_ITEM_IDS, TAX_RATE, type GEMarketState } from '../engine/exchange'
import { CROP_DEFS, canPlantCrop, getCropGrowthPhase, isCropReady, getVisibleCrops, type PlantedCrop } from '../engine/farming'
import type { SkillSet, SkillId } from '../engine/skills'
import type { ManaPool } from '../engine/mana'
import type { ItemStack } from '../engine/inventory'
import { prettyItem, TOOL_HUD, GE_BUY_CURATED } from './ui'
import {
  hearthBody, hearthDisplay, HearthFrame, HearthButton, HearthRow, CostChip, HearthProgress, HearthDivider, HearthLabel, HearthNote, Well,
} from '../ui/hearth'
import { ItemChip } from '../hud/satchel'

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
  // ── Garden Bank — the pooled material store (replaces per-chest storage). The chest panel is now
  // this bank's deposit/withdraw view; craftability checks count satchel+bank together.
  bankRef: React.RefObject<BankState>
  bankTick: number                 // bump to re-render after a deposit/withdraw
  bankCapacityNow: () => number
  bankDepositSlot: (slotIdx: number) => void      // deposit one satchel stack
  bankDepositAllMaterials: () => void             // the anti-Tetris button: dump every material at once
  bankWithdrawItem: (itemId: string, qty: number) => void
  getChest: (struct: PlacedStruct) => ChestStorage
  transferChestSlot: (struct: PlacedStruct, idx: number, toChest: boolean) => void
  tradeSell: (itemId: string, qty: number) => void
  tradeBuy: (itemId: string, qty: number) => void
  harvestAt: (crop: PlantedCrop) => void
  plantAt: (struct: PlacedStruct, cropId: string) => void
}

/** The shared station shell: a centred HearthFrame over a soft scrim, the body padded under the plaque. */
function Station({ title, note, onClose, children }: { title: string; note?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 47, touchAction: 'none' }}>
      <HearthFrame title={title} maxWidth={460} fixed onClose={onClose} dataPanel="station">
        <div className="px-4 pt-7 pb-4">
          {note && <div className="mb-3 -mt-1 text-center"><HearthNote>{note}</HearthNote></div>}
          {children}
        </div>
      </HearthFrame>
    </div>
  )
}

/** A recipe's ingredient chips — moss when covered, rust when short. `have` counts the satchel AND the
 *  bank, so the chips agree with the (bank-aware) craft button instead of disagreeing with it. */
function Reagents({ recipe, inv, bank }: { recipe: { itemId: string; count: number }[]; inv: Inventory; bank: BankState }) {
  return <>
    {recipe.map(r => (
      <CostChip key={r.itemId} itemId={r.itemId} label={prettyItem(r.itemId)}
                have={countItem(inv, r.itemId) + bankCount(bank, r.itemId)} need={r.count} />
    ))}
  </>
}

/** The satchel as carved wells — tap a stack to act on it. Empty wells stay, disabled, so the grid never jumps. */
function SatchelWells({ slots, onTap, cols = 5 }: { slots: (ItemStack | null)[]; onTap: (idx: number) => void; cols?: number }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {slots.map((s, i) => (
        <button key={i} onClick={() => s && onTap(i)} disabled={!s} title={s ? prettyItem(s.itemId) : undefined}
                className="hearth-slot relative aspect-square grid place-items-center" style={{ touchAction: 'none', cursor: s ? 'pointer' : 'default' }}>
          {s && <ItemChip itemId={s.itemId} size={28} />}
          {s && s.count > 1 && <span className="absolute right-1 bottom-0.5 text-[11px] font-extrabold tabular-nums hk-ink">{s.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function StationMenus(p: StationMenusProps) {
  if (!p.openMenu) return null
  const { kind, struct } = p.openMenu

  // ── ALCHEMY STATION ────────────────────────────────────────────────────────────────────────
  if (kind === 'brew') {
    const alch = p.skillsRef.current.alchemy.level
    return (
      <Station title="Alchemy station" onClose={p.closeStation} note={`alchemy ${alch}`}>
        <div className="flex flex-col gap-2">
          {getVisiblePotions(alch).map(def => {
            const locked = alch < def.minAlchemyLevel
            const ok = !locked && canBrew(def.id, p.invRef.current, alch, p.manaRef.current, p.bankRef.current)
            return (
              <HearthRow key={def.id} itemId={def.id} name={def.name} locked={locked}
                meta={locked ? `alchemy ${def.minAlchemyLevel}` : `${def.manaCost}◈ · +${def.xpGrant}xp`}
                road={potionEffectLine(def.id) ? <span className="hk-moss">{potionEffectLine(def.id)}</span> : undefined}
                inputs={<Reagents recipe={def.recipe} inv={p.invRef.current} bank={p.bankRef.current} />}>
                {!locked && <HearthButton primary={ok} disabled={!ok} small onClick={() => p.brew(def.id)}>Brew{def.resultCount > 1 ? ` ×${def.resultCount}` : ''}</HearthButton>}
              </HearthRow>
            )
          })}
        </div>
      </Station>
    )
  }

  // ── CRAFTING TABLE ─── skill-less: gated by materials + mana only ──────────────────────────
  if (kind === 'craft') {
    void p.toolTick // re-render after a craft/break changes the equipped set
    const craftableTools = (['forestry', 'prospecting', 'rinning'] as const).flatMap(skill =>
      Object.values(TOOL_DEFS).filter(t => t.skillId === skill && !t.basic).sort((a, b) => a.tier - b.tier))
    return (
      <Station title="Crafting table" onClose={p.closeStation} note="build stations from gathered materials">
        <div className="flex flex-col gap-2">
          {getRecipes().map(def => {
            const ok = canCraft(def.id, p.invRef.current, p.manaRef.current, p.bankRef.current)
            return (
              <HearthRow key={def.id} itemId={def.id /* a crafting recipe's id IS the item it makes */} name={def.name} meta={`${def.manaCost}◈`}
                inputs={<Reagents recipe={def.recipe} inv={p.invRef.current} bank={p.bankRef.current} />}>
                <HearthButton primary={ok} disabled={!ok} small onClick={() => p.craft(def.id)}>Craft{def.resultCount > 1 ? ` ×${def.resultCount}` : ''}</HearthButton>
              </HearthRow>
            )
          })}
        </div>

        {/* TOOLS — the tiered blades / spikes / rinsticks. Better than Greg's free basics (faster +
            more XP + no under-tooled mana penalty at their tier) but they wear out and break,
            dropping you back to the basic. Crafting one equips it for its skill. */}
        <div className="mt-5"><HearthDivider>tools</HearthDivider></div>
        <div className="mt-1 mb-3 text-center"><HearthNote>sharper than Greg&apos;s basics — but they wear out</HearthNote></div>
        <div className="flex flex-col gap-2">
          {craftableTools.map(def => {
            const ok = canCraftTool(def.id, p.invRef.current, p.bankRef.current)
            const eq = p.equippedToolsRef.current[def.skillId]
            const equipped = eq?.toolId === def.id
            return (
              <HearthRow key={def.id} itemId={def.id}
                name={<>{def.name} <span className="ml-1 text-[11px] font-extrabold align-middle px-1.5 rounded-full hk-fill hk-soft" style={hearthBody}>T{def.tier}</span></>}
                meta={<span className="hk-moss">+{Math.round((def.xpBonus - 1) * 100)}% XP · {def.durability} uses</span>}
                inputs={equipped ? undefined : <Reagents recipe={def.recipe} inv={p.invRef.current} bank={p.bankRef.current} />}>
                {equipped && eq ? (() => {
                  // EQUIPPED → maintenance: show wear + repair (a wear-scaled slice of the recipe)
                  const frac = Math.max(0, eq.usesRemaining / def.durability)
                  const worn = wornFraction(eq)
                  const rep = repairCost(eq)
                  const repOk = canRepair(eq, p.invRef.current, p.bankRef.current)
                  return (
                    <div className="w-full">
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><HearthProgress value={frac} /></div>
                        <span className={`text-[12px] font-bold tabular-nums whitespace-nowrap ${frac > 0.5 ? 'hk-soft' : frac > 0.25 ? 'hk-ember' : 'hk-rust'}`}>{eq.usesRemaining}/{def.durability} uses</span>
                      </div>
                      {worn >= 0.25 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[12px] italic hk-faint">repair:</span>
                          <Reagents recipe={rep} inv={p.invRef.current} bank={p.bankRef.current} />
                          <span className="flex-1" />
                          <HearthButton primary={repOk} disabled={!repOk} small onClick={() => p.repairToolAction(def.skillId)}>Repair</HearthButton>
                        </div>
                      ) : (
                        <div className="mt-1.5 text-right text-[12px] font-bold hk-moss">✓ equipped · good condition</div>
                      )}
                    </div>
                  )
                })() : (
                  <HearthButton primary={ok} disabled={!ok} small onClick={() => p.craftToolAction(def.id)}>Craft</HearthButton>
                )}
              </HearthRow>
            )
          })}
        </div>
        <div className="mt-4 text-center text-[12px] italic hk-faint">Crafted stations go to your hotbar — double-tap to place them.</div>
      </Station>
    )
  }

  // ── GARDEN BANK ─── every chest opens the SAME pooled store (engine/bank.ts). Deposit gathered
  // materials once, and every station on your land crafts straight from the pool — no ferrying.
  if (kind === 'chest') {
    void p.bankTick // subscribe: re-render after a deposit/withdraw
    const bank = p.bankRef.current
    const cap = p.bankCapacityNow()
    const used = bankUsed(bank)
    const frac = cap > 0 ? Math.min(1, used / cap) : 0
    const over = used > cap    // a migrated hoard can start above cap — show it honestly, block deposits
    // Banked contents, richest first. Only resources are bankable, so this is always craft materials.
    const banked = Object.entries(bank.items).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
    // Which satchel stacks are depositable (resources only — tools/potions/seeds/furniture stay in hand).
    const RESOURCE = new Set(ITEMS.filter(i => i.type === 'resource').map(i => i.id))
    const hasDepositable = p.invRef.current.slots.some(s => s && RESOURCE.has(s.itemId))
    return (
      <Station title="Garden bank" onClose={p.closeStation} note="shared across every chest on your land · stations craft straight from here">
        {/* capacity meter */}
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="hk-label text-[14px] hk-ink">Materials</span>
          <span className={`text-[13px] font-extrabold tabular-nums ${over ? 'hk-rust' : frac > 0.9 ? 'hk-ember' : 'hk-ink'}`}>
            {used.toLocaleString()} / {cap.toLocaleString()}
          </span>
        </div>
        <HearthProgress value={frac} />
        <div className={`mt-1.5 text-[12px] leading-snug ${over ? 'hk-rust' : 'hk-faint'}`}>
          {over
            ? 'Over capacity from your old chests — nothing lost. Craft it down or place another chest to raise the cap.'
            : `Each placed chest raises the cap (wooden +${CHEST_CAPACITY.chest}, iron +${CHEST_CAPACITY.iron_chest}, ornate +${CHEST_CAPACITY.ornate_chest}).`}
        </div>

        {/* one-tap deposit — the anti-Tetris payoff */}
        <div className="mt-3 flex justify-center">
          <HearthButton primary={hasDepositable && !over} disabled={!hasDepositable || over} onClick={p.bankDepositAllMaterials}>⤓ Deposit all materials</HearthButton>
        </div>

        {/* banked contents */}
        <div className="mt-4"><HearthLabel>Banked</HearthLabel></div>
        {banked.length === 0 && <div className="text-[13px] italic hk-faint">Empty — deposit materials to start the pool.</div>}
        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto hearth-scroll">
          {banked.map(([id, n]) => (
            <div key={id} className="hk-plate flex items-center gap-2.5 px-2.5 py-1.5">
              <Well itemId={id} size={32} />
              <span className="flex-1 text-[13px] font-semibold hk-ink">{prettyItem(id)}</span>
              <span className="text-[13px] font-extrabold tabular-nums hk-soft">{n.toLocaleString()}</span>
              <HearthButton small onClick={() => p.bankWithdrawItem(id, 1)}>−1</HearthButton>
              {n > 1 && <HearthButton small onClick={() => p.bankWithdrawItem(id, n)}>All</HearthButton>}
            </div>
          ))}
        </div>

        {/* satchel — tap a material stack to deposit it */}
        <div className="mt-4"><HearthLabel>Satchel <span className="font-medium italic hk-faint">· tap a material to deposit</span></HearthLabel></div>
        <SatchelWells slots={p.invRef.current.slots} onTap={(i) => p.bankDepositSlot(i)} />
      </Station>
    )
  }

  // ── EXCHANGE BOOTH ─── instant buy/sell vs the single shared market ─────────────────────────
  // Sell = whatever's tradeable in your satchel; Buy = the early-game staple shortlist.
  if (kind === 'exchange') {
    const sellIds = Array.from(new Set(p.invRef.current.slots.filter((s): s is ItemStack => !!s).map(s => s.itemId))).filter(id => GE_ITEM_IDS.includes(id))
    const buyIds = GE_BUY_CURATED.filter(id => GE_ITEM_IDS.includes(id))
    return (
      <Station title="Exchange booth" onClose={p.closeStation}
        note={<>✦ {p.wallet.marks} marks · {Math.round(TAX_RATE * 100)}% tax on sales</>}>
        {p.tradeToast && <div className="mb-3 text-center text-[13px] font-bold hk-ember">{p.tradeToast}</div>}
        <HearthLabel>Sell</HearthLabel>
        <div className="flex flex-col gap-1.5 mb-4">
          {sellIds.length === 0 && <span className="text-[13px] italic hk-faint">Nothing tradeable in your satchel.</span>}
          {sellIds.map(id => {
            const have = countItem(p.invRef.current, id)
            const price = getMarketPrice(p.geRef.current, id)
            return (
              <div key={id} className="hk-plate flex items-center gap-2.5 px-2.5 py-1.5">
                <Well itemId={id} size={32} />
                <span className="flex-1 text-[13px] font-semibold hk-ink">{prettyItem(id)}</span>
                <span className="text-[12px] font-bold tabular-nums hk-soft">{price}◆ ×{have}</span>
                <HearthButton primary small onClick={() => p.tradeSell(id, 1)}>Sell 1</HearthButton>
                {have > 1 && <HearthButton small onClick={() => p.tradeSell(id, have)}>All</HearthButton>}
              </div>
            )
          })}
        </div>
        <HearthLabel>Buy</HearthLabel>
        <div className="flex flex-col gap-1.5">
          {buyIds.map(id => {
            const price = getMarketPrice(p.geRef.current, id)
            const afford = p.wallet.marks >= price
            return (
              <div key={id} className="hk-plate flex items-center gap-2.5 px-2.5 py-1.5">
                <Well itemId={id} size={32} dim={!afford} />
                <span className={`flex-1 text-[13px] font-semibold ${afford ? 'hk-ink' : 'hk-faint'}`}>{prettyItem(id)}</span>
                <span className={`text-[12px] font-bold tabular-nums ${afford ? 'hk-soft' : 'hk-rust'}`}>{price}◆</span>
                <HearthButton primary={afford} disabled={!afford} small onClick={() => p.tradeBuy(id, 1)}>Buy 1</HearthButton>
              </div>
            )
          })}
        </div>
      </Station>
    )
  }

  // ── FARM PLANTER ─── plant a seed → watch it grow (real time) → harvest when ready ──────────
  // ONE crop per planter, keyed by tile+zone (matches the 2D game's farming save shape).
  void p.cropsTick // subscribe: re-render on plant/harvest
  const crop = p.plantedCropsRef.current.find(c => c.tileX === struct.tileX && c.tileY === struct.tileY && c.zoneId === struct.zoneId) ?? null
  const farmLvl = p.skillsRef.current.farming.level
  return (
    <Station title="Planter" onClose={p.closeStation} note={`farming ${farmLvl}`}>
      {crop ? (() => {
        const def = CROP_DEFS[crop.cropId]
        const ready = isCropReady(crop)
        const phaseLabel = ['seed', 'sprout', 'growth', 'ready'][getCropGrowthPhase(crop)]
        const pct = Math.min(100, Math.round(((Date.now() - crop.plantedAt) / crop.growthDuration) * 100))
        return (
          <div className="hk-plate px-3.5 py-3">
            <div className="text-[17px] font-semibold hk-ink" style={hearthDisplay}>{def.name}</div>
            <div className={`mt-0.5 mb-2 text-[13px] font-bold ${ready ? 'hk-moss' : 'hk-soft'}`}>{ready ? 'Ready to harvest!' : `Growing — ${phaseLabel}`}</div>
            <HearthProgress value={pct / 100} />
            <div className="mt-3 flex justify-center">
              <HearthButton primary={ready} disabled={!ready} onClick={() => p.harvestAt(crop)}>Harvest</HearthButton>
            </div>
          </div>
        )
      })() : (() => {
        const plantable = getVisibleCrops(farmLvl).filter(def => countItem(p.invRef.current, def.seedItemId) > 0)
        return (
          <div className="flex flex-col gap-2">
            {plantable.length === 0 && <span className="text-[13px] italic hk-faint">No plantable seeds in your satchel.</span>}
            {plantable.map(def => {
              const ok = canPlantCrop(def.id, p.invRef.current, farmLvl, p.manaRef.current)
              const have = countItem(p.invRef.current, def.seedItemId)
              return (
                <HearthRow key={def.id} itemId={def.seedItemId} name={def.name} meta={`${def.manaCost}◈ · seed ×${have}`}>
                  <HearthButton primary={ok} disabled={!ok} small onClick={() => p.plantAt(struct, def.id)}>Plant</HearthButton>
                </HearthRow>
              )
            })}
          </div>
        )
      })()}
    </Station>
  )
}
