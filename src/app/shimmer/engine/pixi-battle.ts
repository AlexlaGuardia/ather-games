// PixiJS Battle Renderer — WebGL-powered spirit display
// V2: High-res Flux art + attack animations + element auras
// Two modes: 1024x1024 AI art (battles) or 16x16 pixel art (legacy fallback)
// Background: pixel art from existing drawBattleBg, scaled to fill

import {
  Application,
  Assets,
  CanvasSource,
  Container,
  Sprite,
  Texture,
  Graphics,
  BlurFilter,
} from 'pixi.js'
import { SpiritMesh, createSpiritMesh } from './spirit-mesh'

// ── Easing Functions ──

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// ── Element Visual Config ──

const ELEMENT_CONFIG: Record<string, {
  glow: number; glowAlpha: number
  particle: number; particleCount: number; speed: number
  core: number  // orb body colour for the token render path
}> = {
  mana:    { glow: 0xc8a0d8, glowAlpha: 0.4, particle: 0xd4b0e8, particleCount: 20, speed: 0.4, core: 0xc77ce0 },
  storm:   { glow: 0x7090c0, glowAlpha: 0.4, particle: 0x90b0e0, particleCount: 26, speed: 0.7, core: 0x6f9be6 },
  earth:   { glow: 0xb09060, glowAlpha: 0.35, particle: 0xc8a870, particleCount: 14, speed: 0.25, core: 0xc89a5a },
  water:   { glow: 0x60a0a0, glowAlpha: 0.4, particle: 0x80c0c0, particleCount: 22, speed: 0.5, core: 0x57c4c4 },
  neutral: { glow: 0xd4a843, glowAlpha: 0.3, particle: 0xf0d070, particleCount: 12, speed: 0.3, core: 0xf0c850 },
  base:    { glow: 0xd4a843, glowAlpha: 0.3, particle: 0xf0d070, particleCount: 12, speed: 0.3, core: 0xf0c850 },
}

// Collared spirit — drained of element, rendered ash-grey (canon: collar dims the light)
const COLLARED_CFG = { glow: 0x6e6e7a, glowAlpha: 0.16, particle: 0x70707a, particleCount: 5, speed: 0.18, core: 0x9a9aa4 }

// ── Shared Textures ──

let _dotTexture: Texture | null = null

function getDotTexture(): Texture {
  if (_dotTexture) return _dotTexture
  const c = document.createElement('canvas')
  c.width = 8; c.height = 8
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 8, 8)
  _dotTexture = Texture.from(c)
  return _dotTexture
}

// Soft luminous orb — the token body for the no-pixel battle skin. White so the
// sprite tint paints it any element colour. Baked top-left highlight = roundness.
let _orbTexture: Texture | null = null

function getOrbTexture(): Texture {
  if (_orbTexture) return _orbTexture
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.96)')
  g.addColorStop(0.78, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill()
  const h = ctx.createRadialGradient(24, 22, 1, 24, 22, 13)
  h.addColorStop(0, 'rgba(255,255,255,0.95)')
  h.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = h
  ctx.beginPath(); ctx.arc(24, 22, 13, 0, Math.PI * 2); ctx.fill()
  _orbTexture = Texture.from(c)
  return _orbTexture
}

const _maskTextures = new Map<number, Texture>()

function getRadialMask(size: number): Texture {
  const key = Math.round(size)
  if (_maskTextures.has(key)) return _maskTextures.get(key)!
  const c = document.createElement('canvas')
  c.width = key; c.height = key
  const ctx = c.getContext('2d')!
  const r = key / 2
  const g = ctx.createRadialGradient(r, r, r * 0.2, r, r, r * 0.5)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.7, 'rgba(255,255,255,1)')
  g.addColorStop(0.9, 'rgba(255,255,255,0.2)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, key, key)
  const t = Texture.from(c)
  _maskTextures.set(key, t)
  return t
}

// ── Particle Data ──

interface ParticleData {
  sprite: Sprite
  vx: number; vy: number
  life: number; maxLife: number
  baseAlpha: number
  baseScale: number
}

