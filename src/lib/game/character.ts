// Character renderer — seven playable characters.
//
// Design philosophy: each character has a clean, iconic silhouette with
// just enough detail to be recognizable. Minimalism over clutter.
//
// - Pip:    springy pink blob with a glowing antenna (the original)
// - Pixel:  retro mint robot with a screen face
// - Mochi:  orange cat with simple purple headphones
// - Yuki:   soft white snow cat with a tiny blue scarf
// - Kuro:   sleek dark night cat with glowing cyan eyes
// - Bongo:  the legendary Bongo Cat (gray, paws forward)
// - Popcat: the iconic Pop Cat (cream, surprised O mouth)
//
// All share: mood-driven expressions, squash & stretch, blinking, pupil tracking.

import type { CharacterState, CharacterMood, CharacterType } from './types'
import { is3DCharacter } from './types'
import { draw3DCharacter } from './character3d-render'
import { drawLumina } from './character-lumina'
import { drawMochi2 } from './character-mochi2'
import { drawJuri } from './character-juri'
import { drawPixelBot } from './character-pixelbot'
import { drawRagdoll } from './character-ragdoll'
import { drawGeometric } from './character-geometric'
import { drawShadow } from './character-shadow'
import { loadModel3D, renderModel3D, type Model3DState } from './character3d-imported'
import { createRagdoll, updateRagdollPhysics, drawPhysicsRagdoll, removeRagdoll, type PhysicsRagdoll } from './character-matter-ragdoll'

export function drawCharacter(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  // 3D characters use a separate rendering engine
  if (is3DCharacter(c.type)) {
    draw3DCharacter(ctx, c, time)
    return
  }

  // Lumina energy engine
  if (c.type === 'spark') {
    drawLumina(ctx, c, time)
    return
  }

  // Mochi2 cloud-fox
  if (c.type === 'mochi2') {
    drawMochi2(ctx, c, time)
    return
  }

  // Juri Han (Street Fighter 6 inspired)
  if (c.type === 'juri') {
    drawJuri(ctx, c, time)
    return
  }

  // PixelBot — pixel-art animated sprite
  if (c.type === 'pixelbot') {
    drawPixelBot(ctx, c, time)
    return
  }

  // Ragdoll — spring-physics body parts
  if (c.type === 'ragdoll') {
    drawRagdoll(ctx, c, time)
    return
  }

  // Geometric — vector art with rotating shapes
  if (c.type === 'geometric') {
    drawGeometric(ctx, c, time)
    return
  }

  // Shadow — silhouette with glowing eyes
  if (c.type === 'shadow') {
    drawShadow(ctx, c, time)
    return
  }

  // Imported 3D models (Fox, Robot) — rendered via Three.js, composited onto Canvas2D
  if (c.type === 'fox3d' || c.type === 'robot3d') {
    drawImported3D(ctx, c, time)
    return
  }

  // MatterBot — TRUE physics ragdoll via Matter.js
  if (c.type === 'matterbot') {
    drawMatterBot(ctx, c, time)
    return
  }

  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rotation)
  const sx = c.squashX
  const sy = c.squashY
  ctx.scale(sx, sy)

  const w = c.w
  const h = c.h

  switch (c.type) {
    case 'pip':     drawPip(ctx, c, time, w, h); break
    case 'pixel':   drawPixel(ctx, c, time, w, h); break
    case 'yuki':    drawYuki(ctx, c, time, w, h); break
    case 'kuro':    drawKuro(ctx, c, time, w, h); break
    case 'bongo':   drawBongo(ctx, c, time, w, h); break
    case 'popcat':  drawPopcat(ctx, c, time, w, h); break
    case 'neon':    drawNeon(ctx, c, time, w, h); break
    case 'mochi':
    default:        drawMochi(ctx, c, time, w, h); break
  }

  ctx.restore()
}

// ===== Shared helpers =====

/** Per-character base body hue (independent of mood). */
function getCharacterBaseHue(type: CharacterType): number {
  switch (type) {
    case 'pip':    return 340 // pink
    case 'pixel':  return 165 // mint teal
    case 'mochi':  return 25  // warm orange
    case 'yuki':   return 210 // soft blue-white (handled specially)
    case 'kuro':   return 240 // dark blue-black (handled specially)
    case 'bongo':  return 30  // warm gray-tan
    case 'popcat': return 35  // cream/tan
    case 'neon':   return 290 // electric magenta-purple
    case 'blob3d': return 280 // purple
    case 'cat3d':  return 20  // orange
    case 'spark':  return 180 // cyan
    case 'mochi2': return 280 // lilac
    case 'juri':   return 300 // purple-pink (Juri's signature color)
    case 'pixelbot': return 210 // blue (robot)
    case 'ragdoll': return 25 // orange (ragdoll)
    case 'geometric': return 170 // teal (geometric)
    case 'shadow': return 270 // purple (shadow)
    case 'fox3d': return 25 // orange (fox)
    case 'robot3d': return 210 // blue (robot)
    case 'matterbot': return 25 // orange (matter physics)
    default:       return 340 // fallback pink
  }
}

/** Compute body hue for mood-based color shifts (hurt = red, dizzy = rainbow). */
function getEffectiveHue(type: CharacterType, mood: CharacterMood, time: number): number {
  if (mood === 'hurt') return 0
  if (mood === 'dizzy') return 280 + Math.sin(time * 8) * 60
  return getCharacterBaseHue(type)
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

// ====================================================================
// PIP — springy pink blob with a glowing antenna (the original)
// ====================================================================

function drawPip(ctx: CanvasRenderingContext2D, c: CharacterState, time: number, w: number, h: number) {
  const bodyHue = getEffectiveHue('pip', c.mood, time)

  // Body — blob shape with gradient
  ctx.save()
  ctx.shadowColor = `hsl(${bodyHue}, 95%, 70%)`
  ctx.shadowBlur = 22
  const bodyGrad = ctx.createRadialGradient(-w * 0.18, -h * 0.25, w * 0.05, 0, 0, w * 0.6)
  bodyGrad.addColorStop(0, `hsl(${bodyHue}, 90%, 82%)`)
  bodyGrad.addColorStop(0.55, `hsl(${bodyHue}, 85%, 68%)`)
  bodyGrad.addColorStop(1, `hsl(${bodyHue}, 80%, 55%)`)
  ctx.fillStyle = bodyGrad
  drawBlobShape(ctx, w, h)
  ctx.fill()
  ctx.restore()

  // Rim highlight
  ctx.save()
  ctx.globalAlpha = 0.4
  const rim = ctx.createRadialGradient(-w * 0.25, -h * 0.35, 0, -w * 0.25, -h * 0.35, w * 0.5)
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = rim
  drawBlobShape(ctx, w, h)
  ctx.fill()
  ctx.restore()

  // Bottom shadow
  ctx.save()
  ctx.globalAlpha = 0.18
  const shadow = ctx.createRadialGradient(0, h * 0.25, 0, 0, h * 0.25, w * 0.55)
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0.6)')
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = shadow
  drawBlobShape(ctx, w, h)
  ctx.fill()
  ctx.restore()

  // Antenna
  drawPipAntenna(ctx, w, h, c, time, bodyHue)
  // Ears (nubs)
  drawPipEars(ctx, w, h, c, bodyHue)
  // Arms
  drawSimpleArms(ctx, w, h, c, bodyHue, time)
  // Face (round eyes, not cat-style)
  drawPipFace(ctx, w, h, c, time)
  drawBlush(ctx, w, h, c)
}

function drawBlobShape(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath()
  ctx.moveTo(-w * 0.35, -h * 0.35)
  ctx.bezierCurveTo(-w * 0.5, -h * 0.5, w * 0.5, -h * 0.5, w * 0.35, -h * 0.35)
  ctx.bezierCurveTo(w * 0.5, -h * 0.1, w * 0.5, h * 0.3, w * 0.32, h * 0.42)
  ctx.bezierCurveTo(w * 0.2, h * 0.5, -w * 0.2, h * 0.5, -w * 0.32, h * 0.42)
  ctx.bezierCurveTo(-w * 0.5, h * 0.3, -w * 0.5, -h * 0.1, -w * 0.35, -h * 0.35)
  ctx.closePath()
}

