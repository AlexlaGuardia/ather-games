/**
 * Shimmer Multiplayer Client
 *
 * WebSocket connection to shimmer-server.
 * Sends local player position, receives remote players.
 * Remote players rendered as sprites in the existing Y-sort pipeline.
 */

import { PlayerDirection } from './player'

// ather.games v1: hard-off until a public shimmer-ws exists (extraction plan FORK 2).
const MP_DISABLED = true

// --- Types ---

export interface RemotePlayer {
  playerId: string
  name: string
  x: number           // current visual position (smoothed)
  y: number
  targetX: number     // latest server position (moves toward this)
  targetY: number
  direction: PlayerDirection
  moving: boolean
  sprite: string
  animFrame: number
  animTimer: number
  lastUpdate: number  // timestamp of last server update
}

// Pixels per tick to lerp toward target — matches local player walk speed
const REMOTE_LERP_SPEED = 5

interface ServerMessage {
  type: string
  [key: string]: any
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected'

// --- Direction mapping ---

const DIR_TO_INT: Record<PlayerDirection, number> = {
  'up': 0, 'up-right': 1, 'right': 2, 'down-right': 3,
  'down': 4, 'down-left': 5, 'left': 6, 'up-left': 7,
}

const INT_TO_DIR: PlayerDirection[] = [
  'up', 'up-right', 'right', 'down-right',
  'down', 'down-left', 'left', 'up-left',
]

// --- Multiplayer Client ---

export class MultiplayerClient {
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private remotePlayers: Map<string, RemotePlayer> = new Map()
  private playerId: string
  private playerName: string
  private zone: string
  private sprite: string

  // Throttle: send position every N ticks (15 TPS / 3 = 5 updates/sec)
  private sendInterval = 3
  private tickCounter = 0

  // Last sent state (avoid redundant sends)
  private lastSentX = -1
  private lastSentY = -1
  private lastSentDir = -1
  private lastSentMoving = false

  // Callbacks
  onPlayerJoined: ((player: RemotePlayer) => void) | null = null
  onPlayerLeft: ((playerId: string) => void) | null = null
  onChat: ((playerId: string, name: string, text: string) => void) | null = null
  onStateChange: ((state: ConnectionState) => void) | null = null

  constructor(playerId: string, name: string, zone: string, sprite: string = 'default') {
    this.playerId = playerId
    this.playerName = name
    this.zone = zone
    this.sprite = sprite
  }

  // --- Connection ---

  connect(serverUrl: string = 'ws://localhost:8400/ws') {
    // ather.games v1: multiplayer disabled — no public shimmer-ws yet (see extraction
    // plan FORK 2). Single-player only; re-enable when a public shimmer-ws is deployed.
    if (MP_DISABLED) return
    if (this.state !== 'disconnected') return

    this.state = 'connecting'
    this.onStateChange?.('connecting')

    const params = new URLSearchParams({
      player_id: this.playerId,
      name: this.playerName,
      zone: this.zone,
      sprite: this.sprite,
    })

    this.ws = new WebSocket(`${serverUrl}?${params}`)

    this.ws.onopen = () => {
      this.state = 'connected'
      this.onStateChange?.('connected')
      console.log('[multiplayer] connected')
    }

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data)
    }

    this.ws.onclose = () => {
      this.state = 'disconnected'
      this.remotePlayers.clear()
      this.onStateChange?.('disconnected')
      console.log('[multiplayer] disconnected')
    }

