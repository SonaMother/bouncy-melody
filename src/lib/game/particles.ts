// Particle system and floating text effects

import type { GameState, Particle, FloatingText } from './types'

export function spawnBounceParticles(state: GameState, x: number, y: number, hue: number, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const speed = 60 + Math.random() * 180
    const life = 0.5 + Math.random() * 0.4
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life,
      maxLife: life,
      size: 1.5 + Math.random() * 2.5,
      hue: hue + (Math.random() - 0.5) * 30,
      sat: 70 + Math.random() * 25,
      light: 75 + Math.random() * 20,
      alpha: 1,
      shape: Math.random() < 0.5 ? 'circle' : 'spark',
      rotation: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 8,
      gravity: 600,
      drag: 0.92,
    })
  }
}

export function spawnBouncyParticles(state: GameState, x: number, y: number, hue: number) {
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 100 + Math.random() * 260
    const life = 0.7 + Math.random() * 0.5
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      life,
      maxLife: life,
      size: 2 + Math.random() * 3,
      hue: hue + (Math.random() - 0.5) * 60,
      sat: 80 + Math.random() * 20,
      light: 75 + Math.random() * 20,
      alpha: 1,
      shape: 'star',
      rotation: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 12,
      gravity: 300,
      drag: 0.94,
    })
  }
}

export function spawnBoostParticles(state: GameState, x: number, y: number) {
  // Downward cone of firework-like particles
  for (let i = 0; i < 30; i++) {
    const angle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.5
    const speed = 200 + Math.random() * 360
    const life = 0.6 + Math.random() * 0.6
    const hue = 30 + Math.random() * 30 // orange/yellow
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: 2.5 + Math.random() * 3.5,
      hue,
      sat: 90,
      light: 70 + Math.random() * 25,
      alpha: 1,
      shape: 'spark',
      rotation: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 16,
      gravity: 200,
      drag: 0.92,
    })
  }
  // Burst ring
  state.particles.push({
    x, y,
    vx: 0, vy: 0,
    life: 0.5, maxLife: 0.5,
    size: 12,
    hue: 45,
    sat: 90,
    light: 70,
    alpha: 1,
    shape: 'ring',
    rotation: 0,
    vrot: 0,
    gravity: 0,
    drag: 1,
  })
}

export function spawnBreakParticles(state: GameState, x: number, y: number, hue: number) {
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 80 + Math.random() * 160
    const life = 0.6 + Math.random() * 0.4
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      life,
      maxLife: life,
      size: 2 + Math.random() * 2.5,
      hue,
      sat: 50 + Math.random() * 30,
      light: 65 + Math.random() * 25,
      alpha: 1,
      shape: 'square',
      rotation: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 14,
      gravity: 700,
      drag: 0.94,
    })
  }
}

export function spawnTrailParticle(state: GameState, x: number, y: number, hue: number) {
  state.particles.push({
    x: x + (Math.random() - 0.5) * 8,
    y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 20,
    vy: 20 + Math.random() * 30,
    life: 0.4 + Math.random() * 0.3,
    maxLife: 0.7,
    size: 1.5 + Math.random() * 2,
    hue,
    sat: 70,
    light: 80,
    alpha: 0.8,
    shape: 'circle',
    rotation: 0,
    vrot: 0,
    gravity: 50,
    drag: 0.95,
  })
}

export function spawnLandingRing(state: GameState, x: number, y: number, hue: number) {
  state.particles.push({
    x, y,
    vx: 0, vy: 0,
    life: 0.45, maxLife: 0.45,
    size: 8,
    hue,
    sat: 80,
    light: 75,
    alpha: 1,
    shape: 'ring',
    rotation: 0,
    vrot: 0,
    gravity: 0,
    drag: 1,
  })
}

export function spawnGameOverBurst(state: GameState, x: number, y: number, hue: number) {
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 80 + Math.random() * 280
    const life = 0.8 + Math.random() * 0.7
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      life,
      maxLife: life,
      size: 2 + Math.random() * 3.5,
      hue: hue + (Math.random() - 0.5) * 60,
      sat: 70 + Math.random() * 25,
      light: 65 + Math.random() * 25,
      alpha: 1,
      shape: Math.random() < 0.4 ? 'star' : 'circle',
      rotation: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 14,
      gravity: 500,
      drag: 0.93,
    })
  }
}

export function spawnFloatingText(state: GameState, x: number, y: number, text: string, hue: number, size = 18) {
  state.floatingTexts.push({
    x, y,
    vy: -60,
    text,
    life: 1.0,
    maxLife: 1.0,
    hue,
    size,
  })
}

export function updateParticles(state: GameState, dt: number) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]
    p.life -= dt
    if (p.life <= 0) {
      state.particles.splice(i, 1)
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += p.gravity * dt
    p.vx *= Math.pow(p.drag, dt * 60)
    p.vy *= Math.pow(p.drag, dt * 60)
    p.rotation += p.vrot * dt
    p.alpha = p.life / p.maxLife
  }
}