function drawPipAntenna(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number, bodyHue: number) {
  const baseX = 0
  const baseY = -h * 0.42
  const wave = Math.sin(time * 4 + c.antennaWave) * 0.15 + c.vx * 0.001
  const tipX = baseX + wave * w * 0.6
  const tipY = baseY - h * 0.45

  ctx.save()
  ctx.strokeStyle = `hsl(${bodyHue}, 80%, 50%)`
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.quadraticCurveTo(baseX + wave * w * 0.3, baseY - h * 0.2, tipX, tipY)
  ctx.stroke()

  const tipGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 7)
  tipGrad.addColorStop(0, `hsl(${bodyHue + 20}, 95%, 85%)`)
  tipGrad.addColorStop(0.6, `hsl(${bodyHue + 20}, 90%, 65%)`)
  tipGrad.addColorStop(1, `hsla(${bodyHue + 20}, 90%, 60%, 0)`)
  ctx.fillStyle = tipGrad
  ctx.shadowColor = `hsl(${bodyHue + 20}, 95%, 70%)`
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(tipX, tipY, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPipEars(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, bodyHue: number) {
  const wiggle = Math.sin(c.earWiggle) * 0.1
  for (const side of [-1, 1]) {
    ctx.save()
    const ex = side * w * 0.3
    const ey = -h * 0.4
    ctx.translate(ex, ey)
    ctx.rotate(side * (0.3 + wiggle))
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.18)
    grad.addColorStop(0, `hsl(${bodyHue}, 90%, 78%)`)
    grad.addColorStop(1, `hsl(${bodyHue}, 80%, 58%)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.13, h * 0.10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `hsla(${bodyHue + 10}, 85%, 85%, 0.7)`
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.07, h * 0.05, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawPipFace(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number) {
  const eyeY = -h * 0.08
  const eyeSpacing = w * 0.18
  const eyeBaseSize = w * 0.13

  let eyeOpenAmount = 1
  if (c.blinkPhase === 2) eyeOpenAmount = 0.05
  else if (c.blinkPhase === 1 || c.blinkPhase === 3) eyeOpenAmount = 0.4
  if (c.mood === 'hurt') eyeOpenAmount = 0.1
  if (c.mood === 'scared') eyeOpenAmount = 1.2
  if (c.mood === 'joyful') eyeOpenAmount = 0.15

  for (const side of [-1, 1]) {
    const ex = side * eyeSpacing
    const ey = eyeY

    if (eyeOpenAmount > 0.2 && c.mood !== 'joyful') {
      ctx.save()
      const grad = ctx.createRadialGradient(ex - 2, ey - 2, 1, ex, ey, eyeBaseSize)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(1, '#f0f4ff')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.ellipse(ex, ey, eyeBaseSize, eyeBaseSize * eyeOpenAmount, 0, 0, Math.PI * 2)
      ctx.fill()
      if (c.mood !== 'hurt') {
        const pupilSize = eyeBaseSize * 0.55 * (c.mood === 'scared' ? 0.7 : 1)
        const lookX = c.eyeOffsetX * eyeBaseSize * 0.3
        const lookY = c.eyeOffsetY * eyeBaseSize * 0.3
        ctx.fillStyle = '#1a1a2e'
        ctx.beginPath()
        ctx.ellipse(ex + lookX, ey + lookY, pupilSize, pupilSize * eyeOpenAmount, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        ctx.beginPath()
        ctx.arc(ex + lookX - pupilSize * 0.3, ey + lookY - pupilSize * 0.3, pupilSize * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    } else if (c.mood === 'joyful') {
      ctx.save()
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(ex, ey + 2, eyeBaseSize * 0.7, Math.PI * 0.15, Math.PI * 0.85, true)
      ctx.stroke()
      ctx.restore()
    } else if (c.mood === 'hurt') {
      ctx.save()
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - eyeBaseSize * 0.6, ey - eyeBaseSize * 0.6)
      ctx.lineTo(ex + eyeBaseSize * 0.6, ey + eyeBaseSize * 0.6)
      ctx.moveTo(ex + eyeBaseSize * 0.6, ey - eyeBaseSize * 0.6)
      ctx.lineTo(ex - eyeBaseSize * 0.6, ey + eyeBaseSize * 0.6)
      ctx.stroke()
      ctx.restore()
    } else {
      ctx.save()
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - eyeBaseSize * 0.6, ey)
      ctx.lineTo(ex + eyeBaseSize * 0.6, ey)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Simple smile mouth
  const mx = 0
  const my = h * 0.18
  ctx.save()
  ctx.strokeStyle = '#2a1a2e'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  if (c.mood === 'hurt') {
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.12, my)
    ctx.quadraticCurveTo(mx - w * 0.06, my - 5, mx, my)
    ctx.quadraticCurveTo(mx + w * 0.06, my + 5, mx + w * 0.12, my)
    ctx.stroke()
  } else if (c.mood === 'joyful') {
    ctx.fillStyle = '#2a1a2e'
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.15, my - 2)
    ctx.quadraticCurveTo(mx, my + w * 0.15, mx + w * 0.15, my - 2)
    ctx.quadraticCurveTo(mx, my + 4, mx - w * 0.15, my - 2)
    ctx.fill()
  } else if (c.mood === 'jumping' || c.mood === 'rising') {
    const open = c.mouthOpen
    ctx.fillStyle = '#2a1a2e'
    ctx.beginPath()
    ctx.ellipse(mx, my, w * 0.05 * (1 + open * 0.5), w * 0.04 + open * w * 0.05, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.10, my)
    ctx.quadraticCurveTo(mx, my + 5, mx + w * 0.10, my)
    ctx.stroke()
  }
  ctx.restore()
}

// ====================================================================
// PIXEL — retro mint robot with a screen face
// ====================================================================

function drawPixel(ctx: CanvasRenderingContext2D, c: CharacterState, time: number, w: number, h: number) {
  const bodyHue = 165 // mint teal

  // Antenna with LED cube
  drawPixelAntenna(ctx, w, h, c, time, bodyHue)

  // Body — rounded square
  ctx.save()
  ctx.shadowColor = `hsl(${bodyHue}, 90%, 60%)`
  ctx.shadowBlur = 22
  const bodyGrad = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5)
  bodyGrad.addColorStop(0, `hsl(${bodyHue}, 70%, 70%)`)
  bodyGrad.addColorStop(0.5, `hsl(${bodyHue}, 75%, 55%)`)
  bodyGrad.addColorStop(1, `hsl(${bodyHue}, 80%, 40%)`)
  ctx.fillStyle = bodyGrad
  roundRect(ctx, -w * 0.4, -h * 0.4, w * 0.8, h * 0.8, w * 0.15)
  ctx.fill()
  ctx.restore()

  // Body highlight
  ctx.save()
  ctx.globalAlpha = 0.35
  const rim = ctx.createLinearGradient(0, -h * 0.4, 0, -h * 0.1)
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = rim
  roundRect(ctx, -w * 0.35, -h * 0.38, w * 0.7, h * 0.3, w * 0.1)
  ctx.fill()
  ctx.restore()

  // Bolts on the sides
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.fillStyle = `hsl(${bodyHue}, 30%, 35%)`
    ctx.beginPath()
    ctx.arc(side * w * 0.42, 0, w * 0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `hsl(${bodyHue}, 50%, 55%)`
    ctx.beginPath()
    ctx.arc(side * w * 0.42, 0, w * 0.025, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Screen face
  drawPixelScreen(ctx, w, h, c, time)

  // Robot arms (rectangular)
  drawPixelArms(ctx, w, h, c, bodyHue, time)

  // Chest speaker grill
  ctx.save()
  ctx.fillStyle = `hsla(${bodyHue}, 30%, 25%, 0.6)`
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(-w * 0.08 + i * w * 0.08, h * 0.22, w * 0.04, w * 0.04)
  }
  ctx.restore()
}

function drawPixelAntenna(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number, bodyHue: number) {
  const baseX = 0
  const baseY = -h * 0.4
  const wave = Math.sin(time * 3 + c.antennaWave) * 0.1
  const tipX = baseX + wave * w * 0.3
  const tipY = baseY - h * 0.3

  ctx.save()
  ctx.strokeStyle = `hsl(${bodyHue}, 50%, 40%)`
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  // LED cube — pulses
  const pulse = 0.6 + 0.4 * Math.sin(time * 5)
  const cubeSize = w * 0.1
  ctx.save()
  ctx.translate(tipX, tipY)
  ctx.rotate(time * 0.5)
  ctx.shadowColor = `hsl(60, 100%, 70%)`
  ctx.shadowBlur = 12 * pulse
  const cubeGrad = ctx.createLinearGradient(-cubeSize / 2, -cubeSize / 2, cubeSize / 2, cubeSize / 2)
  cubeGrad.addColorStop(0, `hsl(60, 100%, 80%)`)
  cubeGrad.addColorStop(1, `hsl(40, 100%, 55%)`)
  ctx.fillStyle = cubeGrad
  ctx.fillRect(-cubeSize / 2, -cubeSize / 2, cubeSize, cubeSize)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillRect(-cubeSize / 2 + 1, -cubeSize / 2 + 1, cubeSize / 3, cubeSize / 3)
  ctx.restore()
  ctx.restore()
}

function drawPixelScreen(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number) {
  // Dark screen
  ctx.save()
  const screenGrad = ctx.createRadialGradient(0, -h * 0.05, 0, 0, -h * 0.05, w * 0.35)
  screenGrad.addColorStop(0, '#0a1a14')
  screenGrad.addColorStop(1, '#000000')
  ctx.fillStyle = screenGrad
  roundRect(ctx, -w * 0.32, -h * 0.3, w * 0.64, h * 0.42, w * 0.08)
  ctx.fill()

  // Scanlines (subtle)
  ctx.globalAlpha = 0.06
  ctx.fillStyle = '#00ff88'
  for (let y = -h * 0.3; y < h * 0.12; y += 2) {
    ctx.fillRect(-w * 0.32, y, w * 0.64, 1)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // Pixel eyes
  const eyeY = -h * 0.1
  const eyeSpacing = w * 0.14
  const pixelSize = w * 0.025
  const eyeColor = '#5cffa8'

  let eyeOpenAmount = 1
  if (c.blinkPhase === 2) eyeOpenAmount = 0
  else if (c.blinkPhase === 1 || c.blinkPhase === 3) eyeOpenAmount = 0.5
  if (c.mood === 'hurt') eyeOpenAmount = 0.2
  if (c.mood === 'scared') eyeOpenAmount = 1.2
  if (c.mood === 'joyful') eyeOpenAmount = 0.3

  for (const side of [-1, 1]) {
    const ex = side * eyeSpacing
    const ey = eyeY

    if (c.mood === 'joyful') {
      ctx.save()
      ctx.fillStyle = eyeColor
      ctx.shadowColor = eyeColor
      ctx.shadowBlur = 6
      drawPixelGrid(ctx, ex, ey, [
        [0, 1, 0],
        [1, 0, 1],
      ], pixelSize)
      ctx.restore()
    } else if (c.mood === 'hurt') {
      ctx.save()
      ctx.fillStyle = '#ff5050'
      ctx.shadowColor = '#ff5050'
      ctx.shadowBlur = 6
      drawPixelGrid(ctx, ex, ey, [
        [1, 0, 1],
        [0, 1, 0],
        [1, 0, 1],
      ], pixelSize)
      ctx.restore()
    } else if (eyeOpenAmount < 0.3) {
      ctx.save()
      ctx.fillStyle = eyeColor
      ctx.shadowColor = eyeColor
      ctx.shadowBlur = 4
      drawPixelGrid(ctx, ex, ey, [[1, 1, 1]], pixelSize)
      ctx.restore()
    } else {
      ctx.save()
      ctx.fillStyle = eyeColor
      ctx.shadowColor = eyeColor
      ctx.shadowBlur = 8
      const lookX = Math.round(c.eyeOffsetX * 1.5) * pixelSize
      const lookY = Math.round(c.eyeOffsetY * 1.5) * pixelSize
      drawPixelGrid(ctx, ex + lookX, ey + lookY, [
        [1, 1],
        [1, 1],
      ], pixelSize)
      ctx.restore()
    }
  }

  // Pixel mouth
  const mx = 0
  const my = h * 0.05
  ctx.save()
  ctx.fillStyle = eyeColor
  ctx.shadowColor = eyeColor
  ctx.shadowBlur = 6

  if (c.mood === 'joyful') {
    drawPixelGrid(ctx, mx, my, [
      [1, 0, 1],
      [1, 1, 1],
    ], pixelSize)
  } else if (c.mood === 'hurt') {
    drawPixelGrid(ctx, mx, my, [
      [0, 1, 0],
      [1, 0, 1],
    ], pixelSize)
  } else if (c.mood === 'jumping' || c.mood === 'rising') {
    const open = c.mouthOpen
    if (open > 0.3) {
      drawPixelGrid(ctx, mx, my, [
        [1, 1, 1],
        [1, 0, 1],
        [1, 1, 1],
      ], pixelSize)
    } else {
      drawPixelGrid(ctx, mx, my, [[1, 1]], pixelSize)
    }
  } else {
    drawPixelGrid(ctx, mx, my, [[1, 1]], pixelSize)
  }
  ctx.restore()
}

function drawPixelGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, grid: number[][], pixelSize: number) {
  const w = grid[0].length
  const h = grid.length
  const startX = cx - (w * pixelSize) / 2
  const startY = cy - (h * pixelSize) / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) {
        ctx.fillRect(startX + x * pixelSize, startY + y * pixelSize, pixelSize, pixelSize)
      }
    }
  }
}

function drawPixelArms(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, bodyHue: number, time: number) {
  const swing = Math.sin(c.armSwing + time * 2) * 0.4
  for (const side of [-1, 1]) {
    ctx.save()
    const ax = side * w * 0.42
    const ay = h * 0.0
    ctx.translate(ax, ay)
    let angle = side * (0.4 + swing)
    if (c.mood === 'jumping' || c.mood === 'rising') angle = side * (-0.5 + swing)
    if (c.mood === 'falling') angle = side * (1.0 + swing)
    if (c.mood === 'scared') angle = side * (-0.8)
    if (c.mood === 'joyful') angle = side * (-1.2 + swing * 0.5)
    if (c.mood === 'hurt') angle = side * 1.4
    ctx.rotate(angle)
    ctx.fillStyle = `hsl(${bodyHue}, 70%, 50%)`
    roundRect(ctx, 0, -h * 0.06, side * w * 0.25, h * 0.12, h * 0.04)
    ctx.fill()
    ctx.fillStyle = `hsl(${bodyHue}, 80%, 70%)`
    ctx.fillRect(side * w * 0.22 - w * 0.05, -h * 0.06, w * 0.1, h * 0.12)
    ctx.restore()
  }
}

// ====================================================================
// BONGO — the legendary Bongo Cat (gray, paws forward on imaginary drums)
// ====================================================================

function drawBongo(ctx: CanvasRenderingContext2D, c: CharacterState, time: number, w: number, h: number) {
  const bodyHue = 30 // warm gray-tan

  // Body — round, slightly wider (chonky cat)
  ctx.save()
  ctx.shadowColor = `hsla(30, 15%, 50%, 0.5)`
  ctx.shadowBlur = 18
  const bodyGrad = ctx.createRadialGradient(-w * 0.15, -h * 0.2, w * 0.05, 0, 0, w * 0.5)
  bodyGrad.addColorStop(0, '#d8d0c8')
  bodyGrad.addColorStop(0.7, '#a8a098')
  bodyGrad.addColorStop(1, '#787068')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Rim highlight
  ctx.save()
  ctx.globalAlpha = 0.35
  const rim = ctx.createRadialGradient(-w * 0.2, -h * 0.25, 0, -w * 0.2, -h * 0.25, w * 0.4)
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Ears (rounded, gray)
  drawBongoEars(ctx, w, h, c)

  // Paws forward (the iconic bongo cat pose) — two paws at the bottom front
  drawBongoPaws(ctx, w, h, c, time)

  // Face — simple round eyes, small mouth, pink nose
  drawBongoFace(ctx, w, h, c, time)

  drawBlush(ctx, w, h, c)
}

function drawBongoEars(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState) {
  const wiggle = Math.sin(c.earWiggle) * 0.06
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * w * 0.3, -h * 0.35)
    ctx.rotate(side * (0.1 + wiggle))
    // Rounded ear
    ctx.fillStyle = '#a8a098'
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.1, h * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    // Inner ear
    ctx.fillStyle = '#ffc8d0'
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.05, h * 0.07, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawBongoPaws(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number) {
  // Two paws at the front bottom — the iconic bongo pose
  // They bob up and down as if playing bongos
  const bob = Math.sin(time * 6) * 2
  const bob2 = Math.sin(time * 6 + Math.PI) * 2

  for (const side of [-1, 1]) {
    const pawBob = side === -1 ? bob : bob2
    ctx.save()
    const px = side * w * 0.18
    const py = h * 0.32 + pawBob
    // Paw (round, cream colored)
    ctx.fillStyle = '#e8e0d8'
    ctx.beginPath()
    ctx.arc(px, py, w * 0.12, 0, Math.PI * 2)
    ctx.fill()
    // Paw highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.beginPath()
    ctx.arc(px - w * 0.03, py - w * 0.03, w * 0.05, 0, Math.PI * 2)
    ctx.fill()
    // Tiny toe lines
    ctx.strokeStyle = 'rgba(120, 110, 100, 0.4)'
    ctx.lineWidth = 1
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.moveTo(px + i * w * 0.03, py + w * 0.02)
      ctx.lineTo(px + i * w * 0.03, py + w * 0.08)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawBongoFace(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number) {
  const eyeY = -h * 0.05
  const eyeSpacing = w * 0.17
  const eyeBaseSize = w * 0.1

  let eyeOpenAmount = 1
  if (c.blinkPhase === 2) eyeOpenAmount = 0.05
  else if (c.blinkPhase === 1 || c.blinkPhase === 3) eyeOpenAmount = 0.4
  if (c.mood === 'hurt') eyeOpenAmount = 0.1
  if (c.mood === 'scared') eyeOpenAmount = 1.3
  if (c.mood === 'joyful') eyeOpenAmount = 0.15

  for (const side of [-1, 1]) {
    const ex = side * eyeSpacing
    const ey = eyeY

    if (eyeOpenAmount > 0.2 && c.mood !== 'joyful') {
      ctx.save()
      // Eye white
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(ex, ey, eyeBaseSize, eyeBaseSize * eyeOpenAmount, 0, 0, Math.PI * 2)
      ctx.fill()
      if (c.mood !== 'hurt') {
        // Round black pupil
        const lookX = c.eyeOffsetX * eyeBaseSize * 0.2
        const lookY = c.eyeOffsetY * eyeBaseSize * 0.2
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.arc(ex + lookX, ey + lookY, eyeBaseSize * 0.5, 0, Math.PI * 2)
        ctx.fill()
        // Sparkle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.beginPath()
        ctx.arc(ex + lookX - eyeBaseSize * 0.15, ey + lookY - eyeBaseSize * 0.2, eyeBaseSize * 0.15, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    } else if (c.mood === 'joyful') {
      // Happy closed eyes (curved lines)
      ctx.save()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(ex, ey, eyeBaseSize * 0.6, Math.PI * 0.2, Math.PI * 0.8, true)
      ctx.stroke()
      ctx.restore()
    } else if (c.mood === 'hurt') {
      ctx.save()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - eyeBaseSize * 0.5, ey - eyeBaseSize * 0.5)
      ctx.lineTo(ex + eyeBaseSize * 0.5, ey + eyeBaseSize * 0.5)
      ctx.moveTo(ex + eyeBaseSize * 0.5, ey - eyeBaseSize * 0.5)
      ctx.lineTo(ex - eyeBaseSize * 0.5, ey + eyeBaseSize * 0.5)
      ctx.stroke()
      ctx.restore()
    } else {
      ctx.save()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - eyeBaseSize * 0.5, ey)
      ctx.lineTo(ex + eyeBaseSize * 0.5, ey)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Pink nose (small triangle)
  ctx.save()
  ctx.fillStyle = '#ffa0b0'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.1)
  ctx.lineTo(-w * 0.03, h * 0.07)
  ctx.lineTo(w * 0.03, h * 0.07)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Mouth — simple cat W
  const mx = 0
  const my = h * 0.15
  ctx.save()
  ctx.strokeStyle = '#3a2a2a'
  ctx.fillStyle = '#3a2a2a'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  if (c.mood === 'joyful') {
    // Big open smile (bongo cat having fun)
    ctx.beginPath()
    ctx.arc(mx, my, w * 0.06, 0, Math.PI)
    ctx.fill()
  } else if (c.mood === 'jumping' || c.mood === 'rising') {
    const open = c.mouthOpen
    ctx.beginPath()
    ctx.ellipse(mx, my, w * 0.04, w * 0.03 + open * w * 0.03, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (c.mood === 'hurt') {
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.08, my)
    ctx.quadraticCurveTo(mx - w * 0.04, my - 3, mx, my)
    ctx.quadraticCurveTo(mx + w * 0.04, my + 3, mx + w * 0.08, my)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.06, my)
    ctx.quadraticCurveTo(mx - w * 0.03, my + 3, mx, my + 1)
    ctx.quadraticCurveTo(mx + w * 0.03, my + 3, mx + w * 0.06, my)
    ctx.stroke()
  }
  ctx.restore()
}

// ====================================================================
// POPCAT — the iconic Pop Cat (cream/white, surprised O mouth)
// ====================================================================

function drawPopcat(ctx: CanvasRenderingContext2D, c: CharacterState, time: number, w: number, h: number) {
  // Body — cream/tan colored round cat
  ctx.save()
  ctx.shadowColor = `hsla(35, 50%, 60%, 0.5)`
  ctx.shadowBlur = 18
  const bodyGrad = ctx.createRadialGradient(-w * 0.15, -h * 0.2, w * 0.05, 0, 0, w * 0.5)
  bodyGrad.addColorStop(0, '#fff5e8')
  bodyGrad.addColorStop(0.7, '#f0d8b8')
  bodyGrad.addColorStop(1, '#d8b888')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Rim highlight
  ctx.save()
  ctx.globalAlpha = 0.4
  const rim = ctx.createRadialGradient(-w * 0.2, -h * 0.25, 0, -w * 0.2, -h * 0.25, w * 0.4)
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Ears (cream, pointy)
  drawPopcatEars(ctx, w, h, c)

  // Arms (simple stubs)
  drawSimpleArms(ctx, w, h, c, 35, time)

  // Face — the iconic surprised expression
  drawPopcatFace(ctx, w, h, c, time)

  drawBlush(ctx, w, h, c)
}

function drawPopcatEars(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState) {
  const wiggle = Math.sin(c.earWiggle) * 0.08
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * w * 0.28, -h * 0.34)
    ctx.rotate(side * (0.1 + wiggle))
    // Outer ear (cream)
    ctx.fillStyle = '#e8c898'
    ctx.beginPath()
    ctx.moveTo(0, h * 0.06)
    ctx.lineTo(-side * w * 0.1, -h * 0.14)
    ctx.lineTo(side * w * 0.04, -h * 0.04)
    ctx.closePath()
    ctx.fill()
    // Inner ear (pink)
    ctx.fillStyle = '#ffb8c8'
    ctx.beginPath()
    ctx.moveTo(0, h * 0.03)
    ctx.lineTo(-side * w * 0.06, -h * 0.08)
    ctx.lineTo(side * w * 0.02, -h * 0.02)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

function drawPopcatFace(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number) {
  const eyeY = -h * 0.05
  const eyeSpacing = w * 0.17
  const eyeBaseSize = w * 0.11

  let eyeOpenAmount = 1
  if (c.blinkPhase === 2) eyeOpenAmount = 0.05
  else if (c.blinkPhase === 1 || c.blinkPhase === 3) eyeOpenAmount = 0.4
  if (c.mood === 'hurt') eyeOpenAmount = 0.1
  if (c.mood === 'scared') eyeOpenAmount = 1.4 // extra wide for popcat
  if (c.mood === 'joyful') eyeOpenAmount = 0.15

  for (const side of [-1, 1]) {
    const ex = side * eyeSpacing
    const ey = eyeY

    if (eyeOpenAmount > 0.2 && c.mood !== 'joyful') {
      ctx.save()
      // Big round eye whites (popcat has wide surprised eyes)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(ex, ey, eyeBaseSize, eyeBaseSize * eyeOpenAmount, 0, 0, Math.PI * 2)
      ctx.fill()
      if (c.mood !== 'hurt') {
        // Big round black pupil
        const lookX = c.eyeOffsetX * eyeBaseSize * 0.2
        const lookY = c.eyeOffsetY * eyeBaseSize * 0.2
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.arc(ex + lookX, ey + lookY, eyeBaseSize * 0.55, 0, Math.PI * 2)
        ctx.fill()
        // Big sparkle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        ctx.beginPath()
        ctx.arc(ex + lookX - eyeBaseSize * 0.2, ey + lookY - eyeBaseSize * 0.2, eyeBaseSize * 0.2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    } else if (c.mood === 'joyful') {
      ctx.save()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2.8
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(ex, ey, eyeBaseSize * 0.7, Math.PI * 0.15, Math.PI * 0.85, true)
      ctx.stroke()
      ctx.restore()
    } else if (c.mood === 'hurt') {
      ctx.save()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2.8
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - eyeBaseSize * 0.5, ey - eyeBaseSize * 0.5)
      ctx.lineTo(ex + eyeBaseSize * 0.5, ey + eyeBaseSize * 0.5)
      ctx.moveTo(ex + eyeBaseSize * 0.5, ey - eyeBaseSize * 0.5)
      ctx.lineTo(ex - eyeBaseSize * 0.5, ey + eyeBaseSize * 0.5)
      ctx.stroke()
      ctx.restore()
    } else {
      ctx.save()
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2.8
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - eyeBaseSize * 0.5, ey)
      ctx.lineTo(ex + eyeBaseSize * 0.5, ey)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Pink nose (small)
  ctx.save()
  ctx.fillStyle = '#ffa0b0'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.08)
  ctx.lineTo(-w * 0.03, h * 0.05)
  ctx.lineTo(w * 0.03, h * 0.05)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // THE ICONIC POP MOUTH — big round O (the "pop"!)
  const mx = 0
  const my = h * 0.15
  ctx.save()
  ctx.fillStyle = '#1a1a1a'
  // The mouth size pulses slightly (the "pop" animation)
  const popPulse = c.mood === 'joyful' || c.mood === 'jumping' ? 1 + Math.sin(time * 8) * 0.15 : 1
  const mouthW = w * 0.06 * popPulse
  const mouthH = w * 0.08 * popPulse

  if (c.mood === 'hurt') {
    // Small hurt mouth
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.06, my)
    ctx.quadraticCurveTo(mx - w * 0.03, my - 3, mx, my)
    ctx.quadraticCurveTo(mx + w * 0.03, my + 3, mx + w * 0.06, my)
    ctx.stroke()
  } else if (c.mood === 'joyful') {
    // Extra big pop
    ctx.beginPath()
    ctx.ellipse(mx, my, mouthW * 1.4, mouthH * 1.4, 0, 0, Math.PI * 2)
    ctx.fill()
    // Pink tongue inside
    ctx.fillStyle = '#ff6080'
    ctx.beginPath()
    ctx.ellipse(mx, my + mouthH * 0.5, mouthW * 0.7, mouthH * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // The classic pop O mouth — always slightly open
    ctx.beginPath()
    ctx.ellipse(mx, my, mouthW, mouthH, 0, 0, Math.PI * 2)
    ctx.fill()
    // Subtle inner highlight
    ctx.fillStyle = 'rgba(255, 100, 120, 0.4)'
    ctx.beginPath()
    ctx.ellipse(mx, my + mouthH * 0.3, mouthW * 0.5, mouthH * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ====================================================================
// NEON — holographic cyber-cat made of pure light
// A completely different design philosophy: instead of a solid body,
// Neon is made of glowing wireframe outlines + energy particles.
// Inspired by Tron / synthwave / holographic UI aesthetics.
// ====================================================================

function drawNeon(ctx: CanvasRenderingContext2D, c: CharacterState, time: number, w: number, h: number) {
  const hue = 290 // electric magenta-purple
  const hue2 = 180 // cyan accent

  // Outer energy aura (pulsing)
  ctx.save()
  const auraPulse = 0.6 + 0.4 * Math.sin(time * 3)
  const auraGrad = ctx.createRadialGradient(0, 0, w * 0.2, 0, 0, w * 0.6)
  auraGrad.addColorStop(0, `hsla(${hue}, 100%, 60%, ${0.3 * auraPulse})`)
  auraGrad.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`)
  ctx.fillStyle = auraGrad
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Wireframe body outline (the "hologram" shell)
  ctx.save()
  ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`
  ctx.lineWidth = 2
  ctx.shadowColor = `hsl(${hue}, 100%, 60%)`
  ctx.shadowBlur = 10
  // Hexagonal body shape (cyber aesthetic)
  ctx.beginPath()
  const sides = 6
  const radius = w * 0.4
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // Inner energy core (translucent fill)
  ctx.save()
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.38)
  coreGrad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.4)`)
  coreGrad.addColorStop(0.7, `hsla(${hue2}, 100%, 60%, 0.15)`)
  coreGrad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`)
  ctx.fillStyle = coreGrad
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.38, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Circuit line decorations (animated)
  ctx.save()
  ctx.strokeStyle = `hsla(${hue2}, 100%, 70%, 0.6)`
  ctx.lineWidth = 1
  const circuitPhase = time * 2
  // Horizontal scan lines
  for (let i = 0; i < 3; i++) {
    const y = -h * 0.2 + i * h * 0.2 + Math.sin(circuitPhase + i) * 2
    ctx.beginPath()
    ctx.moveTo(-w * 0.3, y)
    ctx.lineTo(w * 0.3, y)
    ctx.stroke()
  }
  ctx.restore()

  // Pointy ears (wireframe triangles)
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * w * 0.28, -h * 0.32)
    ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`
    ctx.lineWidth = 2
    ctx.shadowColor = `hsl(${hue}, 100%, 60%)`
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(0, h * 0.06)
    ctx.lineTo(-side * w * 0.1, -h * 0.14)
    ctx.lineTo(side * w * 0.04, -h * 0.04)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  // Holographic eyes (energy bars, not pupils)
  drawNeonEyes(ctx, w, h, c, time, hue, hue2)

  // Simple arms (wireframe)
  drawSimpleArms(ctx, w, h, c, hue, time)

  // Energy mouth (a glowing line/bar)
  drawNeonMouth(ctx, w, h, c, time, hue2)

  // Floating energy particles around the body
  drawNeonParticles(ctx, w, h, time, hue, hue2)
}

