// Particle system — ambient Ather dust + interaction effects + weather
// Renders at full 60fps rate (not tick-locked) for smooth movement
// Particles spawn in world space relative to the current camera viewport

import { WIDTH, HEIGHT } from '../engine/renderer'
import type { WeatherType } from '../engine/weather'

type ParticleType = 'ather' | 'heart' | 'sparkle' | 'channel' | 'rain' | 'fog' | 'mana_surge' | 'heat'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  type: ParticleType
  color?: string        // custom color (used by channel particles)
}

const MAX_AMBIENT = 40
const ATHER_COLORS = ['#d4a843', '#e8c860', '#f0d878', '#ffe8a0']
const HEART_COLORS = ['#f06080', '#ff8090', '#ffa0b0']
const SPARKLE_COLORS = ['#ffe8a0', '#ffffff', '#f0d878']
const RAIN_COLORS = ['#8090b0', '#7080a0', '#6070a0']
const FOG_COLORS = ['#b0b8c0', '#a0a8b0', '#c0c8d0']
const SURGE_COLORS = ['#8060d0', '#6040b0', '#a080e0', '#b090f0']
const HEAT_COLORS = ['#d0a060', '#c09050', '#e0b070']

export class ParticleSystem {
  private particles: Particle[] = []
  private spawnTimer = 0
  private weatherTimer = 0
  // Storm flash: alpha > 0 during a lightning flash, decays each frame
  stormFlash = 0

  /** Spawn a burst of effect particles at a world position */
  burst(worldX: number, worldY: number, type: 'heart' | 'sparkle', count = 4) {
    for (let i = 0; i < count; i++) {
      if (type === 'heart') {
        this.particles.push({
          x: worldX + (Math.random() - 0.5) * 6,
          y: worldY - 2 - Math.random() * 4,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.4 - Math.random() * 0.3,
          life: 0,
          maxLife: 600 + Math.random() * 400,
          size: Math.random() > 0.6 ? 2 : 1,
          type: 'heart',
        })
      } else {
        this.particles.push({
          x: worldX + (Math.random() - 0.5) * 8,
          y: worldY - Math.random() * 6,
          vx: (Math.random() - 0.5) * 0.1,
          vy: -0.15 - Math.random() * 0.15,
          life: 0,
          maxLife: 300 + Math.random() * 300,
          size: 1,
          type: 'sparkle',
        })
      }
    }
  }

  /** Emit a steady stream of channel particles (call every few ticks) */
  channelStream(worldX: number, worldY: number, color: string) {
    this.particles.push({
      x: worldX + (Math.random() - 0.5) * 12,
      y: worldY + 4 + Math.random() * 8,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -0.3 - Math.random() * 0.2,
      life: 0,
      maxLife: 400 + Math.random() * 300,
      size: 1,
      type: 'channel',
      color,
    })
  }

  /** Emit weather particles based on current weather type. Call each frame. */
  weatherEmit(weather: WeatherType, dt: number, camX: number, camY: number, transition: number) {
    if (weather === 'clear' || transition < 0.1) return

    this.weatherTimer += dt * transition
    const intensity = transition // fade particles in/out with weather transitions

    if (weather === 'rain') {
      // Light rain — thin streaks falling at an angle
      while (this.weatherTimer > 25) {
        this.weatherTimer -= 25
        this.particles.push({
          x: camX + Math.random() * (WIDTH + 40) - 20,
          y: camY - 4 - Math.random() * 10,
          vx: 0.3,
          vy: 2.5 + Math.random() * 1.0,
          life: 0,
          maxLife: 250 + Math.random() * 100,
          size: Math.random() > 0.7 ? 2 : 1,
          type: 'rain',
        })
      }
    } else if (weather === 'storm') {
      // Heavy rain — more drops, faster, stronger angle
      while (this.weatherTimer > 12) {
        this.weatherTimer -= 12
        this.particles.push({
          x: camX + Math.random() * (WIDTH + 60) - 30,
          y: camY - 4 - Math.random() * 10,
          vx: 0.6 + Math.random() * 0.3,
          vy: 3.5 + Math.random() * 1.5,
          life: 0,
          maxLife: 180 + Math.random() * 80,
          size: Math.random() > 0.5 ? 2 : 1,
          type: 'rain',
        })
      }
      // Occasional lightning flash (~1% per frame)
      if (this.stormFlash <= 0 && Math.random() < 0.003 * intensity) {
        this.stormFlash = 0.7
      }
    } else if (weather === 'fog') {
      // Slow-drifting fog wisps
      while (this.weatherTimer > 200) {
        this.weatherTimer -= 200
        this.particles.push({
          x: camX - 10 + Math.random() * (WIDTH + 20),
          y: camY + Math.random() * HEIGHT,
          vx: 0.08 + Math.random() * 0.06,
          vy: (Math.random() - 0.5) * 0.02,
          life: 0,
          maxLife: 3000 + Math.random() * 2000,
          size: 2 + Math.floor(Math.random() * 2),
          type: 'fog',
        })
      }
    } else if (weather === 'mana_surge') {
      // Rising purple/blue sparkles
      while (this.weatherTimer > 80) {
        this.weatherTimer -= 80
        this.particles.push({
          x: camX + Math.random() * WIDTH,
          y: camY + HEIGHT + Math.random() * 10,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.4 - Math.random() * 0.3,
          life: 0,
          maxLife: 2000 + Math.random() * 2000,
          size: Math.random() > 0.6 ? 2 : 1,
          type: 'mana_surge',
        })
      }
    } else if (weather === 'drought') {
      // Heat shimmer — warm particles rising slowly
      while (this.weatherTimer > 150) {
        this.weatherTimer -= 150
        this.particles.push({
          x: camX + Math.random() * WIDTH,
          y: camY + HEIGHT * 0.6 + Math.random() * HEIGHT * 0.4,
          vx: (Math.random() - 0.5) * 0.1,
          vy: -0.1 - Math.random() * 0.08,
          life: 0,
          maxLife: 2500 + Math.random() * 2000,
          size: 1,
          type: 'heat',
        })
      }
    }
  }

