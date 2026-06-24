// Platform rendering, background, and world decoration

import type { GameState, Platform, Cloud, Star } from './types'

const PLATFORM_COLORS: Record<string, { hue: number; sat: number; light: number }> = {
  normal:   { hue: 180, sat: 70, light: 65 },
  bouncy:   { hue: 320, sat: 85, light: 70 },
  moving:   { hue: 200, sat: 75, light: 65 },
  fragile:  { hue: 30,  sat: 70, light: 65 },
  boost:    { hue: 50,  sat: 95, light: 65 },
}

export function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, time: number) {
  if (p.broken) return
  const fadeIn = Math.min(1, (time - p.born) * 4)
  const color = PLATFORM_COLORS[p.type]
  const wobble = Math.sin(p.wobble * 10) * 0.06
  const scaleX = 1 + wobble
  const scaleY = 1 - wobble * 0.7

  ctx.save()
  ctx.globalAlpha = fadeIn
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2)
  ctx.scale(scaleX, scaleY)

  // Wobble decay
  const glow = p.glow

  // Shadow underneath (soft, elongated)
  ctx.save()
  ctx.globalAlpha = 0.28 * fadeIn
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(0, p.h * 0.5 + 5, p.w * 0.44, p.h * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Outer glow
  if (glow > 0.01) {
    ctx.save()
    ctx.shadowColor = `hsl(${color.hue}, ${color.sat}%, 70%)`
    ctx.shadowBlur = 24 * glow
    ctx.fillStyle = `hsl(${color.hue}, ${color.sat}%, ${color.light}%)`
    roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, p.h / 2)
    ctx.fill()
    ctx.restore()
  }

  // Main body (rich multi-stop gradient for 3D depth)
  const grad = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2)
  grad.addColorStop(0, `hsl(${color.hue}, ${color.sat}%, ${color.light + 15}%)`)
  grad.addColorStop(0.3, `hsl(${color.hue}, ${color.sat}%, ${color.light + 5}%)`)
  grad.addColorStop(0.7, `hsl(${color.hue}, ${color.sat}%, ${color.light}%)`)
  grad.addColorStop(1, `hsl(${color.hue}, ${color.sat + 15}%, ${color.light - 22}%)`)
  ctx.fillStyle = grad
  roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, p.h / 2)
  ctx.fill()

  // Inner bevel (top highlight — glossy rim)
  ctx.save()
  ctx.globalAlpha = 0.55
  const hlGrad = ctx.createLinearGradient(0, -p.h / 2, 0, -p.h / 2 + p.h * 0.4)
  hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  hlGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)')
  hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = hlGrad
  roundRect(ctx, -p.w / 2 + 3, -p.h / 2 + 1.5, p.w - 6, p.h * 0.45, p.h * 0.22)
  ctx.fill()
  ctx.restore()

  // Bottom inner shadow (gives depth)
  ctx.save()
  ctx.globalAlpha = 0.3
  const bGrad = ctx.createLinearGradient(0, p.h * 0.2, 0, p.h / 2)
  bGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
  bGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)')
  ctx.fillStyle = bGrad
  roundRect(ctx, -p.w / 2 + 3, p.h * 0.15, p.w - 6, p.h * 0.4, p.h * 0.2)
  ctx.fill()
  ctx.restore()

  // Edge outline (subtle dark rim for definition)
  ctx.strokeStyle = `hsla(${color.hue}, ${color.sat + 20}%, ${color.light - 30}%, 0.5)`
  ctx.lineWidth = 1
  roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, p.h / 2)
  ctx.stroke()

  // Type-specific decoration
  drawPlatformDecorations(ctx, p, color, time)

  ctx.restore()
}