function drawNeonEyes(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number, hue: number, hue2: number) {
  const eyeY = -h * 0.05
  const eyeSpacing = w * 0.17
  const eyeW = w * 0.1
  const eyeH = w * 0.08

  let eyeOpenAmount = 1
  if (c.blinkPhase === 2) eyeOpenAmount = 0.1
  else if (c.blinkPhase === 1 || c.blinkPhase === 3) eyeOpenAmount = 0.5
  if (c.mood === 'hurt') eyeOpenAmount = 0.2
  if (c.mood === 'scared') eyeOpenAmount = 1.3
  if (c.mood === 'joyful') eyeOpenAmount = 0.3

  for (const side of [-1, 1]) {
    const ex = side * eyeSpacing
    const ey = eyeY

    ctx.save()
    ctx.shadowColor = `hsl(${hue2}, 100%, 60%)`
    ctx.shadowBlur = 8

    if (c.mood === 'joyful') {
      // Happy: upward arcs
      ctx.strokeStyle = `hsl(${hue2}, 100%, 70%)`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(ex, ey, eyeW * 0.7, Math.PI * 0.15, Math.PI * 0.85, true)
      ctx.stroke()
    } else if (c.mood === 'hurt') {
      // Hurt: X marks
      ctx.strokeStyle = `hsl(0, 100%, 60%)`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(ex - eyeW * 0.5, ey - eyeH * 0.5)
      ctx.lineTo(ex + eyeW * 0.5, ey + eyeH * 0.5)
      ctx.moveTo(ex + eyeW * 0.5, ey - eyeH * 0.5)
      ctx.lineTo(ex - eyeW * 0.5, ey + eyeH * 0.5)
      ctx.stroke()
    } else if (eyeOpenAmount < 0.3) {
      // Closed: single line
      ctx.strokeStyle = `hsl(${hue2}, 100%, 70%)`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ex - eyeW * 0.6, ey)
      ctx.lineTo(ex + eyeW * 0.6, ey)
      ctx.stroke()
    } else {
      // Open: glowing horizontal energy bars (cyberpunk visor style)
      const grad = ctx.createLinearGradient(ex - eyeW, ey, ex + eyeW, ey)
      grad.addColorStop(0, `hsla(${hue2}, 100%, 70%, 0)`)
      grad.addColorStop(0.5, `hsl(${hue2}, 100%, 80%)`)
      grad.addColorStop(1, `hsla(${hue2}, 100%, 70%, 0)`)
      ctx.fillStyle = grad
      ctx.fillRect(ex - eyeW, ey - eyeH * 0.4 * eyeOpenAmount, eyeW * 2, eyeH * 0.8 * eyeOpenAmount)
    }
    ctx.restore()
  }
}