function spawnOrbitalParticle(
  parent: Container, cx: number, cy: number,
  radius: number, color: number, speed: number, scale = 1,
): ParticleData {
  const angle = Math.random() * Math.PI * 2
  const dist = radius * (0.3 + Math.random() * 0.7)
  const life = 60 + Math.floor(Math.random() * 90)
  const sprite = new Sprite(getDotTexture())
  sprite.anchor.set(0.5)
  sprite.x = cx + Math.cos(angle) * dist
  sprite.y = cy + Math.sin(angle) * dist
  sprite.tint = color
  const baseAlpha = 0.3 + Math.random() * 0.5
  const baseScale = (0.4 + Math.random() * 0.8) * scale
  sprite.alpha = baseAlpha
  sprite.scale.set(baseScale)
  parent.addChild(sprite)
  return { sprite, vx: (Math.random() - 0.5) * speed, vy: -Math.random() * speed * 0.5 - 0.08, life, maxLife: life, baseAlpha, baseScale }
}

function tickParticle(p: ParticleData, dt: number): boolean {
  p.sprite.x += p.vx * dt
  p.sprite.y += p.vy * dt
  p.life -= dt
  if (p.life <= 0) return false
  const r = p.life / p.maxLife
  const fade = r < 0.3 ? r / 0.3 : r > 0.8 ? (1 - r) / 0.2 : 1
  p.sprite.alpha = p.baseAlpha * fade
  return true
}

// ── Spirit Display ──

class SpiritDisplay {
  container: Container
  sprite: Sprite
  glow: Sprite
  shadow: Graphics
  particleContainer: Container
  particles: ParticleData[] = []
  maskSprite: Sprite | null = null
  spiritMesh: SpiritMesh | null = null

  textures: Texture[]
  element: string
  size: number
  isHighRes: boolean

  // Token render path (no-pixel skin)
  token: boolean
  collared: boolean
  cfg: typeof COLLARED_CFG       // active visual config (element or collared)
  baseCfg: typeof COLLARED_CFG   // the element's config, restored on uncollar
  collarRing: Graphics | null = null

  currentFrame = 0
  frameTimer = 0
  bobPhase: number
  breathPhase: number
  baseX = 0
  baseY = 0

  flashTimer = 0
  isKO = false
  koProgress = 0

  // Attack tween state
  private attackAnim: {
    startX: number; startY: number
    targetX: number; targetY: number
    progress: number
    phase: 'lunge' | 'impact' | 'return'
    onImpact: (() => void) | null
    resolve: (() => void) | null
  } | null = null

  constructor(
    textures: Texture[], element: string, size: number, highRes = false,
    opts: { token?: boolean; collared?: boolean } = {},
  ) {
    this.textures = textures
    this.element = element
    this.size = size
    this.isHighRes = highRes
    this.token = opts.token ?? false
    this.collared = opts.collared ?? false
    this.bobPhase = Math.random() * Math.PI * 2
    this.breathPhase = Math.random() * Math.PI * 2

    this.container = new Container()
    this.baseCfg = ELEMENT_CONFIG[element] ?? ELEMENT_CONFIG.neutral
    this.cfg = this.collared ? COLLARED_CFG : this.baseCfg
    const cfg = this.cfg

    // Shadow (wider for high-res)
    this.shadow = new Graphics()
    const shadowW = highRes ? size * 0.4 : size * 0.35
    const shadowH = highRes ? size * 0.06 : size * 0.09
    this.shadow.ellipse(0, size * 0.52, shadowW, shadowH)
    this.shadow.fill({ color: 0x000000, alpha: 0.25 })
    this.container.addChild(this.shadow)

    // Glow (element-tinted blurred copy)
    this.glow = new Sprite(textures[0])
    this.glow.anchor.set(0.5)
    if (highRes) {
      this.glow.width = size * 1.8
      this.glow.height = size * 1.8
      this.glow.filters = [new BlurFilter({ strength: 22 })]
      this.glow.alpha = cfg.glowAlpha * 1.4
    } else {
      this.glow.width = size * 1.5
      this.glow.height = size * 1.5
      this.glow.filters = [new BlurFilter({ strength: 14 })]
      this.glow.alpha = cfg.glowAlpha
    }
    this.glow.tint = cfg.glow
    this.container.addChild(this.glow)

    // Main sprite
    this.sprite = new Sprite(textures[0])
    this.sprite.anchor.set(0.5)
    this.sprite.width = size
    this.sprite.height = size

    // Token skin: paint the white orb with the element's body colour (or ash if collared)
    if (this.token) {
      this.sprite.tint = cfg.core
      if (this.collared) this.sprite.alpha = 0.9
    }

    this.container.addChild(this.sprite)

    // Collar ring — a dark band squeezing the dimmed orb (the leash made visible)
    if (this.token && this.collared) {
      this.collarRing = this.drawCollarRing()
      this.container.addChild(this.collarRing)
    }

    // Particle layer
    this.particleContainer = new Container()
    this.container.addChild(this.particleContainer)
    const pCount = highRes ? Math.round(cfg.particleCount * 1.6) : cfg.particleCount
    const pRadius = highRes ? size * 0.6 : size * 0.55
    const pScale = highRes ? 1.3 : 1
    for (let i = 0; i < pCount; i++) {
      this.particles.push(
        spawnOrbitalParticle(this.particleContainer, 0, 0, pRadius, cfg.particle, cfg.speed, pScale)
      )
    }
  }

