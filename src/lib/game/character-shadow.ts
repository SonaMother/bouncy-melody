// Shadow Character — minimalist silhouette with glowing eyes.
//
// This character demonstrates silhouette/shadow art technique:
// - Body is a pure black silhouette (no internal details visible)
// - Only glowing eyes and an outline are visible
// - Body morphs shape based on state (blob when idle, stretched when jumping)
// - Creates a mysterious, dark aesthetic
// - Inspired by games like Limbo, Hollow Knight silhouettes

import type { CharacterState } from './types'

export function drawShadow(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rotation)
  ctx.scale(c.squashX, c.squashY)

  const r = Math.min(c.w, c.h) * 0.5
  const t = time * 0.001
  const isHurt = c.mood === 'hurt'
  const isJumping = c.vy < -100
  const isFalling = c.vy > 200

  // Glow color changes with state
  const glowColor = isHurt ? '#ff2244' : isJumping ? '#ffaa00' : isFalling ? '#66aaff' : '#aa66ff'

  // Shadow aura (subtle glow around body)
  const auraGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.5)
  auraGrad.addColorStop(0, `${glowColor}33`)
  auraGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = auraGrad
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2)
  ctx.fill()

  // Body — pure black silhouette with organic blob shape
  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath()
  // Use sine waves to create organic blob outline
  const points = 16
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2
    // Vary radius with sine for blob shape
    const wobble = Math.sin(angle * 3 + t * 2) * r * 0.08
    const radius = r * 0.85 + wobble
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()

  // Thin glowing outline
  ctx.strokeStyle = glowColor
  ctx.lineWidth = 1.5
  ctx.shadowColor = glowColor
  ctx.shadowBlur = 10
  ctx.stroke()
  ctx.shadowBlur = 0

  // Eyes — two glowing ovals
  const eyeY = -r * 0.15
  const eyeSpacing = r * 0.3
  const eyeW = r * 0.12
  const eyeH = r * 0.18

  // Eye glow
  ctx.shadowColor = glowColor
  ctx.shadowBlur = 12
  ctx.fillStyle = glowColor
  ctx.beginPath()
  ctx.ellipse(-eyeSpacing, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2)
  ctx.ellipse(eyeSpacing, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2)
  ctx.fill()

  // Bright eye centers
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(-eyeSpacing, eyeY, eyeW * 0.4, eyeH * 0.4, 0, 0, Math.PI * 2)
  ctx.ellipse(eyeSpacing, eyeY, eyeW * 0.4, eyeH * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Pupils that look in direction of movement
  const pupilX = Math.max(-eyeW * 0.3, Math.min(eyeW * 0.3, c.vx * 0.01))
  const pupilY = Math.max(-eyeH * 0.3, Math.min(eyeH * 0.3, c.vy * 0.005))
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.ellipse(-eyeSpacing + pupilX, eyeY + pupilY, eyeW * 0.2, eyeH * 0.2, 0, 0, Math.PI * 2)
  ctx.ellipse(eyeSpacing + pupilX, eyeY + pupilY, eyeW * 0.2, eyeH * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Wispy tail/shadow trail below body when falling
  if (isFalling) {
    ctx.fillStyle = `${glowColor}22`
    ctx.beginPath()
    ctx.moveTo(-r * 0.3, r * 0.6)
    ctx.quadraticCurveTo(0, r * 1.2 + Math.sin(t * 8) * 5, r * 0.3, r * 0.6)
    ctx.fill()
  }

  ctx.restore()
}
