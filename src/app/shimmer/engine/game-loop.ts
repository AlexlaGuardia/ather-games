// Fixed-timestep game loop
// Logic ticks at 15 TPS (retro-chunky GBC feel)
// Rendering at full display rate (60fps particles stay smooth)

const TICK_MS = 1000 / 15

export function createGameLoop(
  update: () => void,
  render: (dt: number, alpha: number) => void,
) {
  let lastTime = 0
  let accumulator = 0
  let frameId = 0
  let running = false
  let paused = false

  function loop(timestamp: number) {
    if (!running) return
    const elapsed = Math.min(timestamp - lastTime, 200) // cap to avoid spiral
    lastTime = timestamp

    if (!paused) {
      accumulator += elapsed
      while (accumulator >= TICK_MS) {
        update()
        accumulator -= TICK_MS
      }
    }

    // alpha = how far between last tick and next (0..1) for render interpolation
    render(elapsed, paused ? 0 : accumulator / TICK_MS)
    frameId = requestAnimationFrame(loop)
  }

  return {
    start() {
      if (running) return
      running = true
      lastTime = performance.now()
      accumulator = 0
      frameId = requestAnimationFrame(loop)
    },
    stop() {
      running = false
      cancelAnimationFrame(frameId)
    },
    pause() { paused = true },
    resume() { paused = false; lastTime = performance.now(); accumulator = 0 },
    get paused() { return paused },
  }
}
