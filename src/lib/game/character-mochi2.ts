// Mochi2 — the cutest cloud-fox ever. Lilac body, floppy ears, huge sparkly eyes, heart nose.

import type { CharacterState, CharacterMood } from './types'

export function drawMochi2(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rotation)
  ctx.scale(c.squashX, c.squashY)

  const w = c.w, h = c.h
  const isHurt = c.mood === 'hurt', isHappy = c.mood === 'joyful', isScared = c.mood === 'scared'
  const bodyLight = isHurt ? '#ffb3ba' : '#e8d5f5'
  const bodyMain = isHurt ? '#ff8a95' : '#c9a0e8'
  const bodyDark = isHurt ? '#e06575' : '#9d6dc4'

  // Fluffy tail
  const tailWiggle = Math.sin(time * 3 + c.armSwing * 0.3) * 0.15
  ctx.save(); ctx.translate(w * 0.32, h * 0.05); ctx.rotate(0.3 + tailWiggle)
  ctx.fillStyle = bodyLight
  ctx.beginPath(); ctx.arc(0, 0, w * 0.18, 0, Math.PI * 2)
  ctx.arc(-w * 0.08, w * 0.04, w * 0.14, 0, Math.PI * 2)
  ctx.arc(w * 0.06, -w * 0.06, w * 0.13, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.5
  ctx.beginPath(); ctx.arc(-w * 0.04, -w * 0.04, w * 0.06, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Floppy ears
  for (const side of [-1, 1]) {
    const bounce = Math.sin(time * 4 + c.armSwing * 0.5 + (side === -1 ? 0 : 0.5)) * 0.1
    ctx.save(); ctx.translate(side * w * 0.22, -h * 0.28); ctx.rotate(side * (0.5 + bounce))
    const eg = ctx.createLinearGradient(0, 0, 0, -h * 0.35)
    eg.addColorStop(0, bodyMain); eg.addColorStop(1, bodyLight)
    ctx.fillStyle = eg
    ctx.beginPath(); ctx.ellipse(0, -h * 0.15, w * 0.08, h * 0.2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffc8dd'
    ctx.beginPath(); ctx.ellipse(0, -h * 0.12, w * 0.04, h * 0.13, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // Body
  const bg = ctx.createRadialGradient(-w * 0.1, -h * 0.15, w * 0.05, 0, 0, w * 0.5)
  bg.addColorStop(0, bodyLight); bg.addColorStop(0.6, bodyMain); bg.addColorStop(1, bodyDark)
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.38, h * 0.4, 0, 0, Math.PI * 2); ctx.fill()

  // Top highlight
  ctx.save(); ctx.globalAlpha = 0.5
  const hg = ctx.createRadialGradient(-w * 0.1, -h * 0.2, 0, -w * 0.1, -h * 0.2, w * 0.25)
  hg.addColorStop(0, 'rgba(255,255,255,0.8)'); hg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hg
  ctx.beginPath(); ctx.ellipse(-w * 0.1, -h * 0.15, w * 0.22, h * 0.18, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Paws
  ctx.fillStyle = bodyLight
  ctx.beginPath(); ctx.ellipse(-w * 0.15, h * 0.28, w * 0.08, h * 0.06, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(w * 0.15, h * 0.28, w * 0.08, h * 0.06, 0, 0, Math.PI * 2); ctx.fill()

  // Face
  const eyeY = -h * 0.05, eyeSp = w * 0.15, eyeSz = w * 0.14
  let eyeOpen = 1
  if (c.blinkPhase === 2) eyeOpen = 0.05
  else if (c.blinkPhase === 1 || c.blinkPhase === 3) eyeOpen = 0.4
  if (isScared) eyeOpen = 1.3
  if (isHappy) eyeOpen = 0.1

  for (const side of [-1, 1]) {
    const ex = side * eyeSp, ey = eyeY
    if (isHappy) {
      ctx.save(); ctx.strokeStyle = '#3a2a4a'; ctx.lineWidth = 3; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(ex, ey + 1, eyeSz * 0.6, Math.PI * 0.2, Math.PI * 0.8, true); ctx.stroke()
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + eyeSz * 0.3, ey - eyeSz * 0.2, 1.5, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    } else if (isHurt) {
      ctx.save(); ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.ellipse(ex, ey, eyeSz * 0.8, eyeSz, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#3a2a4a'
      ctx.beginPath(); ctx.ellipse(ex, ey + eyeSz * 0.2, eyeSz * 0.5, eyeSz * 0.6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#7ec8e3'; ctx.globalAlpha = 0.8
      ctx.beginPath(); ctx.ellipse(ex, ey + eyeSz * 1.2, eyeSz * 0.15, eyeSz * 0.25, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(ex - eyeSz * 0.2, ey, eyeSz * 0.12, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    } else if (eyeOpen > 0.2) {
      ctx.save()
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.ellipse(ex, ey, eyeSz, eyeSz * eyeOpen, 0, 0, Math.PI * 2); ctx.fill()
      const lookX = c.eyeOffsetX * eyeSz * 0.15, lookY = c.eyeOffsetY * eyeSz * 0.15
      ctx.fillStyle = isScared ? '#7ec8e3' : '#a070c8'
      ctx.beginPath(); ctx.ellipse(ex + lookX, ey + lookY, eyeSz * 0.7, eyeSz * 0.7 * eyeOpen, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#3a2a4a'
      ctx.beginPath(); ctx.ellipse(ex + lookX, ey + lookY, eyeSz * 0.45, eyeSz * 0.45 * eyeOpen, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(ex + lookX - eyeSz * 0.2, ey + lookY - eyeSz * 0.2, eyeSz * 0.22, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(ex + lookX + eyeSz * 0.25, ey + lookY + eyeSz * 0.2, eyeSz * 0.1, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 0.7
      ctx.beginPath(); ctx.arc(ex + lookX + eyeSz * 0.2, ey + lookY - eyeSz * 0.3, eyeSz * 0.06, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    } else {
      ctx.save(); ctx.strokeStyle = '#3a2a4a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(ex - eyeSz * 0.5, ey); ctx.lineTo(ex + eyeSz * 0.5, ey); ctx.stroke()
      ctx.restore()
    }
  }

  // Heart nose
  ctx.save(); ctx.fillStyle = '#ff6b9d'
  const ny = h * 0.1, ns = w * 0.04
  ctx.beginPath()
  ctx.moveTo(0, ny + ns * 0.8)
  ctx.bezierCurveTo(-ns * 1.2, ny - ns * 0.2, -ns * 0.5, ny - ns, 0, ny - ns * 0.3)
  ctx.bezierCurveTo(ns * 0.5, ny - ns, ns * 1.2, ny - ns * 0.2, 0, ny + ns * 0.8)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.beginPath(); ctx.ellipse(-ns * 0.3, ny - ns * 0.1, ns * 0.15, ns * 0.1, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Mouth
  const mx = 0, my = h * 0.18
  ctx.save(); ctx.strokeStyle = '#3a2a4a'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (isHappy) {
    ctx.fillStyle = '#3a2a4a'
    ctx.beginPath(); ctx.moveTo(mx - w * 0.08, my)
    ctx.quadraticCurveTo(mx, my + w * 0.1, mx + w * 0.08, my)
    ctx.quadraticCurveTo(mx, my + 0.02, mx - w * 0.08, my); ctx.fill()
    ctx.fillStyle = '#ff8fa3'
    ctx.beginPath(); ctx.ellipse(mx, my + w * 0.06, w * 0.03, w * 0.02, 0, 0, Math.PI * 2); ctx.fill()
  } else if (isHurt) {
    ctx.beginPath(); ctx.moveTo(mx - w * 0.06, my)
    ctx.quadraticCurveTo(mx - w * 0.03, my - 3, mx, my)
    ctx.quadraticCurveTo(mx + w * 0.03, my + 3, mx + w * 0.06, my); ctx.stroke()
  } else if (isScared) {
    ctx.fillStyle = '#3a2a4a'
    ctx.beginPath(); ctx.ellipse(mx, my + 1, w * 0.03, w * 0.04, 0, 0, Math.PI * 2); ctx.fill()
  } else if (c.mood === 'jumping' || c.mood === 'rising') {
    const open = c.mouthOpen
    ctx.fillStyle = '#3a2a4a'
    ctx.beginPath(); ctx.ellipse(mx, my, w * 0.03 * (1 + open * 0.3), w * 0.025 + open * w * 0.03, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.beginPath(); ctx.moveTo(mx - w * 0.05, my - 1)
    ctx.quadraticCurveTo(mx - w * 0.025, my + 2, mx, my + 1)
    ctx.quadraticCurveTo(mx + w * 0.025, my + 2, mx + w * 0.05, my - 1); ctx.stroke()
  }
  ctx.restore()

  // Blush
  const blushI = isHappy ? 1 : isScared ? 0.3 : isHurt ? 0.5 : 0.6
  ctx.save(); ctx.globalAlpha = blushI * 0.7
  for (const side of [-1, 1]) {
    const bx = side * w * 0.22, by = h * 0.08
    const bgr = ctx.createRadialGradient(bx, by, 0, bx, by, w * 0.1)
    bgr.addColorStop(0, '#ff9eb5'); bgr.addColorStop(1, 'rgba(255,158,181,0)')
    ctx.fillStyle = bgr
    ctx.beginPath(); ctx.ellipse(bx, by, w * 0.09, h * 0.06, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()

  ctx.restore()
}