  /** Create a high-res spirit display from an image URL */
  static async fromImage(url: string, element: string, size: number): Promise<SpiritDisplay> {
    const texture = await Assets.load(url)
    texture.source.scaleMode = 'linear'
    return new SpiritDisplay([texture], element, size, true)
  }

  /** Load a depth map and create a Three.js displacement mesh for real 3D */
  async loadDepthMap(imageUrl: string, depthUrl: string): Promise<void> {
    try {
      const meshSize = Math.round(this.size * 1.5)
      const mesh = await createSpiritMesh(imageUrl, depthUrl, meshSize)
      if (!mesh) return

      this.spiritMesh = mesh
      // Dynamic canvas source — we manually call update() each frame
      const source = new CanvasSource({ resource: mesh.canvas })
      source.scaleMode = 'linear'
      const dynTexture = new Texture({ source })
      this.sprite.texture = dynTexture
      this.glow.texture = dynTexture
    } catch {
      // Depth map not available — falls back to static image
    }
  }

  /** Slide toward target, call onImpact at contact, slide back. Returns promise. */
  attack(targetX: number, targetY: number, onImpact?: () => void): Promise<void> {
    return new Promise(resolve => {
      this.attackAnim = {
        startX: this.baseX,
        startY: this.baseY,
        targetX,
        targetY,
        progress: 0,
        phase: 'lunge',
        onImpact: onImpact ?? null,
        resolve,
      }
    })
  }

  tick(dt: number) {
    if (this.isKO) {
      this.koProgress = Math.min(1, this.koProgress + dt * 0.025)
      this.container.alpha = 1 - this.koProgress
      this.sprite.y = this.koProgress * 16
      this.glow.alpha *= 0.95
      this.doTickParticles(dt)
      return
    }

    // Attack animation overrides position
    if (this.attackAnim) {
      this.tickAttack(dt)
      this.doTickParticles(dt)
      return
    }

    // Frame animation (~600ms per frame, for multi-frame sprites)
    if (this.textures.length > 1) {
      this.frameTimer += dt
      if (this.frameTimer >= 36) {
        this.frameTimer = 0
        this.currentFrame = (this.currentFrame + 1) % this.textures.length
        this.sprite.texture = this.textures[this.currentFrame]
      }
    }

    // Bob
    this.bobPhase += dt * 0.03
    const bob = Math.sin(this.bobPhase) * (this.isHighRes ? 4 : 3)
    this.sprite.y = bob
    this.glow.y = bob
    if (this.maskSprite) this.maskSprite.y = bob

    // Breathe
    this.breathPhase += dt * 0.025
    const breath = 1 + Math.sin(this.breathPhase) * (this.isHighRes ? 0.008 : 0.015)
    const texW = this.sprite.texture.width || 16
    const baseScale = this.size / texW
    this.sprite.scale.set(baseScale, baseScale * breath)

    // Flash (hit feedback — blink between visible and dim)
    if (this.flashTimer > 0) {
      this.flashTimer -= dt
      this.sprite.alpha = Math.floor(this.flashTimer / 3) % 2 === 0 ? 1 : 0.15
      if (this.flashTimer <= 0) this.sprite.alpha = 1
    }

    // Glow pulse
    const cfg = this.cfg
    const baseGlow = this.isHighRes ? cfg.glowAlpha * 1.4 : cfg.glowAlpha
    this.glow.alpha = baseGlow + Math.sin(this.bobPhase * 0.7) * 0.08

    // Three.js displacement mesh — real 3D camera sway
    if (this.spiritMesh) {
      this.spiritMesh.tick(dt)
      // Re-upload canvas pixels to GPU
      this.sprite.texture.source.update()
    }

    // Particles
    this.doTickParticles(dt)
  }

