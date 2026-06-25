// Juri Han character — inspired by Street Fighter 6 design.
// A stylized cute-game adaptation: chibi proportions, signature purple/pink,
// ox-horn hairstyle, eye patch, spider motif.

import type { CharacterState } from './types'

export function drawJuri(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rotation)
  ctx.scale(c.squashX, c.squashY)

  const w = c.w, h = c.h
  const r = Math.min(w, h) * 0.5  // use min for consistent sizing
  const t = time * 0.001

  // ---- Shadow under feet ----
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(0, r * 1.1, r * 0.7, r * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  // ---- Body (purple/pink bodysuit) ----
  // Torso — shaped like a chibi body
  const bodyGrad = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.8)
  bodyGrad.addColorStop(0, '#7a1f6e')   // dark purple
  bodyGrad.addColorStop(0.5, '#a0288a') // pink-purple
  bodyGrad.addColorStop(1, '#5a1855')   // dark
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.ellipse(0, r * 0.25, r * 0.55, r * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()

  // Yellow accent trim on bodysuit (Juri's signature)
  ctx.strokeStyle = '#f5d020'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-r * 0.3, r * 0.1)
  ctx.lineTo(0, r * 0.05)
  ctx.lineTo(r * 0.3, r * 0.1)
  ctx.stroke()

  // ---- Arms ----
  ctx.fillStyle = '#d8a080'  // skin tone
  // Left arm
  ctx.beginPath()
  ctx.ellipse(-r * 0.5, r * 0.3, r * 0.15, r * 0.35, -0.3, 0, Math.PI * 2)
  ctx.fill()
  // Right arm
  ctx.beginPath()
  ctx.ellipse(r * 0.5, r * 0.3, r * 0.15, r * 0.35, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // Purple arm sleeves (fingerless gloves style)
  ctx.fillStyle = '#5a1855'
  ctx.beginPath()
  ctx.ellipse(-r * 0.5, r * 0.5, r * 0.12, r * 0.15, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(r * 0.5, r * 0.5, r * 0.12, r * 0.15, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // ---- Head (pale skin) ----
  const headGrad = ctx.createRadialGradient(-r * 0.15, -r * 0.55, r * 0.1, 0, -r * 0.5, r * 0.55)
  headGrad.addColorStop(0, '#f5e0d0')
  headGrad.addColorStop(1, '#d8a080')
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.ellipse(0, -r * 0.4, r * 0.48, r * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // ---- Hair: signature ox-horn style (two buns on sides) ----
  ctx.fillStyle = '#2a1050'  // dark purple-black hair

  // Hair bangs (front)
  ctx.beginPath()
  ctx.moveTo(-r * 0.45, -r * 0.5)
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.95, 0, -r * 0.9)
  ctx.quadraticCurveTo(r * 0.3, -r * 0.95, r * 0.45, -r * 0.5)
  ctx.quadraticCurveTo(r * 0.35, -r * 0.6, r * 0.2, -r * 0.55)
  ctx.lineTo(-r * 0.2, -r * 0.55)
  ctx.quadraticCurveTo(-r * 0.35, -r * 0.6, -r * 0.45, -r * 0.5)
  ctx.fill()

  // Left ox-horn bun (pointed upward)
  ctx.beginPath()
  ctx.moveTo(-r * 0.4, -r * 0.7)
  ctx.quadraticCurveTo(-r * 0.85, -r * 1.0, -r * 0.75, -r * 1.35)
  ctx.quadraticCurveTo(-r * 0.6, -r * 1.45, -r * 0.5, -r * 1.2)
  ctx.quadraticCurveTo(-r * 0.45, -r * 0.95, -r * 0.4, -r * 0.7)
  ctx.fill()

  // Right ox-horn bun
  ctx.beginPath()
  ctx.moveTo(r * 0.4, -r * 0.7)
  ctx.quadraticCurveTo(r * 0.85, -r * 1.0, r * 0.75, -r * 1.35)
  ctx.quadraticCurveTo(r * 0.6, -r * 1.45, r * 0.5, -r * 1.2)
  ctx.quadraticCurveTo(r * 0.45, -r * 0.95, r * 0.4, -r * 0.7)
  ctx.fill()

  // Purple highlights on hair buns
  ctx.fillStyle = '#6a2a8a'
  ctx.beginPath()
  ctx.ellipse(-r * 0.65, -r * 1.15, r * 0.06, r * 0.12, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(r * 0.65, -r * 1.15, r * 0.06, r * 0.12, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // ---- Face: eyes ----
  // Left eye (normal — open)
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.ellipse(-r * 0.18, -r * 0.4, r * 0.09, r * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
  // Pupil (purple — Juri's Feng Shui Engine eye)
  ctx.fillStyle = '#c020a0'
  ctx.beginPath()
  ctx.arc(-r * 0.16, -r * 0.4, r * 0.05, 0, Math.PI * 2)
  ctx.fill()
  // Glint
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(-r * 0.17, -r * 0.42, r * 0.02, 0, Math.PI * 2)
  ctx.fill()

  // Right eye — covered by eye patch (Juri's signature)
  ctx.fillStyle = '#1a1a1a'  // black eye patch
  ctx.beginPath()
  ctx.ellipse(r * 0.18, -r * 0.4, r * 0.12, r * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  // Purple glow on eye patch (Feng Shui Engine)
  const eyeGlow = 0.5 + Math.sin(t * 4) * 0.3
  ctx.fillStyle = `rgba(200, 30, 160, ${eyeGlow})`
  ctx.beginPath()
  ctx.arc(r * 0.18, -r * 0.4, r * 0.06, 0, Math.PI * 2)
  ctx.fill()
  // Eye patch strap
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(r * 0.3, -r * 0.4)
  ctx.lineTo(r * 0.45, -r * 0.35)
  ctx.stroke()

  // ---- Mouth: confident smirk ----
  ctx.strokeStyle = '#8a4030'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-r * 0.08, -r * 0.2)
  ctx.quadraticCurveTo(r * 0.05, -r * 0.12, r * 0.15, -r * 0.2)
  ctx.stroke()

  // ---- Spider emblem on chest (Juri's spider motif) ----
  ctx.fillStyle = '#f5d020'  // yellow
  // Small spider body
  ctx.beginPath()
  ctx.arc(0, r * 0.15, r * 0.04, 0, Math.PI * 2)
  ctx.fill()
  // Spider legs
  ctx.strokeStyle = '#f5d020'
  ctx.lineWidth = 1
  for (let i = 0; i < 4; i++) {
    const angle = -0.5 + i * 0.3
    ctx.beginPath()
    ctx.moveTo(0, r * 0.15)
    ctx.lineTo(Math.cos(angle) * r * 0.12, r * 0.15 + Math.sin(angle) * r * 0.1)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, r * 0.15)
    ctx.lineTo(-Math.cos(angle) * r * 0.12, r * 0.15 + Math.sin(angle) * r * 0.1)
    ctx.stroke()
  }

  // ---- Legs ----
  ctx.fillStyle = '#d8a080'
  ctx.beginPath()
  ctx.ellipse(-r * 0.2, r * 0.8, r * 0.15, r * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(r * 0.2, r * 0.8, r * 0.15, r * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()

  // Purple boots
  ctx.fillStyle = '#5a1855'
  ctx.beginPath()
  ctx.ellipse(-r * 0.2, r * 0.95, r * 0.13, r * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(r * 0.2, r * 0.95, r * 0.13, r * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()

  // Yellow trim on boots
  ctx.fillStyle = '#f5d020'
  ctx.fillRect(-r * 0.3, r * 0.88, r * 0.2, 1.5)
  ctx.fillRect(r * 0.1, r * 0.88, r * 0.2, 1.5)

  ctx.restore()
}