  update(dt: number, camX = 0, camY = 0) {
    // Spawn ambient Ather dust in the visible viewport
    const ambientCount = this.particles.filter(p => p.type === 'ather').length
    this.spawnTimer += dt
    while (this.spawnTimer > 150 && ambientCount < MAX_AMBIENT) {
      this.spawnTimer -= 150
      this.particles.push({
        x: camX + Math.random() * WIDTH,
        y: camY + HEIGHT + Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.2 - Math.random() * 0.3,
        life: 0,
        maxLife: 2000 + Math.random() * 3000,
        size: Math.random() > 0.7 ? 2 : 1,
        type: 'ather',
      })
    }

    // Decay storm flash
    if (this.stormFlash > 0) {
      this.stormFlash = Math.max(0, this.stormFlash - dt * 0.004)
    }

    // Update all particles
    const dtScale = dt / 16.67
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx * dtScale
      p.y += p.vy * dtScale
      p.life += dt

      if (p.type === 'ather') {
        p.vx += Math.sin(p.life * 0.002) * 0.005 * dtScale // gentle sway
        if (p.life >= p.maxLife || p.y < camY - 5) {
          this.particles.splice(i, 1)
        }
      } else if (p.type === 'heart') {
        // Hearts decelerate and drift
        p.vy *= 0.998
        p.vx += Math.sin(p.life * 0.005) * 0.003 * dtScale
        if (p.life >= p.maxLife) {
          this.particles.splice(i, 1)
        }
      } else if (p.type === 'channel') {
        // Channel energy: gentle sway as it rises
        p.vx += Math.sin(p.life * 0.004) * 0.002 * dtScale
        if (p.life >= p.maxLife) {
          this.particles.splice(i, 1)
        }
      } else if (p.type === 'rain') {
        // Rain falls fast, die when below viewport
        if (p.life >= p.maxLife || p.y > camY + HEIGHT + 5) {
          this.particles.splice(i, 1)
        }
      } else if (p.type === 'fog') {
        // Fog drifts slowly, gentle vertical sway
        p.vy = Math.sin(p.life * 0.001) * 0.02
        if (p.life >= p.maxLife || p.x > camX + WIDTH + 20) {
          this.particles.splice(i, 1)
        }
      } else if (p.type === 'mana_surge') {
        // Mana sparkles rise with gentle sway (like ather but purple)
        p.vx += Math.sin(p.life * 0.003) * 0.004 * dtScale
        if (p.life >= p.maxLife || p.y < camY - 5) {
          this.particles.splice(i, 1)
        }
      } else if (p.type === 'heat') {
        // Heat shimmer: wobbly rise
        p.vx = Math.sin(p.life * 0.003 + p.x * 0.1) * 0.15
        if (p.life >= p.maxLife || p.y < camY) {
          this.particles.splice(i, 1)
        }
      } else {
        // Sparkles flash and fade fast
        if (p.life >= p.maxLife) {
          this.particles.splice(i, 1)
        }
      }
    }
  }

  render(drawPixel: (x: number, y: number, color: string, alpha: number) => void) {
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife

      if (p.type === 'ather') {
        let alpha: number
        if (lifeRatio < 0.1) alpha = lifeRatio * 10
        else if (lifeRatio > 0.7) alpha = (1 - lifeRatio) / 0.3
        else alpha = 1
        alpha *= 0.6

        const color = ATHER_COLORS[Math.floor(Math.random() * ATHER_COLORS.length)]
        drawPixel(p.x, p.y, color, alpha)
        if (p.size > 1) {
          drawPixel(p.x + 1, p.y, color, alpha * 0.5)
          drawPixel(p.x, p.y - 1, color, alpha * 0.3)
        }
      } else if (p.type === 'heart') {
        // Hearts: fade in fast, hang, fade out
        let alpha: number
        if (lifeRatio < 0.1) alpha = lifeRatio * 10
        else if (lifeRatio > 0.5) alpha = (1 - lifeRatio) / 0.5
        else alpha = 1
        alpha *= 0.85

        const color = HEART_COLORS[Math.floor(lifeRatio * HEART_COLORS.length) % HEART_COLORS.length]
        drawPixel(p.x, p.y, color, alpha)
        if (p.size > 1) {
          // Tiny 3px heart shape: two dots on top, one centered below
          drawPixel(p.x - 1, p.y, color, alpha * 0.7)
          drawPixel(p.x + 1, p.y, color, alpha * 0.7)
          drawPixel(p.x, p.y + 1, color, alpha * 0.5)
        }
      } else if (p.type === 'channel') {
        // Channel energy: soft glow, rises and fades
        let alpha: number
        if (lifeRatio < 0.2) alpha = lifeRatio * 5
        else if (lifeRatio > 0.6) alpha = (1 - lifeRatio) / 0.4
        else alpha = 1
        alpha *= 0.4 + 0.3 * Math.sin(p.life * 0.015)
        alpha = Math.max(0, alpha)
        const color = p.color ?? '#d4a843'
        drawPixel(p.x, p.y, color, alpha)
      } else if (p.type === 'rain') {
        // Rain: thin vertical streak, slight transparency
        let alpha = lifeRatio < 0.1 ? lifeRatio * 10 : lifeRatio > 0.85 ? (1 - lifeRatio) / 0.15 : 1
        alpha *= 0.5
        const color = RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)]
        drawPixel(p.x, p.y, color, alpha)
        // Streak tail (1-2px above)
        drawPixel(p.x, p.y - 1, color, alpha * 0.6)
        if (p.size > 1) drawPixel(p.x, p.y - 2, color, alpha * 0.3)
      } else if (p.type === 'fog') {
        // Fog: large diffuse patch, very low alpha
        let alpha = lifeRatio < 0.15 ? lifeRatio / 0.15 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1
        alpha *= 0.12
        const color = FOG_COLORS[Math.floor(Math.random() * FOG_COLORS.length)]
        // Draw a soft cluster of pixels
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy)
            const a = alpha * (dist === 0 ? 1 : dist === 1 ? 0.6 : 0.3)
            drawPixel(p.x + dx * p.size, p.y + dy * p.size, color, a)
          }
        }
      } else if (p.type === 'mana_surge') {
        // Mana surge: purple sparkles rising, pulse gently
        let alpha: number
        if (lifeRatio < 0.1) alpha = lifeRatio * 10
        else if (lifeRatio > 0.7) alpha = (1 - lifeRatio) / 0.3
        else alpha = 1
        alpha *= 0.5 + 0.2 * Math.sin(p.life * 0.008)
        alpha = Math.max(0, alpha)
        const color = SURGE_COLORS[Math.floor(Math.random() * SURGE_COLORS.length)]
        drawPixel(p.x, p.y, color, alpha)
        if (p.size > 1) {
          drawPixel(p.x + 1, p.y, color, alpha * 0.4)
          drawPixel(p.x, p.y - 1, color, alpha * 0.3)
        }
      } else if (p.type === 'heat') {
        // Heat shimmer: faint warm pixels wobbling upward
        let alpha = lifeRatio < 0.2 ? lifeRatio * 5 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1
        alpha *= 0.15 + 0.1 * Math.sin(p.life * 0.01)
        alpha = Math.max(0, alpha)
        const color = HEAT_COLORS[Math.floor(Math.random() * HEAT_COLORS.length)]
        drawPixel(p.x, p.y, color, alpha)
      } else {
        // Sparkles: bright flash, fast fade
        let alpha = lifeRatio < 0.3
          ? lifeRatio / 0.3
          : (1 - lifeRatio) / 0.7
        // Pulse effect
        alpha *= 0.5 + 0.5 * Math.sin(p.life * 0.02)
        alpha = Math.max(0, alpha)

        const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)]
        drawPixel(p.x, p.y, color, alpha)
        // Cross pattern for sparkle
        drawPixel(p.x - 1, p.y, color, alpha * 0.3)
        drawPixel(p.x + 1, p.y, color, alpha * 0.3)
        drawPixel(p.x, p.y - 1, color, alpha * 0.3)
        drawPixel(p.x, p.y + 1, color, alpha * 0.3)
      }
    }
  }
}