function drawNeonMouth(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number, hue2: number) {
  const mx = 0
  const my = h * 0.15
  ctx.save()
  ctx.shadowColor = `hsl(${hue2}, 100%, 60%)`
  ctx.shadowBlur = 6

  if (c.mood === 'joyful') {
    // Happy: glowing arc
    ctx.strokeStyle = `hsl(${hue2}, 100%, 75%)`
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(mx, my, w * 0.06, 0.1, Math.PI - 0.1)
    ctx.stroke()
  } else if (c.mood === 'hurt') {
    ctx.strokeStyle = `hsl(0, 100%, 60%)`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.06, my)
    ctx.quadraticCurveTo(mx, my - 4, mx + w * 0.06, my)
    ctx.stroke()
  } else if (c.mood === 'jumping' || c.mood === 'rising') {
    // Open: glowing circle
    const open = c.mouthOpen
    ctx.fillStyle = `hsla(${hue2}, 100%, 70%, 0.8)`
    ctx.beginPath()
    ctx.ellipse(mx, my, w * 0.04, w * 0.03 + open * w * 0.03, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Idle: thin glowing line
    ctx.strokeStyle = `hsl(${hue2}, 100%, 70%)`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.05, my)
    ctx.lineTo(mx + w * 0.05, my)
    ctx.stroke()
  }
  ctx.restore()
}