  private tickAttack(dt: number) {
    const a = this.attackAnim!
    const speed = 0.045

    if (a.phase === 'lunge') {
      a.progress += dt * speed
      const t = easeOutCubic(Math.min(1, a.progress))
      // Lunge 40% toward target
      this.container.x = a.startX + (a.targetX - a.startX) * 0.4 * t
      this.container.y = a.startY + (a.targetY - a.startY) * 0.25 * t
      // Scale up slightly for punch
      this.container.scale.set(1 + t * 0.08)
      if (a.progress >= 1) {
        a.progress = 0
        a.phase = 'impact'
        a.onImpact?.()
      }
    } else if (a.phase === 'impact') {
      // Brief hold at impact point
      a.progress += dt * 0.08
      if (a.progress >= 1) {
        a.progress = 0
        a.phase = 'return'
      }
    } else if (a.phase === 'return') {
      a.progress += dt * speed * 0.8
      const t = easeOutBack(Math.min(1, a.progress))
      const lungeX = a.startX + (a.targetX - a.startX) * 0.4
      const lungeY = a.startY + (a.targetY - a.startY) * 0.25
      this.container.x = lungeX + (a.startX - lungeX) * t
      this.container.y = lungeY + (a.startY - lungeY) * t
      this.container.scale.set(1 + (1 - t) * 0.08)
      if (a.progress >= 1) {
        this.container.x = a.startX
        this.container.y = a.startY
        this.container.scale.set(1)
        a.resolve?.()
        this.attackAnim = null
      }
    }
  }

  private doTickParticles(dt: number) {
    const cfg = this.cfg
    const bob = this.isKO ? 0 : Math.sin(this.bobPhase) * (this.isHighRes ? 4 : 3)
    const radius = this.isHighRes ? this.size * 0.6 : this.size * 0.55
    const pScale = this.isHighRes ? 1.3 : 1

    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!tickParticle(this.particles[i], dt)) {
        this.particleContainer.removeChild(this.particles[i].sprite)
        this.particles[i].sprite.destroy()
        this.particles[i] = spawnOrbitalParticle(
          this.particleContainer, 0, bob, radius, cfg.particle, cfg.speed, pScale
        )
      }
    }
  }

  flash() { this.flashTimer = 20 }
  ko() { this.isKO = true; this.koProgress = 0 }

  private drawCollarRing(): Graphics {
    const g = new Graphics()
    const rx = this.size * 0.44
    const ry = this.size * 0.34
    g.ellipse(0, 0, rx, ry).stroke({ width: Math.max(2, this.size * 0.05), color: 0x1a1a22, alpha: 0.85 })
    g.ellipse(0, 0, rx * 0.94, ry * 0.94).stroke({ width: 1, color: 0x000000, alpha: 0.4 })
    // clasp / lock node at the front of the band
    g.circle(0, ry, this.size * 0.06).fill({ color: 0x2a2a33, alpha: 0.9 })
    return g
  }

  /** Reach complete: the collar breaks, the element light returns. */
  uncollar() {
    if (!this.collared) return
    this.collared = false
    this.cfg = this.baseCfg
    this.sprite.tint = this.token ? this.baseCfg.core : 0xffffff
    this.sprite.alpha = 1
    this.glow.tint = this.baseCfg.glow
    if (this.collarRing) {
      this.container.removeChild(this.collarRing)
      this.collarRing.destroy()
      this.collarRing = null
    }
  }

  destroy() {
    this.spiritMesh?.destroy()
    for (const p of this.particles) p.sprite.destroy()
    this.container.destroy({ children: true })
  }
}

// ── Ambient Ather Dust ──

class AmbientDust {
  particles: ParticleData[] = []
  container: Container
  width: number
  height: number

