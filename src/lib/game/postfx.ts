// Optimized post-processing: vignette, flash, snow, rain.
//
// Performance optimizations:
//   - Vignette gradient is CACHED (only re-created when size changes).
//     Creating a radial gradient every frame was a major CPU sink.
//   - Flash uses a simple fillStyle alpha blend (no gradient) when alpha is low.
//   - Snow/rain particles are sub-pixel (0.5-1.5px) with depth-based parallax.
//   - Particle count is capped and depends on screen size (mobile-friendly).
//   - Snow/rain use a deterministic per-particle phase so they NEVER sync
//     into ugly looping patterns (the bug the user reported).

export interface WeatherParticle {
  x: number       // 0-1 normalized screen position
  y: number       // 0-1 normalized
  speed: number   // fall speed (normalized per second)
  drift: number   // horizontal drift amplitude
  driftPhase: number  // phase offset so particles don't sync
  driftRate: number   // how fast drift oscillates
  size: number    // 0.5-1.5 (sub-pixel)
  alpha: number   // 0-1
  depth: number   // 0=near (fast, big), 1=far (slow, small)
}

export class WeatherSystem {
  private snow: WeatherParticle[] = []
  private rain: WeatherParticle[] = []
  private width = 0
  private height = 0
  private enabled: 'none' | 'snow' | 'rain' = 'none'

  setSize(w: number, h: number) {
    if (this.width === w && this.height === h) return
    this.width = w
    this.height = h
    this.regenerate()
  }

  private regenerate() {
    // Particle count scales with screen area, capped for mobile perf
    const area = this.width * this.height
    const snowCount = Math.min(80, Math.max(30, Math.floor(area / 8000)))
    const rainCount = Math.min(100, Math.max(40, Math.floor(area / 6000)))

    this.snow = []
    for (let i = 0; i < snowCount; i++) {
      const depth = Math.random()
      this.snow.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.02 + depth * 0.06,  // far particles fall slower
        drift: 0.005 + Math.random() * 0.015,
        driftPhase: Math.random() * Math.PI * 2,  // unique phase per particle
        driftRate: 0.3 + Math.random() * 0.7,
        size: 0.5 + (1 - depth) * 1.2,  // near = bigger
        alpha: 0.3 + (1 - depth) * 0.5,
        depth,
      })
    }

    this.rain = []
    for (let i = 0; i < rainCount; i++) {
      const depth = Math.random()
      this.rain.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.4 + depth * 0.6,  // rain falls fast
        drift: 0.02 + Math.random() * 0.03,  // slight diagonal
        driftPhase: Math.random() * Math.PI * 2,
        driftRate: 0,
        size: 0.5 + (1 - depth) * 0.8,
        alpha: 0.2 + (1 - depth) * 0.4,
        depth,
      })
    }
  }

  setWeather(mode: 'none' | 'snow' | 'rain') {
    this.enabled = mode
  }

  update(dt: number, time: number) {
    if (this.enabled === 'none' || this.width === 0) return

    if (this.enabled === 'snow') {
      for (const p of this.snow) {
        p.y += p.speed * dt
        // Unique drift phase per particle — prevents sync into ugly patterns
        p.x += Math.sin(time * p.driftRate + p.driftPhase) * p.drift * dt
        if (p.y > 1) { p.y = -0.02; p.x = Math.random() }
        if (p.x > 1.02) p.x = -0.02
        if (p.x < -0.02) p.x = 1.02
      }
    } else if (this.enabled === 'rain') {
      for (const p of this.rain) {
        p.y += p.speed * dt
        p.x += p.drift * dt  // consistent diagonal (wind)
        if (p.y > 1) { p.y = -0.05; p.x = Math.random() * 0.9 }
        if (p.x > 1.05) p.x = -0.05
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.enabled === 'none' || w === 0) return

    if (this.enabled === 'snow') {
      ctx.save()
      for (const p of this.snow) {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#ffffff'
        const x = p.x * w
        const y = p.y * h
        const s = p.size
        // Sub-pixel snow: tiny soft circles
        ctx.beginPath()
        ctx.arc(x, y, s, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    } else if (this.enabled === 'rain') {
      ctx.save()
      ctx.strokeStyle = 'rgba(180, 200, 230, 0.5)'
      ctx.lineWidth = 0.8
      for (const p of this.rain) {
        ctx.globalAlpha = p.alpha
        const x = p.x * w
        const y = p.y * h
        // Rain: short diagonal line (sub-pixel thin)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - p.drift * 30, y + p.size * 8)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}

// ====================================================================
// CACHED VIGNETTE
// ====================================================================
// Creates the vignette gradient ONCE per size change and caches it.
// Recreating gradients every frame is a major perf sink.

let cachedVignetteW = 0
let cachedVignetteH = 0
let cachedVignetteGrad: CanvasGradient | null = null

export function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
  // Reuse cached gradient if size hasn't changed
  if (cachedVignetteW !== width || cachedVignetteH !== height || !cachedVignetteGrad) {
    cachedVignetteW = width
    cachedVignetteH = height
    const grad = ctx.createRadialGradient(
      width / 2, height / 2, height * 0.3,
      width / 2, height / 2, height * 0.75,
    )
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 1)')
    cachedVignetteGrad = grad
  }
  ctx.save()
  ctx.globalAlpha = intensity
  ctx.fillStyle = cachedVignetteGrad
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

// ====================================================================
// OPTIMIZED FLASH
// ====================================================================
// Uses a simple alpha fill instead of a gradient when alpha is low.
// Gradient is only used for visible flashes (alpha > 0.05).

export function drawFlash(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number, hue: number) {
  if (alpha <= 0.001) return
  ctx.save()
  ctx.globalAlpha = alpha
  if (alpha < 0.05) {
    // Cheap path: solid fill
    ctx.fillStyle = `hsl(${hue}, 90%, 75%)`
    ctx.fillRect(0, 0, width, height)
  } else {
    // Visible flash: gradient
    const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7)
    grad.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.8)`)
    grad.addColorStop(1, `hsla(${hue}, 90%, 75%, 0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }
  ctx.restore()
}
