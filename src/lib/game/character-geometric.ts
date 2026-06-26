// Geometric Character — modern indie-style vector art with rotating shapes.
//
// This character demonstrates geometric/vector art animation:
// - Body is made of simple geometric shapes (triangles, circles, hexagons)
// - Shapes rotate and scale independently for organic movement
// - No pixel art, no sprites — pure canvas vector drawing
// - Inspired by games like Geometry Dash, Thomas Was Alone, Mini Metro

import type { CharacterState } from './types'

export function drawGeometric(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rotation)
  ctx.scale(c.squashX, c.squashY)

  const r = Math.min(c.w, c.h) * 0.5
  const t = time * 0.001
  const isHurt = c.mood === 'hurt'
  const isJumping = c.vy < -100
  const isFalling = c.vy > 200

  // Color palette — cyan/teal geometric
  const main = isHurt ? '#ff3366' : '#00d9c0'
  const accent = isHurt ? '#ff6699' : '#00ffaa'
  const dark = isHurt ? '#cc1144' : '#008877'
  const glow = isHurt ? '#ff4477' : '#00ffdd'

  // Glow effect
  ctx.shadowColor = glow
  ctx.shadowBlur = 15

  // Outer rotating hexagon (body shell)
  ctx.save()
  ctx.rotate(t * 0.5)
  ctx.fillStyle = dark
  drawPolygon(ctx, 0, 0, r * 0.9, 6)
  ctx.fill()

  // Inner hexagon (lighter)
  ctx.fillStyle = main
  drawPolygon(ctx, 0, 0, r * 0.7, 6)
  ctx.fill()
  ctx.restore()

  ctx.shadowBlur = 0

  // Rotating triangle (core) — spins faster when jumping
  ctx.save()
  const spinSpeed = isJumping ? 3 : isFalling ? -1.5 : 1
  ctx.rotate(t * spinSpeed)
  ctx.fillStyle = accent
  drawPolygon(ctx, 0, 0, r * 0.4, 3)
  ctx.fill()

  // Inner dot
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Eyes — two small circles that track movement
  const eyeOffsetX = c.vx * 0.02
  const eyeOffsetY = c.vy * 0.01
  ctx.fillStyle = '#0a0a1a'
  ctx.beginPath()
  ctx.arc(-r * 0.2 + eyeOffsetX, -r * 0.1 + eyeOffsetY, r * 0.1, 0, Math.PI * 2)
  ctx.arc(r * 0.2 + eyeOffsetX, -r * 0.1 + eyeOffsetY, r * 0.1, 0, Math.PI * 2)
  ctx.fill()

  // Eye glints
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(-r * 0.18 + eyeOffsetX, -r * 0.12 + eyeOffsetY, r * 0.03, 0, Math.PI * 2)
  ctx.arc(r * 0.22 + eyeOffsetX, -r * 0.12 + eyeOffsetY, r * 0.03, 0, Math.PI * 2)
  ctx.fill()

  // Orbiting particles — 3 small circles rotating around the body
  for (let i = 0; i < 3; i++) {
    const angle = t * 2 + (i * Math.PI * 2) / 3
    const orbitR = r * 1.1
    const px = Math.cos(angle) * orbitR
    const py = Math.sin(angle) * orbitR
    ctx.fillStyle = accent
    ctx.shadowColor = glow
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(px, py, r * 0.08, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0

  ctx.restore()
}

function drawPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, sides: number) {
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}