    this.ws.onerror = (err) => {
      console.warn('[multiplayer] ws error', err)
    }
  }

  disconnect() {
    if (this.ws) {
      this.send({ type: 'leave' })
      this.ws.close()
      this.ws = null
    }
    this.state = 'disconnected'
    this.remotePlayers.clear()
    this.onStateChange?.('disconnected')
  }

  get connected(): boolean {
    return this.state === 'connected'
  }

  get connectionState(): ConnectionState {
    return this.state
  }

  // --- Send ---

  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  /**
   * Call every game tick (15 TPS) with local player state.
   * Throttles to ~5 updates/sec. Only sends if state changed.
   */
  tick(x: number, y: number, direction: PlayerDirection, moving: boolean) {
    if (!this.connected) return

    this.tickCounter++
    if (this.tickCounter < this.sendInterval) return
    this.tickCounter = 0

    // Snap to integers — sub-pixel jitter causes shaking on remote clients
    const ix = Math.round(x)
    const iy = Math.round(y)
    const dirInt = DIR_TO_INT[direction]
    const changed = (
      ix !== this.lastSentX ||
      iy !== this.lastSentY ||
      dirInt !== this.lastSentDir ||
      moving !== this.lastSentMoving
    )

    if (!changed) return

    this.lastSentX = ix
    this.lastSentY = iy
    this.lastSentDir = dirInt
    this.lastSentMoving = moving

    this.send({
      type: 'move',
      x: ix,
      y: iy,
      direction: dirInt,
      moving,
    })
  }

  /**
   * Notify server of zone change. Server will move player to new instance.
   * Remote player list will be replaced via instance_state message.
   * For garden visits, pass gardenOwner to join that player's garden instance.
   */
  changeZone(newZone: string, gardenOwner?: string) {
    if (!this.connected) return
    this.zone = newZone
    this.remotePlayers.clear()
    const msg: Record<string, string> = { type: 'zone_change', zone: newZone }
    if (gardenOwner) msg.garden_owner = gardenOwner
    this.send(msg)
  }

  sendChat(text: string) {
    if (!this.connected) return
    this.send({ type: 'chat', text: text.slice(0, 200) })
  }

  // --- Receive ---

  private handleMessage(raw: string) {
    let msg: ServerMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    switch (msg.type) {
      case 'instance_state':
        this.handleInstanceState(msg)
        break
      case 'player_joined':
        this.handlePlayerJoined(msg)
        break
      case 'player_moved':
        this.handlePlayerMoved(msg)
        break
      case 'player_left':
        this.handlePlayerLeft(msg)
        break
      case 'chat':
        this.onChat?.(msg.player_id, msg.name, msg.text)
        break
      case 'error':
        console.warn('[multiplayer] server error:', msg.message)
        break
    }
  }

  private handleInstanceState(msg: ServerMessage) {
    // Full state on join — populate all existing players
    this.remotePlayers.clear()
    for (const p of msg.players || []) {
      if (p.player_id === this.playerId) continue
      this.remotePlayers.set(p.player_id, this.createRemotePlayer(p))
    }
  }

  private handlePlayerJoined(msg: ServerMessage) {
    if (msg.player_id === this.playerId) return
    const remote = this.createRemotePlayer(msg)
    this.remotePlayers.set(msg.player_id, remote)
    this.onPlayerJoined?.(remote)
  }

  private handlePlayerMoved(msg: ServerMessage) {
    const remote = this.remotePlayers.get(msg.player_id)
    if (!remote) return

    // Set target — visual position lerps toward it each tick
    remote.targetX = msg.x
    remote.targetY = msg.y
    remote.direction = INT_TO_DIR[msg.direction] || 'down'
    remote.moving = msg.moving
    remote.lastUpdate = performance.now()
  }

  private handlePlayerLeft(msg: ServerMessage) {
    this.remotePlayers.delete(msg.player_id)
    this.onPlayerLeft?.(msg.player_id)
  }

  private createRemotePlayer(data: any): RemotePlayer {
    const dir = typeof data.direction === 'number'
      ? (INT_TO_DIR[data.direction] || 'down')
      : (data.direction || 'down')

    return {
      playerId: data.player_id,
      name: data.name || 'Traveler',
      x: data.x || 0,
      y: data.y || 0,
      targetX: data.x || 0,
      targetY: data.y || 0,
      direction: dir,
      moving: data.moving || false,
      sprite: data.sprite || 'default',
      animFrame: 0,
      animTimer: 0,
      lastUpdate: performance.now(),
    }
  }

  // --- Query ---

  getRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values())
  }

  getRemotePlayer(playerId: string): RemotePlayer | undefined {
    return this.remotePlayers.get(playerId)
  }

  get playerCount(): number {
    return this.remotePlayers.size + 1  // +1 for local player
  }

  /**
   * Update remote players: smooth position lerp + animation frames.
   * Call every game tick (15 TPS).
   */
  updateAnimations() {
    for (const rp of this.remotePlayers.values()) {
      // Smooth movement toward target position
      const dx = rp.targetX - rp.x
      const dy = rp.targetY - rp.y
      const dist = Math.abs(dx) + Math.abs(dy)  // manhattan — cheaper, good enough

      if (dist > 2) {
        // If very far behind (teleport/zone change), snap
        if (dist > 200) {
          rp.x = rp.targetX
          rp.y = rp.targetY
        } else {
          // Move toward target at fixed speed, snap to integers
          const norm = Math.sqrt(dx * dx + dy * dy)
          const step = Math.min(REMOTE_LERP_SPEED, norm)
          rp.x = Math.round(rp.x + (dx / norm) * step)
          rp.y = Math.round(rp.y + (dy / norm) * step)
        }
      } else {
        // Close enough — snap to target
        rp.x = rp.targetX
        rp.y = rp.targetY
      }

      // Walk animation when moving toward target
      const isMoving = dist > 2 || rp.moving
      if (isMoving) {
        rp.animTimer++
        if (rp.animTimer >= 8) {
          rp.animTimer = 0
          rp.animFrame = (rp.animFrame + 1) % 4
        }
      } else {
        rp.animFrame = 0
        rp.animTimer = 0
      }
    }
  }
}