function drawPlatformDecorations(ctx: CanvasRenderingContext2D, p: Platform, color: { hue: number; sat: number; light: number }, time: number) {
  if (p.type === 'bouncy') {
    // Spring coils
    ctx.save()
    ctx.strokeStyle = `hsl(${color.hue}, 80%, 40%)`
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    const coilY = p.h * 0.2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(-p.w * 0.25 + i * p.w * 0.25 - 4, 0)
      ctx.lineTo(-p.w * 0.25 + i * p.w * 0.25 + 4, coilY)
      ctx.lineTo(-p.w * 0.25 + i * p.w * 0.25 - 4, coilY * 2)
      ctx.stroke()
    }
    ctx.restore()
    // Heart on top
    ctx.save()
    ctx.fillStyle = `hsl(${color.hue + 10}, 90%, 75%)`
    drawHeart(ctx, 0, -p.h * 0.4, p.h * 0.4)
    ctx.restore()
  } else if (p.type === 'boost') {
    // Rocket flame
    ctx.save()
    const flameH = p.h * 1.2 + Math.sin(time * 12) * p.h * 0.3
    const flameGrad = ctx.createLinearGradient(0, p.h * 0.4, 0, p.h * 0.4 + flameH)
    flameGrad.addColorStop(0, 'hsl(50, 100%, 75%)')
    flameGrad.addColorStop(0.4, 'hsl(30, 100%, 60%)')
    flameGrad.addColorStop(1, 'hsla(0, 100%, 50%, 0)')
    ctx.fillStyle = flameGrad
    ctx.beginPath()
    ctx.moveTo(-p.w * 0.2, p.h * 0.4)
    ctx.quadraticCurveTo(0, p.h * 0.4 + flameH, p.w * 0.2, p.h * 0.4)
    ctx.closePath()
    ctx.fill()
    // Up arrow
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.moveTo(0, -p.h * 0.4)
    ctx.lineTo(-p.w * 0.12, -p.h * 0.15)
    ctx.lineTo(p.w * 0.12, -p.h * 0.15)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  } else if (p.type === 'fragile') {
    // Crack lines
    ctx.save()
    ctx.strokeStyle = `hsl(${color.hue}, 60%, 40%)`
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.7
    for (let i = 0; i < 3; i++) {
      const x = -p.w * 0.3 + i * p.w * 0.3
      ctx.beginPath()
      ctx.moveTo(x, -p.h * 0.2)
      ctx.lineTo(x + 3, p.h * 0.1)
      ctx.lineTo(x - 2, p.h * 0.25)
      ctx.stroke()
    }
    ctx.restore()
  } else if (p.type === 'moving') {
    // Arrow indicators
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    const dir = p.vx > 0 ? 1 : -1
    for (let i = -1; i <= 1; i++) {
      const ax = i * p.w * 0.18
      ctx.beginPath()
      ctx.moveTo(ax - 3 * dir, -p.h * 0.15)
      ctx.lineTo(ax + 3 * dir, 0)
      ctx.lineTo(ax - 3 * dir, p.h * 0.15)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 10, size / 10)
  ctx.beginPath()
  ctx.moveTo(0, 2)
  ctx.bezierCurveTo(0, -3, -8, -3, -8, 2)
  ctx.bezierCurveTo(-8, 6, 0, 10, 0, 12)
  ctx.bezierCurveTo(0, 10, 8, 6, 8, 2)
  ctx.bezierCurveTo(8, -3, 0, -3, 0, 2)
  ctx.fill()
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ---- Background ----

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  time: number,
) {
  const hue = state.worldHue
  const sat = state.worldSat
  const light = state.worldLight
  const perf = state.perfMode

  // ---- Layer 1: Deep gradient sky (always drawn) ----
  const grad = ctx.createLinearGradient(0, 0, 0, height)
  grad.addColorStop(0, `hsl(${hue}, ${sat}%, ${Math.max(15, light - 30)}%)`)
  grad.addColorStop(0.3, `hsl(${(hue + 15) % 360}, ${sat}%, ${Math.max(18, light - 20)}%)`)
  grad.addColorStop(0.7, `hsl(${(hue + 30) % 360}, ${sat - 5}%, ${Math.max(25, light - 8)}%)`)
  grad.addColorStop(1, `hsl(${(hue + 45) % 360}, ${sat - 10}%, ${Math.min(85, light + 5)}%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // In performance mode, skip all post-processing layers
  if (perf) {
    // Just parallax clouds (minimal)
    for (const c of state.clouds) {
      drawCloud(ctx, c, time, width, height)
    }
    return
  }

  // ---- Layer 2: Animated nebula blobs (drift slowly, always present) ----
  drawNebula(ctx, width, height, time, hue, state.height)

  // ---- Layer 3: Aurora ribbons (fade in from 30m) ----
  if (state.height > 30) {
    const auroraAlpha = Math.min(0.5, (state.height - 30) / 80)
    drawAurora(ctx, width, height, time, hue, auroraAlpha)
  }

  // ---- Layer 4: Stars (fade in from 50m, twinkle) ----
  if (state.height > 50) {
    const starAlpha = Math.min(1, (state.height - 50) / 60)
    drawStars(ctx, state, starAlpha, time)
  }

  // ---- Layer 5: Shooting stars (occasional, from 100m) ----
  if (state.height > 100) {
    drawShootingStars(ctx, width, height, time, state.height)
  }

  // ---- Layer 6: Floating dust motes (always present, subtle) ----
  drawDustMotes(ctx, width, height, time, hue)

  // ---- Layer 7: Floating music notes (from 20m, whimsical) ----
  if (state.height > 20) {
    drawFloatingNotes(ctx, width, height, time, state.height, hue)
  }

  // ---- Layer 8: Parallax clouds ----
  for (const c of state.clouds) {
    drawCloud(ctx, c, time, width, height)
  }

  // ---- Layer 9: Music-reactive pulse glow ----
  const pulse = state.bgPulse
  if (pulse > 0.01) {
    const rgrad = ctx.createRadialGradient(width / 2, height * 0.4, 0, width / 2, height * 0.4, width * 0.7)
    rgrad.addColorStop(0, `hsla(${hue + 30}, 80%, 65%, ${pulse * 0.12})`)
    rgrad.addColorStop(1, `hsla(${hue + 30}, 80%, 65%, 0)`)
    ctx.fillStyle = rgrad
    ctx.fillRect(0, 0, width, height)
  }

  // ---- Layer 10: Vignette edge darkening for depth ----
  const vgrad = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.8)
  vgrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vgrad.addColorStop(1, 'rgba(0, 0, 0, 0.25)')
  ctx.fillStyle = vgrad
  ctx.fillRect(0, 0, width, height)
}

/** Soft nebula blobs that drift slowly — adds depth and movement */
function drawNebula(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, hue: number, altitude: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  // 3 nebula blobs at different positions, drifting slowly
  const blobs = [
    { x: 0.2, y: 0.3, hueOffset: 0, size: 0.4, speed: 0.08 },
    { x: 0.7, y: 0.6, hueOffset: 40, size: 0.5, speed: 0.06 },
    { x: 0.5, y: 0.15, hueOffset: -30, size: 0.35, speed: 0.1 },
  ]

  for (const blob of blobs) {
    const driftX = Math.sin(time * blob.speed) * 30
    const driftY = Math.cos(time * blob.speed * 0.7) * 20
    const cx = blob.x * width + driftX
    const cy = blob.y * height + driftY
    const r = width * blob.size

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    const nebulaHue = (hue + blob.hueOffset) % 360
    grad.addColorStop(0, `hsla(${nebulaHue}, 60%, 50%, 0.15)`)
    grad.addColorStop(0.5, `hsla(${nebulaHue}, 50%, 40%, 0.08)`)
    grad.addColorStop(1, `hsla(${nebulaHue}, 40%, 30%, 0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Stars with twinkle and subtle color variation */
function drawStars(ctx: CanvasRenderingContext2D, state: GameState, alpha: number, time: number) {
  for (const s of state.stars) {
    const tw = 0.4 + 0.6 * Math.sin(time * s.twinkleSpeed + s.twinkle)
    ctx.save()
    ctx.globalAlpha = alpha * s.alpha * tw
    // Subtle warm/cool color variation
    const starHue = (s.twinkle * 60) % 360
    ctx.fillStyle = `hsl(${starHue < 30 ? 200 : 60}, 20%, 95%)`
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
    ctx.shadowBlur = s.size * 3
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
    ctx.fill()

    // Cross sparkle on bigger stars
    if (s.size > 1.5 && tw > 0.7) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${tw * 0.4})`
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(s.x - s.size * 2, s.y)
      ctx.lineTo(s.x + s.size * 2, s.y)
      ctx.moveTo(s.x, s.y - s.size * 2)
      ctx.lineTo(s.x, s.y + s.size * 2)
      ctx.stroke()
    }
    ctx.restore()
  }
}

/** Occasional shooting stars */
function drawShootingStars(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, altitude: number) {
  // Use time to generate occasional shooting stars
  const cycle = 4 // seconds between shooting stars
  const t = time % cycle
  if (t < 0.8) {
    const progress = t / 0.8
    const alpha = Math.sin(progress * Math.PI) * 0.7
    // Deterministic position based on which cycle we're in
    const seed = Math.floor(time / cycle)
    const startX = (seed * 137.5 % width)
    const startY = (seed * 73.3 % (height * 0.5))
    const angle = Math.PI * 0.25 // diagonal
    const len = 60
    const tx = startX + Math.cos(angle) * len * progress * 8
    const ty = startY + Math.sin(angle) * len * progress * 8

    ctx.save()
    ctx.globalAlpha = alpha
    const grad = ctx.createLinearGradient(tx - Math.cos(angle) * 40, ty - Math.sin(angle) * 40, tx, ty)
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.9)')
    ctx.strokeStyle = grad
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(tx - Math.cos(angle) * 40, ty - Math.sin(angle) * 40)
    ctx.lineTo(tx, ty)
    ctx.stroke()

    // Bright head
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(tx, ty, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** Tiny floating dust motes — subtle ambient particles */
function drawDustMotes(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, hue: number) {
  ctx.save()
  for (let i = 0; i < 25; i++) {
    const seed = i * 137.5
    const baseX = (Math.sin(seed) * 0.5 + 0.5) * width
    const baseY = (Math.cos(seed * 1.3) * 0.5 + 0.5) * height
    // Slow drift
    const x = baseX + Math.sin(time * 0.3 + seed) * 15
    const y = (baseY + time * (3 + (i * 7 % 10)) * 0.5) % height
    const tw = 0.3 + 0.7 * Math.sin(time * 0.8 + seed)
    const size = 0.5 + (i % 3) * 0.3

    ctx.globalAlpha = tw * 0.4
    ctx.fillStyle = `hsl(${(hue + 40 + i * 10) % 360}, 40%, 85%)`
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Floating music notes that drift upward — whimsical and progressive */
function drawFloatingNotes(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, altitude: number, hue: number) {
  ctx.save()
  const noteCount = Math.min(8, Math.floor(altitude / 30))
  const notes = ['♪', '♫', '♬', '♩']

  for (let i = 0; i < noteCount; i++) {
    const seed = i * 211.3
    const cycle = 8 + (i % 3) * 2
    const t = (time + seed) % cycle
    const progress = t / cycle
    const x = (Math.sin(seed) * 0.5 + 0.5) * width + Math.sin(time * 0.5 + seed) * 20
    const y = height - progress * height * 1.1
    const alpha = Math.sin(progress * Math.PI) * 0.3
    const size = 12 + (i % 2) * 4
    const noteHue = (hue + 30 + i * 40) % 360

    ctx.globalAlpha = alpha
    ctx.fillStyle = `hsl(${noteHue}, 70%, 75%)`
    ctx.font = `${size}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = `hsl(${noteHue}, 70%, 70%)`
    ctx.shadowBlur = 6
    ctx.fillText(notes[i % notes.length], x, y)
  }
  ctx.restore()
}

function drawAurora(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, hue: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  for (let band = 0; band < 3; band++) {
    const bandHue = (hue + band * 60) % 360
    const yBase = height * 0.15 + band * 40
    ctx.beginPath()
    ctx.moveTo(0, yBase)
    for (let x = 0; x <= width; x += 20) {
      const y = yBase + Math.sin(x * 0.005 + time * 0.5 + band) * 30 + Math.sin(x * 0.01 + time * 0.3) * 15
      ctx.lineTo(x, y)
    }
    ctx.lineTo(width, yBase - 80)
    for (let x = width; x >= 0; x -= 20) {
      const y = yBase - 80 + Math.sin(x * 0.005 + time * 0.5 + band + 1) * 25
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, yBase - 80, 0, yBase)
    grad.addColorStop(0, `hsla(${bandHue}, 80%, 60%, 0)`)
    grad.addColorStop(0.5, `hsla(${bandHue}, 80%, 60%, 0.5)`)
    grad.addColorStop(1, `hsla(${bandHue}, 80%, 60%, 0)`)
    ctx.fillStyle = grad
    ctx.fill()
  }
  ctx.restore()
}

export function drawCloud(ctx: CanvasRenderingContext2D, c: Cloud, time: number, width: number, height: number) {
  ctx.save()
  ctx.globalAlpha = c.alpha
  ctx.translate(c.x, c.y)
  ctx.scale(c.scale, c.scale)

  // Soft cloud body
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 40)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.6)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = grad

  // 5 puffs
  const puffs = [
    { x: -25, y: 5, r: 18 },
    { x: -8, y: -8, r: 22 },
    { x: 12, y: -3, r: 20 },
    { x: 28, y: 6, r: 16 },
    { x: 0, y: 8, r: 24 },
  ]
  for (const p of puffs) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ---- World decoration: ambient floating bits ----

export function drawAmbientParticles(ctx: CanvasRenderingContext2D, state: GameState, time: number, width: number, height: number) {
  // Deprecated — dust motes are now drawn in drawBackground
  // Kept for backward compatibility but does nothing
}

export function updateClouds(state: GameState, dt: number, width: number, height: number) {
  for (const c of state.clouds) {
    c.x += c.speed * 8 * dt
    if (c.x > width + 60) c.x = -60
    if (c.x < -60) c.x = width + 60
  }
}

export function initClouds(width: number, height: number): Cloud[] {
  const clouds: Cloud[] = []
  for (let i = 0; i < 8; i++) {
    clouds.push({
      x: Math.random() * width,
      y: Math.random() * height * 0.7,
      scale: 0.6 + Math.random() * 0.8,
      speed: 0.2 + Math.random() * 0.5,
      alpha: 0.3 + Math.random() * 0.3,
      seed: Math.random() * 1000,
    })
  }
  return clouds
}

export function initStars(width: number, height: number): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 0.8 + Math.random() * 2,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 2,
      alpha: 0.5 + Math.random() * 0.5,
    })
  }
  return stars
}

// ---- Vignette + flash overlays ----

export function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, height * 0.3,
    width / 2, height / 2, height * 0.75,
  )
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
  grad.addColorStop(1, `rgba(0, 0, 0, ${intensity})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
}

export function drawFlash(ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number, hue: number) {
  if (alpha <= 0.001) return
  ctx.save()
  ctx.globalAlpha = alpha
  const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7)
  grad.addColorStop(0, `hsla(${hue}, 90%, 75%, 0.8)`)
  grad.addColorStop(1, `hsla(${hue}, 90%, 75%, 0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
