// World Items — dropped items with simple physics
// Items pop up when spawned, arc through the air, bounce on ground, then settle.
// Dropped items use ground-plane scatter (no gravity) for top-down consistency.
// Player auto-collects within magnet radius.

export interface WorldItem {
  id: string
  itemId: string
  count: number
  x: number          // pixel position (world space)
  y: number
  vx: number         // velocity (pixels per tick at 15 TPS)
  vy: number
  groundY: number    // the Y position to bounce off (spawn Y)
  life: number       // ticks alive
  settled: boolean   // stopped moving
  bobPhase: number   // for idle bob animation
  pickupDelay: number // ticks before player can collect (0 = immediate)
  slide: boolean     // ground-plane scatter (no gravity, friction on both axes)
  isStatic?: boolean // static pickup — never despawns, rendered as bag
}

const GRAVITY = 0.35       // px/tick² — gentle pull
const BOUNCE = 0.4         // velocity retained on bounce (lower = squishier)
const FRICTION = 0.85      // horizontal decel per tick
const SETTLE_VEL = 0.3     // below this total velocity, snap to ground
const MAGNET_RADIUS = 40   // pixels — auto-collect distance (~2.5 tiles)
const DESPAWN_TICKS = 450  // 30 seconds at 15 TPS
const BOB_SPEED = 0.08     // idle bob frequency
const BOB_AMP = 1.5        // idle bob amplitude in pixels

let nextId = 0

/** Spawn items popping out of a position (like harvesting a node) */
export function spawnWorldItems(
  items: WorldItem[],
  itemIds: string[],
  originX: number,
  originY: number,
): void {
  for (const itemId of itemIds) {
    items.push({
      id: `wi_${nextId++}`,
      itemId,
      count: 1,
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 3,
      vy: -3 - Math.random() * 2, // pop upward
      groundY: originY,
      life: 0,
      settled: false,
      bobPhase: Math.random() * Math.PI * 2,
      pickupDelay: 0,
      slide: false,
    })
  }
}

/** Drop a specific item — scatters on ground plane (top-down, no arc) */
export function dropWorldItem(
  items: WorldItem[],
  itemId: string,
  count: number,
  originX: number,
  originY: number,
): void {
  // Random angle for ground-plane scatter
  const angle = Math.random() * Math.PI * 2
  const speed = 1.5 + Math.random() * 1.0 // 1.5-2.5 px/tick → ~21-36px with 0.93 friction
  items.push({
    id: `wi_${nextId++}`,
    itemId,
    count,
    x: originX,
    y: originY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    groundY: originY,
    life: 0,
    settled: false,
    bobPhase: Math.random() * Math.PI * 2,
    pickupDelay: 30,
    slide: true, // ground-plane physics — no gravity, no bounce
  })
}

/** Tick physics for all world items. Returns IDs of items to remove (despawned). */
export function tickWorldItems(items: WorldItem[]): string[] {
  const expired: string[] = []

  for (const item of items) {
    item.life++

    // Static pickups never despawn
    if (!item.isStatic && item.life > DESPAWN_TICKS) {
      expired.push(item.id)
      continue
    }

    if (item.pickupDelay > 0) item.pickupDelay--

    if (item.settled) {
      // Gentle idle bob (skip for static pickups — they sit flat)
      if (!item.isStatic) item.bobPhase += BOB_SPEED
      continue
    }

    if (item.slide) {
      // Ground-plane scatter — lighter friction so items travel well past magnet radius
      item.x += item.vx
      item.y += item.vy
      item.vx *= 0.93
      item.vy *= 0.93
      const totalVel = Math.abs(item.vx) + Math.abs(item.vy)
      if (totalVel < SETTLE_VEL) {
        item.vx = 0
        item.vy = 0
        item.settled = true
      }
    } else {
      // Arc physics — gravity + bounce (harvest drops)
      item.vy += GRAVITY
      item.x += item.vx
      item.y += item.vy
      item.vx *= FRICTION

      // Bounce off ground
      if (item.y >= item.groundY) {
        item.y = item.groundY
        item.vy = -Math.abs(item.vy) * BOUNCE
        const totalVel = Math.abs(item.vx) + Math.abs(item.vy)
        if (totalVel < SETTLE_VEL) {
          item.vx = 0
          item.vy = 0
          item.y = item.groundY
          item.settled = true
        }
      }
    }
  }

  return expired
}

/** Remove expired items from array (mutates in-place) */
export function removeExpired(items: WorldItem[], expired: string[]): void {
  if (expired.length === 0) return
  const expSet = new Set(expired)
  for (let i = items.length - 1; i >= 0; i--) {
    if (expSet.has(items[i].id)) items.splice(i, 1)
  }
}

/** Find items within magnet radius of player. Returns collected item IDs. */
export function collectNearby(
  items: WorldItem[],
  playerX: number,
  playerY: number,
): WorldItem[] {
  const collected: WorldItem[] = []
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    // Only collect settled items with no pickup delay (skip static — click only)
    if (!item.settled || item.pickupDelay > 0 || item.isStatic) continue
    const dx = (item.x + 8) - (playerX + 8)
    const dy = (item.y + 8) - (playerY + 12) // player center-bottom
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist <= MAGNET_RADIUS) {
      collected.push(item)
      items.splice(i, 1)
    }
  }
  return collected
}

/** Get visual Y position (includes bob for settled items, flat for static pickups) */
export function getVisualY(item: WorldItem): number {
  if (!item.settled) return item.y
  if (item.isStatic) return item.y // static pickups sit flat on ground
  return item.y - Math.sin(item.bobPhase) * BOB_AMP
}

/** Blink alpha for items about to despawn (last 5 seconds) */
export function getDespawnAlpha(item: WorldItem): number {
  if (item.isStatic) return 1 // static pickups never blink
  const remaining = DESPAWN_TICKS - item.life
  if (remaining > 75) return 1 // last 5s = 75 ticks
  // Blink faster as time runs out
  const freq = remaining < 30 ? 4 : 2
  return Math.sin(item.life * freq * 0.15) > 0 ? 1 : 0.3
}