  constructor(parent: Container, width: number, height: number) {
    this.width = width
    this.height = height
    this.container = new Container()
    parent.addChild(this.container)

    for (let i = 0; i < 50; i++) {
      const p = spawnOrbitalParticle(
        this.container, 0, 0, 0,
        Math.random() > 0.3 ? 0xf0d070 : 0xf8e8a0,
        0.1, 0.3 + Math.random() * 0.7,
      )
      p.vx = (Math.random() - 0.5) * 0.1
      p.vy = -0.06 - Math.random() * 0.12
      p.life = Math.random() * p.maxLife
      p.sprite.x = Math.random() * width
      p.sprite.y = Math.random() * height
      this.particles.push(p)
    }
  }

  tick(dt: number) {
    for (const p of this.particles) {
      p.sprite.x += p.vx * dt
      p.sprite.y += p.vy * dt
      p.life -= dt
      if (p.life <= 0 || p.sprite.y < -10) {
        p.sprite.x = Math.random() * this.width
        p.sprite.y = this.height + 5 + Math.random() * 10
        p.life = p.maxLife
        p.vx = (Math.random() - 0.5) * 0.1
        p.vy = -0.06 - Math.random() * 0.12
      }
      const fade = p.life < 40 ? p.life / 40 : 1
      p.sprite.alpha = p.baseAlpha * fade
    }
  }

  destroy() { this.container.destroy({ children: true }) }
}

// ── Burst Emitter (damage VFX) ──

class BurstEmitter {
  particles: ParticleData[] = []
  container: Container
  done = false

  constructor(parent: Container, x: number, y: number, color: number, count = 30) {
    this.container = new Container()
    this.container.x = x
    this.container.y = y
    parent.addChild(this.container)

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1.5 + Math.random() * 3
      const p = spawnOrbitalParticle(this.container, 0, 0, 0, color, 0, 0.6 + Math.random() * 1.0)
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.maxLife = 18 + Math.random() * 22
      p.life = p.maxLife
      this.particles.push(p)
    }
  }

  tick(dt: number): boolean {
    let alive = false
    for (const p of this.particles) {
      p.vx *= 0.95
      p.vy *= 0.95
      if (tickParticle(p, dt)) alive = true
    }
    if (!alive) this.done = true
    return alive
  }

  destroy() { this.container.destroy({ children: true }) }
}

// ── Main Renderer ──

export class BattlePixiRenderer {
  app: Application
  mainContainer: Container
  playerDisplay: SpiritDisplay | null = null
  enemyDisplay: SpiritDisplay | null = null
  ambientDust: AmbientDust | null = null
  bgSprite: Sprite | null = null
  bursts: BurstEmitter[] = []
  shakeIntensity = 0
  width: number
  height: number

  constructor(width = 480, height = 288) {
    this.app = new Application()
    this.width = width
    this.height = height
    this.mainContainer = new Container()
  }