export function updateFloatingTexts(state: GameState, dt: number) {
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const t = state.floatingTexts[i]
    t.life -= dt
    if (t.life <= 0) {
      state.floatingTexts.splice(i, 1)
      continue
    }
    t.y += t.vy * dt
    t.vy *= 0.94
  }
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = p.alpha * (p.shape === 'ring' ? p.alpha : 1)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rotation)
  ctx.globalAlpha = alpha

  if (p.shape === 'ring') {
    const r = p.size + (1 - p.life / p.maxLife) * 40
    ctx.strokeStyle = `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`
    ctx.lineWidth = 3 * alpha
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
  } else if (p.shape === 'circle') {
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size)
    grad.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 1)`)
    grad.addColorStop(0.7, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 0.5)`)
    grad.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, p.size, 0, Math.PI * 2)
    ctx.fill()
  } else if (p.shape === 'star') {
    drawStar(ctx, 0, 0, 5, p.size, p.size * 0.5, `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`)
  } else if (p.shape === 'spark') {
    const len = p.size * 2.5
    const grad = ctx.createLinearGradient(-len, 0, len, 0)
    grad.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 0)`)
    grad.addColorStop(0.5, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 1)`)
    grad.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 0)`)
    ctx.strokeStyle = grad
    ctx.lineWidth = p.size * 0.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-len, 0)
    ctx.lineTo(len, 0)
    ctx.stroke()
  } else if (p.shape === 'square') {
    ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 1)`
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
  }
  ctx.restore()
}

export function drawFloatingText(ctx: CanvasRenderingContext2D, t: FloatingText) {
  const alpha = t.life / t.maxLife
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `bold ${t.size}px 'Baloo 2', 'Nunito', system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Glow
  ctx.shadowColor = `hsl(${t.hue}, 90%, 70%)`
  ctx.shadowBlur = 16
  ctx.fillStyle = `hsl(${t.hue}, 95%, 75%)`
  ctx.fillText(t.text, t.x, t.y)
  ctx.restore()
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  spikes: number, outerR: number, innerR: number,
  color: string,
) {
  let rot = -Math.PI / 2
  const step = Math.PI / spikes
  ctx.beginPath()
  ctx.moveTo(cx, cy - outerR)
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerR
    let y = cy + Math.sin(rot) * outerR
    ctx.lineTo(x, y)
    rot += step
    x = cx + Math.cos(rot) * innerR
    y = cy + Math.sin(rot) * innerR
    ctx.lineTo(x, y)
    rot += step
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.shadowBlur = 0
}

// ===== Pixel & sub-pixel particles =====
// Tiny pixel-art style particles for finer, more detailed effects.

/** Spawn a burst of tiny pixel squares — for impact effects */
export function spawnPixelBurst(state: GameState, x: number, y: number, hue: number, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 40 + Math.random() * 120
    const life = 0.3 + Math.random() * 0.3
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life, maxLife: life,
      size: 1 + Math.random() * 1.5,  // sub-pixel tiny
      hue: hue + (Math.random() - 0.5) * 20,
      sat: 80 + Math.random() * 20,
      light: 80 + Math.random() * 15,
      alpha: 1,
      shape: 'square',
      rotation: 0,
      vrot: 0,
      gravity: 200,
      drag: 0.92,
    })
  }
}

/** Spawn sub-pixel dust — for landing impacts */
export function spawnSubPixelDust(state: GameState, x: number, y: number, hue: number, count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
    const speed = 30 + Math.random() * 60
    const life = 0.4 + Math.random() * 0.3
    state.particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.5,
      life, maxLife: life,
      size: 0.8 + Math.random() * 1.2,  // sub-pixel
      hue,
      sat: 30 + Math.random() * 30,
      light: 85 + Math.random() * 10,
      alpha: 0.8,
      shape: 'circle',
      rotation: 0,
      vrot: 0,
      gravity: 100,
      drag: 0.94,
    })
  }
}

/** Spawn a sparkle trail of tiny pixels — for boost/launch effects */
export function spawnPixelTrail(state: GameState, x: number, y: number, hue: number, count = 5) {
  for (let i = 0; i < count; i++) {
    const angle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.4
    const speed = 20 + Math.random() * 50
    const life = 0.3 + Math.random() * 0.4
    state.particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life, maxLife: life,
      size: 1 + Math.random() * 1,  // tiny
      hue: hue + (Math.random() - 0.5) * 40,
      sat: 90,
      light: 80 + Math.random() * 15,
      alpha: 1,
      shape: Math.random() < 0.5 ? 'square' : 'spark',
      rotation: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 8,
      gravity: 30,
      drag: 0.95,
    })
  }
}

/** Spawn tiny pixel sparks — for bouncy platform hits */
export function spawnPixelSparks(state: GameState, x: number, y: number, hue: number, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 80 + Math.random() * 150
    const life = 0.25 + Math.random() * 0.35
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life, maxLife: life,
      size: 1 + Math.random() * 1.5,  // tiny pixels
      hue: hue + (Math.random() - 0.5) * 30,
      sat: 85 + Math.random() * 15,
      light: 80 + Math.random() * 15,
      alpha: 1,
      shape: 'square',
      rotation: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 10,
      gravity: 300,
      drag: 0.93,
    })
  }
}