function drawNeonParticles(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, hue: number, hue2: number) {
  // 6 floating energy sparks orbiting the body
  ctx.save()
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + time * 1.5
    const r = w * 0.5 + Math.sin(time * 2 + i) * 3
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    const pSize = 1.5 + Math.sin(time * 4 + i) * 0.5
    const pHue = i % 2 === 0 ? hue : hue2

    ctx.fillStyle = `hsl(${pHue}, 100%, 75%)`
    ctx.shadowColor = `hsl(${pHue}, 100%, 60%)`
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(x, y, pSize, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ====================================================================
// MOCHI — simple orange cat with purple headphones (restored original)
// ====================================================================

function drawMochi(ctx: CanvasRenderingContext2D, c: CharacterState, time: number, w: number, h: number) {
  const bodyHue = getEffectiveHue('mochi', c.mood, time)

  // Tail (behind body, simple curve)
  drawSimpleTail(ctx, w, h, c, bodyHue, time, 0.5)

  // Body — simple round circle
  ctx.save()
  ctx.shadowColor = `hsl(${bodyHue}, 90%, 60%)`
  ctx.shadowBlur = 20
  const bodyGrad = ctx.createRadialGradient(-w * 0.15, -h * 0.2, w * 0.05, 0, 0, w * 0.5)
  bodyGrad.addColorStop(0, `hsl(${bodyHue}, 90%, 75%)`)
  bodyGrad.addColorStop(0.7, `hsl(${bodyHue}, 85%, 58%)`)
  bodyGrad.addColorStop(1, `hsl(${bodyHue}, 80%, 45%)`)
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Rim highlight
  ctx.save()
  ctx.globalAlpha = 0.4
  const rim = ctx.createRadialGradient(-w * 0.2, -h * 0.25, 0, -w * 0.2, -h * 0.25, w * 0.4)
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Simple pointy ears
  drawSimpleEars(ctx, w, h, c, bodyHue)

  // Simple headphones
  drawSimpleHeadphones(ctx, w, h, c, time)

  // Simple whiskers
  drawSimpleWhiskers(ctx, w, h)

  // Arms (simple stubs, no paw details)
  drawSimpleArms(ctx, w, h, c, bodyHue, time)

  // Cat face
  drawCatFace(ctx, w, h, c, time, 'mochi')

  drawBlush(ctx, w, h, c)
}

// ====================================================================
// YUKI — minimalist white snow cat with a tiny blue scarf
// ====================================================================

function drawYuki(ctx: CanvasRenderingContext2D, c: CharacterState, time: number, w: number, h: number) {
  // Tail (short bobtail, barely visible)
  drawSimpleTail(ctx, w, h, c, 200, time, 0.25)

  // Body — soft white/cream
  ctx.save()
  ctx.shadowColor = `hsl(210, 40%, 80%)`
  ctx.shadowBlur = 18
  const bodyGrad = ctx.createRadialGradient(-w * 0.15, -h * 0.2, w * 0.05, 0, 0, w * 0.5)
  bodyGrad.addColorStop(0, '#ffffff')
  bodyGrad.addColorStop(0.7, '#f0f4fa')
  bodyGrad.addColorStop(1, '#d8e0ec')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Soft rim highlight
  ctx.save()
  ctx.globalAlpha = 0.5
  const rim = ctx.createRadialGradient(-w * 0.2, -h * 0.25, 0, -w * 0.2, -h * 0.25, w * 0.4)
  rim.addColorStop(0, 'rgba(255, 255, 255, 1)')
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Ears with light blue inner
  drawSimpleEars(ctx, w, h, c, 200, 0.85) // lighter outer, blue inner

  // Tiny blue scarf around neck
  drawScarf(ctx, w, h, c, time)

  // Arms (simple stubs)
  drawSimpleArms(ctx, w, h, c, 200, time)

  // Cat face (round pupils — softer look)
  drawCatFace(ctx, w, h, c, time, 'yuki')

  // Tiny snowflake marking on chest
  ctx.save()
  ctx.fillStyle = `hsla(200, 60%, 70%, 0.5)`
  ctx.font = `${w * 0.12}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('❄', 0, h * 0.28)
  ctx.restore()

  drawBlush(ctx, w, h, c)
}

// ====================================================================
// KURO — sleek dark night cat with glowing cyan eyes
// ====================================================================

function drawKuro(ctx: CanvasRenderingContext2D, c: CharacterState, time: number, w: number, h: number) {
  // Tail (long and sleek)
  drawSimpleTail(ctx, w, h, c, 240, time, 0.7)

  // Body — dark navy/black with subtle blue tint
  ctx.save()
  ctx.shadowColor = `hsl(240, 40%, 30%)`
  ctx.shadowBlur = 18
  const bodyGrad = ctx.createRadialGradient(-w * 0.15, -h * 0.2, w * 0.05, 0, 0, w * 0.5)
  bodyGrad.addColorStop(0, '#3a3a52')
  bodyGrad.addColorStop(0.7, '#252538')
  bodyGrad.addColorStop(1, '#15151f')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Subtle rim light (moonlight reflection)
  ctx.save()
  ctx.globalAlpha = 0.3
  const rim = ctx.createRadialGradient(-w * 0.2, -h * 0.25, 0, -w * 0.2, -h * 0.25, w * 0.4)
  rim.addColorStop(0, 'rgba(150, 200, 255, 0.6)')
  rim.addColorStop(1, 'rgba(150, 200, 255, 0)')
  ctx.fillStyle = rim
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Ears (dark)
  drawSimpleEars(ctx, w, h, c, 240, 0.8)

  // Arms (dark stubs)
  drawSimpleArms(ctx, w, h, c, 240, time)

  // Glowing cyan eyes face
  drawCatFace(ctx, w, h, c, time, 'kuro')

  // Tiny crescent moon marking on forehead
  ctx.save()
  ctx.fillStyle = `hsla(180, 80%, 70%, 0.7)`
  ctx.shadowColor = `hsl(180, 80%, 70%)`
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(0, -h * 0.22, w * 0.04, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#15151f'
  ctx.beginPath()
  ctx.arc(w * 0.015, -h * 0.22, w * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ====================================================================
// Shared components
// ====================================================================

/** Simple curled tail — length factor controls how long */
function drawSimpleTail(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, bodyHue: number, time: number, lengthFactor: number) {
  ctx.save()
  ctx.translate(w * 0.35, h * 0.15)
  const wag = Math.sin(c.armSwing * 0.5 + time * 1.5) * 0.3
  ctx.rotate(0.4 + wag)

  // Tail color
  let tailColor: string
  if (bodyHue === 200) {
    tailColor = '#e0e8f0' // Yuki — soft gray-white
  } else if (bodyHue === 240) {
    tailColor = '#2a2a3a' // Kuro — dark
  } else {
    tailColor = `hsl(${bodyHue}, 85%, 55%)` // Mochi — orange
  }

  ctx.strokeStyle = tailColor
  ctx.lineWidth = w * 0.1 * lengthFactor
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(w * 0.25 * lengthFactor, -h * 0.15 * lengthFactor, w * 0.35 * lengthFactor, -h * 0.4 * lengthFactor)
  ctx.stroke()

  // Tail tip (lighter)
  ctx.fillStyle = bodyHue === 200 ? '#ffffff' : bodyHue === 240 ? '#3a3a52' : `hsl(${bodyHue + 10}, 90%, 75%)`
  ctx.beginPath()
  ctx.arc(w * 0.35 * lengthFactor, -h * 0.4 * lengthFactor, w * 0.06 * lengthFactor, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Simple pointy ears */
function drawSimpleEars(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, bodyHue: number, lightness = 1) {
  const wiggle = Math.sin(c.earWiggle) * 0.08
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * w * 0.28, -h * 0.33)
    ctx.rotate(side * (0.1 + wiggle))

    // Outer ear color
    let outerColor: string
    if (bodyHue === 200) {
      outerColor = `hsl(210, 25%, ${88 * lightness}%)`
    } else if (bodyHue === 240) {
      outerColor = `hsl(240, 30%, ${25 * lightness}%)`
    } else {
      outerColor = `hsl(${bodyHue}, 85%, ${55 * lightness}%)`
    }

    // Outer ear (triangle)
    ctx.fillStyle = outerColor
    ctx.beginPath()
    ctx.moveTo(0, h * 0.06)
    ctx.lineTo(-side * w * 0.12, -h * 0.16)
    ctx.lineTo(side * w * 0.04, -h * 0.04)
    ctx.closePath()
    ctx.fill()

    // Inner ear (pink for orange, blue for white, dark for Kuro)
    let innerColor: string
    if (bodyHue === 200) {
      innerColor = `hsl(200, 50%, 75%)`
    } else if (bodyHue === 240) {
      innerColor = `hsl(230, 40%, 35%)`
    } else {
      innerColor = `hsl(340, 80%, 72%)`
    }
    ctx.fillStyle = innerColor
    ctx.beginPath()
    ctx.moveTo(0, h * 0.03)
    ctx.lineTo(-side * w * 0.07, -h * 0.1)
    ctx.lineTo(side * w * 0.02, -h * 0.02)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }
}

/** Simple purple headphones (Mochi only) */
function drawSimpleHeadphones(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number) {
  const hpHue = 280 // purple
  const accentHue = 180 // cyan

  ctx.save()
  // Headband
  ctx.strokeStyle = `hsl(${hpHue}, 60%, 35%)`
  ctx.lineWidth = w * 0.07
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, -h * 0.05, w * 0.4, Math.PI * 1.1, Math.PI * 1.9)
  ctx.stroke()

  // Headband highlight
  ctx.strokeStyle = `hsl(${hpHue}, 60%, 50%)`
  ctx.lineWidth = w * 0.025
  ctx.beginPath()
  ctx.arc(0, -h * 0.05, w * 0.4, Math.PI * 1.15, Math.PI * 1.85)
  ctx.stroke()

  // Ear cups
  for (const side of [-1, 1]) {
    const ex = side * w * 0.36
    const ey = -h * 0.05

    // Outer cup
    const cupGrad = ctx.createRadialGradient(ex - side * 2, ey - 2, 0, ex, ey, w * 0.16)
    cupGrad.addColorStop(0, `hsl(${hpHue}, 70%, 50%)`)
    cupGrad.addColorStop(1, `hsl(${hpHue}, 75%, 28%)`)
    ctx.fillStyle = cupGrad
    ctx.beginPath()
    ctx.ellipse(ex, ey, w * 0.13, w * 0.16, 0, 0, Math.PI * 2)
    ctx.fill()

    // Cushion center
    ctx.fillStyle = `hsl(${hpHue}, 55%, 18%)`
    ctx.beginPath()
    ctx.ellipse(ex, ey, w * 0.08, w * 0.11, 0, 0, Math.PI * 2)
    ctx.fill()

    // Pulsing LED
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + side)
    ctx.save()
    ctx.shadowColor = `hsl(${accentHue}, 95%, 70%)`
    ctx.shadowBlur = 5 + pulse * 5
    ctx.fillStyle = `hsla(${accentHue}, 95%, 75%, ${0.6 + pulse * 0.4})`
    ctx.beginPath()
    ctx.arc(ex, ey, w * 0.03, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

/** Tiny blue scarf (Yuki only) */
function drawScarf(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number) {
  ctx.save()
  // Scarf band
  ctx.strokeStyle = `hsl(205, 65%, 60%)`
  ctx.lineWidth = w * 0.06
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, h * 0.1, w * 0.34, Math.PI * 0.15, Math.PI * 0.85)
  ctx.stroke()

  // Scarf highlight
  ctx.strokeStyle = `hsla(205, 70%, 80%, 0.6)`
  ctx.lineWidth = w * 0.02
  ctx.beginPath()
  ctx.arc(0, h * 0.1, w * 0.34, Math.PI * 0.2, Math.PI * 0.8)
  ctx.stroke()

  // Scarf tail (small knot hanging down)
  const sway = Math.sin(time * 2) * 0.05 + c.vx * 0.0003
  ctx.save()
  ctx.translate(w * 0.08, h * 0.32)
  ctx.rotate(0.2 + sway)
  ctx.fillStyle = `hsl(205, 65%, 55%)`
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(w * 0.03, h * 0.08, w * 0.02, h * 0.14)
  ctx.quadraticCurveTo(-w * 0.02, h * 0.08, -w * 0.03, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.restore()
}

/** Simple whiskers */
function drawSimpleWhiskers(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    const xBase = side * w * 0.12
    const yBase = h * 0.16
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.moveTo(xBase, yBase + i * 3)
      ctx.lineTo(side * w * 0.3, yBase + i * 5)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** Simple arm stubs (no paw/feet details — clean and minimalist) */
function drawSimpleArms(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, bodyHue: number, time: number) {
  const swing = Math.sin(c.armSwing + time * 2) * 0.4

  let armColor: string
  if (bodyHue === 200) {
    armColor = '#e8eef5'
  } else if (bodyHue === 240) {
    armColor = '#2a2a3a'
  } else {
    armColor = `hsl(${bodyHue}, 85%, 58%)`
  }

  for (const side of [-1, 1]) {
    ctx.save()
    const ax = side * w * 0.38
    const ay = h * 0.02
    ctx.translate(ax, ay)
    let angle = side * (0.5 + swing)
    if (c.mood === 'jumping' || c.mood === 'rising') angle = side * (-0.5 + swing)
    if (c.mood === 'falling') angle = side * (1.0 + swing)
    if (c.mood === 'scared') angle = side * (-0.8)
    if (c.mood === 'joyful') angle = side * (-1.2 + swing * 0.5)
    if (c.mood === 'hurt') angle = side * 1.4
    ctx.rotate(angle)
    // Simple rounded arm stub
    ctx.fillStyle = armColor
    ctx.beginPath()
    ctx.ellipse(side * w * 0.1, 0, w * 0.1, h * 0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** Cat face — works for all 3 cats with style variations */
function drawCatFace(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, time: number, type: CharacterType) {
  const eyeY = -h * 0.05
  const eyeSpacing = w * 0.17
  const eyeBaseSize = w * 0.11

  let eyeOpenAmount = 1
  if (c.blinkPhase === 2) eyeOpenAmount = 0.05
  else if (c.blinkPhase === 1 || c.blinkPhase === 3) eyeOpenAmount = 0.4
  if (c.mood === 'hurt') eyeOpenAmount = 0.1
  if (c.mood === 'scared') eyeOpenAmount = 1.3
  if (c.mood === 'joyful') eyeOpenAmount = 0.15

  for (const side of [-1, 1]) {
    const ex = side * eyeSpacing
    const ey = eyeY

    if (type === 'kuro') {
      // Kuro: glowing solid cyan eyes (no pupil, just glow)
      if (eyeOpenAmount > 0.2 && c.mood !== 'joyful' && c.mood !== 'hurt') {
        ctx.save()
        ctx.shadowColor = `hsl(180, 95%, 65%)`
        ctx.shadowBlur = 8
        const eyeGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeBaseSize)
        eyeGrad.addColorStop(0, '#a0fff5')
        eyeGrad.addColorStop(0.6, '#5cffe8')
        eyeGrad.addColorStop(1, '#20d0b8')
        ctx.fillStyle = eyeGrad
        ctx.beginPath()
        ctx.ellipse(ex, ey, eyeBaseSize * 0.85, eyeBaseSize * 0.85 * eyeOpenAmount, 0, 0, Math.PI * 2)
        ctx.fill()
        // Inner bright spot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.beginPath()
        ctx.arc(ex - eyeBaseSize * 0.2, ey - eyeBaseSize * 0.2, eyeBaseSize * 0.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      } else if (c.mood === 'joyful') {
        ctx.save()
        ctx.strokeStyle = '#5cffe8'
        ctx.shadowColor = '#5cffe8'
        ctx.shadowBlur = 4
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(ex, ey + 1, eyeBaseSize * 0.7, Math.PI * 0.15, Math.PI * 0.85, true)
        ctx.stroke()
        ctx.restore()
      } else if (c.mood === 'hurt') {
        ctx.save()
        ctx.strokeStyle = '#5cffe8'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ex - eyeBaseSize * 0.5, ey - eyeBaseSize * 0.5)
        ctx.lineTo(ex + eyeBaseSize * 0.5, ey + eyeBaseSize * 0.5)
        ctx.moveTo(ex + eyeBaseSize * 0.5, ey - eyeBaseSize * 0.5)
        ctx.lineTo(ex - eyeBaseSize * 0.5, ey + eyeBaseSize * 0.5)
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.save()
        ctx.strokeStyle = '#5cffe8'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ex - eyeBaseSize * 0.5, ey)
        ctx.lineTo(ex + eyeBaseSize * 0.5, ey)
        ctx.stroke()
        ctx.restore()
      }
    } else {
      // Mochi & Yuki: standard cat eyes
      const lookX = c.eyeOffsetX * eyeBaseSize * 0.2
      const lookY = c.eyeOffsetY * eyeBaseSize * 0.2

      if (eyeOpenAmount > 0.2 && c.mood !== 'joyful') {
        ctx.save()
        // Eye white
        const grad = ctx.createRadialGradient(ex - 1, ey - 1, 0.5, ex, ey, eyeBaseSize)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(1, '#f0f4ff')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(ex, ey, eyeBaseSize, eyeBaseSize * eyeOpenAmount, 0, 0, Math.PI * 2)
        ctx.fill()

        if (c.mood !== 'hurt') {
          // Iris color: Mochi = green-gold, Yuki = soft blue
          const irisColor = type === 'yuki' ? '#7ab8d8' : '#8cb878'
          ctx.fillStyle = irisColor
          ctx.beginPath()
          ctx.ellipse(ex + lookX, ey + lookY, eyeBaseSize * 0.65, eyeBaseSize * 0.65 * eyeOpenAmount, 0, 0, Math.PI * 2)
          ctx.fill()

          // Pupil: Mochi = vertical slit, Yuki = round (softer)
          if (type === 'yuki') {
            // Round pupil
            const pupilSize = eyeBaseSize * 0.4 * (c.mood === 'scared' ? 0.7 : 1)
            ctx.fillStyle = '#0a0a1a'
            ctx.beginPath()
            ctx.arc(ex + lookX, ey + lookY, pupilSize, 0, Math.PI * 2)
            ctx.fill()
          } else {
            // Vertical slit pupil (Mochi)
            const dilate = c.mood === 'scared' ? 1.8 : 1
            const pupilW = eyeBaseSize * 0.15 * dilate
            const pupilH = eyeBaseSize * 0.8 * eyeOpenAmount
            ctx.fillStyle = '#0a0a1a'
            ctx.beginPath()
            ctx.ellipse(ex + lookX, ey + lookY, pupilW, pupilH, 0, 0, Math.PI * 2)
            ctx.fill()
          }

          // Eye sparkle
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.beginPath()
          ctx.arc(ex + lookX - eyeBaseSize * 0.2, ey + lookY - eyeBaseSize * 0.25, eyeBaseSize * 0.15, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      } else if (c.mood === 'joyful') {
        ctx.save()
        ctx.strokeStyle = '#1a1a2e'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(ex, ey + 1, eyeBaseSize * 0.7, Math.PI * 0.15, Math.PI * 0.85, true)
        ctx.stroke()
        ctx.restore()
      } else if (c.mood === 'hurt') {
        ctx.save()
        ctx.strokeStyle = '#1a1a2e'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ex - eyeBaseSize * 0.5, ey - eyeBaseSize * 0.5)
        ctx.lineTo(ex + eyeBaseSize * 0.5, ey + eyeBaseSize * 0.5)
        ctx.moveTo(ex + eyeBaseSize * 0.5, ey - eyeBaseSize * 0.5)
        ctx.lineTo(ex - eyeBaseSize * 0.5, ey + eyeBaseSize * 0.5)
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.save()
        ctx.strokeStyle = '#1a1a2e'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ex - eyeBaseSize * 0.5, ey)
        ctx.lineTo(ex + eyeBaseSize * 0.5, ey)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  // Pink nose (small triangle)
  ctx.save()
  ctx.fillStyle = type === 'kuro' ? '#5cffe8' : '#ff80a0'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.1)
  ctx.lineTo(-w * 0.035, h * 0.06)
  ctx.lineTo(w * 0.035, h * 0.06)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Mouth
  drawCatMouth(ctx, w, h, c, type)
}

function drawCatMouth(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState, type: CharacterType) {
  const mx = 0
  const my = h * 0.15
  const mouthColor = type === 'kuro' ? '#5cffe8' : '#2a1a2e'

  ctx.save()
  ctx.strokeStyle = mouthColor
  ctx.fillStyle = mouthColor
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (c.mood === 'hurt') {
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.1, my)
    ctx.quadraticCurveTo(mx - w * 0.05, my - 4, mx, my)
    ctx.quadraticCurveTo(mx + w * 0.05, my + 4, mx + w * 0.1, my)
    ctx.stroke()
  } else if (c.mood === 'scared') {
    ctx.beginPath()
    ctx.ellipse(mx, my + 2, w * 0.04, w * 0.06, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (c.mood === 'joyful') {
    // Cat smile (W shape)
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.1, my - 1)
    ctx.quadraticCurveTo(mx - w * 0.05, my + 4, mx, my + 1)
    ctx.quadraticCurveTo(mx + w * 0.05, my + 4, mx + w * 0.1, my - 1)
    ctx.stroke()
  } else if (c.mood === 'jumping' || c.mood === 'rising') {
    const open = c.mouthOpen
    ctx.beginPath()
    ctx.ellipse(mx, my, w * 0.04 * (1 + open * 0.5), w * 0.03 + open * w * 0.03, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Cat mouth: W shape + vertical line
    ctx.beginPath()
    ctx.moveTo(mx - w * 0.07, my - 1)
    ctx.quadraticCurveTo(mx - w * 0.035, my + 3, mx, my + 1)
    ctx.quadraticCurveTo(mx + w * 0.035, my + 3, mx + w * 0.07, my - 1)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(mx, my - 3)
    ctx.lineTo(mx, my + 1)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBlush(ctx: CanvasRenderingContext2D, w: number, h: number, c: CharacterState) {
  if (c.blushIntensity <= 0.01) return
  const by = h * 0.08
  for (const side of [-1, 1]) {
    const bx = side * w * 0.25
    ctx.save()
    ctx.globalAlpha = c.blushIntensity * 0.6
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, w * 0.1)
    grad.addColorStop(0, 'hsl(340, 85%, 72%)')
    grad.addColorStop(1, 'hsla(340, 85%, 72%, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(bx, by, w * 0.08, h * 0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ===== Animation update (shared) =====

export function updateCharacterAnimation(c: CharacterState, dt: number, time: number) {
  // Blink — faster, more anime-style
  c.blinkTimer -= dt
  if (c.blinkTimer <= 0) {
    c.blinkPhase = (c.blinkPhase + 1) % 4
    if (c.blinkPhase === 0) {
      c.blinkTimer = 1.5 + Math.random() * 2.5  // slightly faster blink cycle
    } else {
      c.blinkTimer = 0.05  // faster blink close/open
    }
  }

  // Squash/stretch targets — exaggerated for anime feel
  let targetSx = 1, targetSy = 1
  switch (c.mood) {
    case 'charging': targetSx = 1.35; targetSy = 0.65; break  // more exaggerated
    case 'jumping':  targetSx = 0.75; targetSy = 1.30; break  // more stretch
    case 'rising':   targetSx = 0.88; targetSy = 1.15; break
    case 'falling':  targetSx = 1.20; targetSy = 0.82; break  // more squash
    case 'scared':   targetSx = 1.25; targetSy = 0.78; break
    case 'joyful':   targetSx = 0.90; targetSy = 1.22; break
    case 'hurt':     targetSx = 1.40; targetSy = 0.62; break  // big squash on hurt
    case 'dizzy':    targetSx = 1.08 + Math.sin(time * 8) * 0.06; targetSy = 0.92; break
  }
  // Faster recovery for snappier, more dynamic feel (less linear)
  const relax = 1 - Math.pow(0.0001, dt)  // faster than before
  c.squashX += (targetSx - c.squashX) * relax
  c.squashY += (targetSy - c.squashY) * relax

  // Rotation: tilt toward velocity — snappier with slight overshoot
  const targetRot = c.vx * 0.0012  // more tilt
  c.rotation += (targetRot - c.rotation) * relax * 0.8

  // Arms swing — faster
  c.armSwing += dt * (c.mood === 'jumping' ? 12 : 3.5)  // faster arm swing

  // Antenna wave phase — faster
  c.antennaWave += dt * 3.5

  // Ear wiggle — faster
  c.earWiggle += dt * 4.5

  // Breath
  c.breathPhase += dt * 2
  if (c.mood === 'idle') {
    c.squashY *= 1 + Math.sin(c.breathPhase) * 0.025
  }

  // Pupils follow velocity — snappier tracking
  const targetEyeX = Math.max(-1, Math.min(1, c.vx * 0.006))
  const targetEyeY = Math.max(-1, Math.min(1, c.vy * 0.004))
  c.eyeOffsetX += (targetEyeX - c.eyeOffsetX) * relax * 1.2
  c.eyeOffsetY += (targetEyeY - c.eyeOffsetY) * relax * 1.2

  // Mouth open based on vertical velocity
  c.mouthOpen = Math.max(0, Math.min(1, -c.vy * 0.0025))

  // Blush intensity by mood
  let targetBlush = 0.3
  if (c.mood === 'joyful') targetBlush = 1
  else if (c.mood === 'scared') targetBlush = 0.1
  else if (c.mood === 'hurt') targetBlush = 0
  else if (c.mood === 'jumping') targetBlush = 0.5
  c.blushIntensity += (targetBlush - c.blushIntensity) * relax * 0.5

  // Timers
  if (c.dizzyTimer > 0) c.dizzyTimer -= dt
  if (c.joyTimer > 0) c.joyTimer -= dt
  if (c.invulnBoost > 0) c.invulnBoost -= dt

  // Trail decay
  for (let i = c.trail.length - 1; i >= 0; i--) {
    c.trail[i].life -= dt
    if (c.trail[i].life <= 0) c.trail.splice(i, 1)
  }
}

export function addTrailPoint(c: CharacterState, time: number) {
  // Trail hue depends on character type for visual identity
  const baseHue = getCharacterBaseHue(c.type)
  const hue = baseHue + Math.sin(time * 0.5) * 20
  c.trail.push({ x: c.x, y: c.y, life: 0.4, size: c.w * 0.35, hue })
  if (c.trail.length > 20) c.trail.shift()
}

// ===== Matter.js Physics Ragdoll Character =====
// TRUE physics ragdoll — body parts connected by constraints, react to
// gravity, jumps, and impacts dynamically. No keyframe animations.

let matterRagdoll: PhysicsRagdoll | null = null
let matterLastX = 0
let matterLastY = 0

function drawMatterBot(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  // Create ragdoll if not exists or position changed significantly
  if (!matterRagdoll) {
    matterRagdoll = createRagdoll(c.x, c.y, 0.35)
    matterLastX = c.x
    matterLastY = c.y
  }

  // Calculate velocity from position change
  const vx = (c.x - matterLastX) * 60  // approximate px/s
  const vy = (c.y - matterLastY) * 60
  matterLastX = c.x
  matterLastY = c.y

  // Update physics — sync ragdoll chest with character position
  // The body parts will dynamically follow via physics constraints
  updateRagdollPhysics(matterRagdoll, c.x, c.y, c.vx, c.vy, 1/60)

  // Draw the ragdoll
  const isHurt = c.mood === 'hurt'
  drawPhysicsRagdoll(ctx, matterRagdoll, isHurt)
}

// ===== Imported 3D Character Rendering =====
// Uses Three.js to render real 3D models (Fox, Robot) and composites them
// onto the Canvas2D game canvas via drawImage.

const model3DCache: Map<string, Model3DState | null> = new Map()
const model3DLoading: Set<string> = new Set()

async function drawImported3D(ctx: CanvasRenderingContext2D, c: CharacterState, _time: number) {
  const modelType = c.type === 'fox3d' ? 'fox' : 'robot'
  const cacheKey = modelType

  // Load model if not cached
  if (!model3DCache.has(cacheKey) && !model3DLoading.has(cacheKey)) {
    model3DLoading.add(cacheKey)
    const state = await loadModel3D(modelType as any)
    model3DCache.set(cacheKey, state)
    model3DLoading.delete(cacheKey)
  }

  const state = model3DCache.get(cacheKey)
  if (!state) {
    // Model not loaded yet — draw a placeholder
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.fillStyle = '#666'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Loading 3D...', 0, 0)
    ctx.restore()
    return
  }

  // Update animation and render
  const canvas = renderModel3D(state, c.mood, c.vy)
  if (canvas) {
    // Composite the 3D canvas onto the game canvas at character position
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.scale(c.squashX, c.squashY)
    // Draw the 3D render centered on character
    ctx.drawImage(canvas, -c.w / 2, -c.h / 2, c.w, c.h)
    ctx.restore()
  }
}

export function drawCharacterTrail(ctx: CanvasRenderingContext2D, c: CharacterState) {
  for (let i = 0; i < c.trail.length; i++) {
    const t = c.trail[i]
    // Safety: ensure hue is a valid number (prevents "Invalid color" crash)
    const hue = isFinite(t.hue) ? t.hue : 340
    const alpha = (t.life / 0.4) * 0.3 * ((i + 1) / c.trail.length)
    ctx.save()
    ctx.globalAlpha = alpha
    const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.size)
    grad.addColorStop(0, `hsl(${hue}, 90%, 75%)`)
    grad.addColorStop(1, `hsla(${hue}, 90%, 75%, 0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// Keep getBodyHue export for backward compatibility (render.ts may use it)
export function getBodyHue(mood: CharacterMood, time: number): number {
  const baseHue = 340
  switch (mood) {
    case 'idle': return baseHue
    case 'charging': return 30
    case 'jumping': return 200
    case 'rising': return 280
    case 'falling': return 190
    case 'scared': return 60
    case 'joyful': return 320
    case 'hurt': return 0
    case 'dizzy': return 280 + Math.sin(time * 8) * 60
    default: return baseHue
  }
}