  async init(parentEl: HTMLElement): Promise<this> {
    await this.app.init({
      width: this.width,
      height: this.height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    this.app.canvas.style.width = '100%'
    this.app.canvas.style.height = '100%'
    parentEl.appendChild(this.app.canvas)
    this.app.stage.addChild(this.mainContainer)

    this.app.ticker.add(() => this.update(this.app.ticker.deltaTime))
    return this
  }

  setBackground(bgCanvas: HTMLCanvasElement) {
    if (this.bgSprite) {
      this.mainContainer.removeChild(this.bgSprite)
      this.bgSprite.destroy()
    }
    const texture = Texture.from(bgCanvas)
    texture.source.scaleMode = 'nearest'
    this.bgSprite = new Sprite(texture)
    this.bgSprite.width = this.width
    this.bgSprite.height = this.height
    this.mainContainer.addChildAt(this.bgSprite, 0)

    if (!this.ambientDust) {
      this.ambientDust = new AmbientDust(this.mainContainer, this.width, this.height)
    }
  }

  /** Set spirit from pre-rendered 16x16 canvas frames (legacy pixel art path) */
  setSpirit(side: 'player' | 'enemy', frames: HTMLCanvasElement[], element: string) {
    this.removeSpirit(side)

    const textures = frames.map(c => {
      const t = Texture.from(c)
      t.source.scaleMode = 'nearest'
      return t
    })

    const size = side === 'player' ? 96 : 80
    const display = new SpiritDisplay(textures, element, size)
    this.positionSpirit(side, display)
    this.mainContainer.addChild(display.container)
  }

  /** Set spirit as a glowing token orb — the no-pixel battle skin (default path) */
  setSpiritToken(side: 'player' | 'enemy', element: string, opts: { collared?: boolean } = {}) {
    this.removeSpirit(side)
    const size = side === 'player' ? 96 : 84
    const display = new SpiritDisplay([getOrbTexture()], element, size, false, {
      token: true,
      collared: opts.collared,
    })
    this.positionSpirit(side, display)
    this.mainContainer.addChild(display.container)
  }

  /** The collar breaks — restore the freed spirit's element light. */
  freeCollar(side: 'player' | 'enemy') {
    const d = side === 'player' ? this.playerDisplay : this.enemyDisplay
    d?.uncollar()
  }

  /** Set spirit from high-res image URL (Flux concept art path) */
  async setSpiritFromImage(side: 'player' | 'enemy', url: string, element: string, depthUrl?: string): Promise<void> {
    this.removeSpirit(side)

    const size = side === 'player' ? 220 : 185
    const display = await SpiritDisplay.fromImage(url, element, size)
    this.positionSpirit(side, display)
    this.mainContainer.addChild(display.container)

    // Load depth map for 3D displacement mesh (non-blocking — battle works without it)
    if (depthUrl) {
      display.loadDepthMap(url, depthUrl)
    }
  }

  private removeSpirit(side: 'player' | 'enemy') {
    const prev = side === 'player' ? this.playerDisplay : this.enemyDisplay
    if (prev) {
      this.mainContainer.removeChild(prev.container)
      prev.destroy()
    }
  }

  private positionSpirit(side: 'player' | 'enemy', display: SpiritDisplay) {
    if (side === 'player') {
      this.playerDisplay = display
      display.container.x = this.width * 0.24
      display.container.y = this.height * 0.68
      // Flip player to face right (toward enemy)
      display.container.scale.x = -1
    } else {
      this.enemyDisplay = display
      display.container.x = this.width * 0.76
      display.container.y = this.height * 0.30
    }
    display.baseX = display.container.x
    display.baseY = display.container.y
  }

  flash(target: 'player' | 'enemy') {
    const d = target === 'player' ? this.playerDisplay : this.enemyDisplay
    d?.flash()
  }

  shake(intensity = 8) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity)
  }

  burst(target: 'player' | 'enemy', color: number, count = 30) {
    const d = target === 'player' ? this.playerDisplay : this.enemyDisplay
    if (!d) return
    this.bursts.push(
      new BurstEmitter(this.mainContainer, d.container.x, d.container.y, color, count)
    )
  }

  ko(target: 'player' | 'enemy') {
    const d = target === 'player' ? this.playerDisplay : this.enemyDisplay
    d?.ko()
  }

  /** Slide attacker toward defender. Returns promise resolved when animation completes. */
  attack(side: 'player' | 'enemy', onImpact?: () => void): Promise<void> {
    const attacker = side === 'player' ? this.playerDisplay : this.enemyDisplay
    const defender = side === 'player' ? this.enemyDisplay : this.playerDisplay
    if (!attacker || !defender) return Promise.resolve()
    return attacker.attack(defender.baseX, defender.baseY, onImpact)
  }

  private update(dt: number) {
    this.playerDisplay?.tick(dt)
    this.enemyDisplay?.tick(dt)
    this.ambientDust?.tick(dt)

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      if (!this.bursts[i].tick(dt)) {
        this.mainContainer.removeChild(this.bursts[i].container)
        this.bursts[i].destroy()
        this.bursts.splice(i, 1)
      }
    }

    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= 0.88
      if (this.shakeIntensity < 0.3) this.shakeIntensity = 0
      this.mainContainer.x = (Math.random() - 0.5) * this.shakeIntensity * 2
      this.mainContainer.y = (Math.random() - 0.5) * this.shakeIntensity * 2
    } else {
      this.mainContainer.x = 0
      this.mainContainer.y = 0
    }
  }

  destroy() {
    this.playerDisplay?.destroy()
    this.enemyDisplay?.destroy()
    this.ambientDust?.destroy()
    for (const b of this.bursts) b.destroy()
    this.app.destroy(true, { children: true })
  }
}
