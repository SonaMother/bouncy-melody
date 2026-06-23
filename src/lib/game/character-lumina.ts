// Lumina engine — living energy beings made of flowing ribbons.
// Spark: a cute energy serpent with glowing body, eyes, and orbiting sparks.

import type { CharacterState, CharacterMood } from './types'

interface Bone { x: number; y: number; offsetX: number; offsetY: number; phase: number }

function getSpine(count: number): Bone[] {
  const bones: Bone[] = []
  for (let i = 0; i < count; i++) bones.push({ x: 0, y: 0, offsetX: 0, offsetY: -8, phase: i * 0.5 })
  return bones
}
let cachedSpine: Bone[] | null = null
let cachedCount = 0

export function drawLumina(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  const isHurt = c.mood === 'hurt'
  const isHappy = c.mood === 'joyful'
  const bodyColor = isHurt ? 'hsl(0, 100%, 60%)' : isHappy ? 'hsl(300, 100%, 65%)' : 'hsl(180, 100%, 60%)'
  const glowColor = isHurt ? 'hsl(0, 100%, 50%)' : isHappy ? 'hsl(300, 100%, 55%)' : 'hsl(180, 100%, 50%)'
  const eyeColor = 'hsl(60, 100%, 80%)'
  const intensity = isHurt ? 0.3 : isHappy ? 1.5 : c.mood === 'jumping' ? 1.2 : 0.7

  if (!cachedSpine || cachedCount !== 6) { cachedSpine = getSpine(6); cachedCount = 6 }
  const bones = cachedSpine

  let x = c.x, y = c.y
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i]
    const wobbleAmt = (i / bones.length) * 4
    x += b.offsetX + Math.sin(time * 3 + b.phase) * wobbleAmt
    y += b.offsetY * c.squashY + Math.cos(time * 2 + b.phase) * wobbleAmt * 0.5
    b.x = x; b.y = y
  }

  // Energy ribbon (4-pass glow)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.beginPath()
  ctx.moveTo(bones[0].x, bones[0].y)
  for (let i = 0; i < bones.length - 1; i++) {
    const midX = (bones[i].x + bones[i + 1].x) / 2
    const midY = (bones[i].y + bones[i + 1].y) / 2
    ctx.quadraticCurveTo(bones[i].x, bones[i].y, midX, midY)
  }
  ctx.lineTo(bones[bones.length - 1].x, bones[bones.length - 1].y)

  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.strokeStyle = glowColor; ctx.lineWidth = 25; ctx.globalAlpha = 0.15 * intensity; ctx.stroke()
  ctx.lineWidth = 16; ctx.globalAlpha = 0.3 * intensity; ctx.stroke()
  ctx.strokeStyle = bodyColor; ctx.lineWidth = 6; ctx.globalAlpha = intensity; ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.globalAlpha = intensity * 0.8; ctx.stroke()
  ctx.restore()

  // Head orb
  const head = bones[0]
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const hg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 35)
  hg.addColorStop(0, bodyColor); hg.addColorStop(0.4, glowColor); hg.addColorStop(1, 'transparent')
  ctx.fillStyle = hg; ctx.globalAlpha = intensity; ctx.beginPath(); ctx.arc(head.x, head.y, 35, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Eyes
  const blinking = c.blinkPhase === 2
  if (!blinking && !isHurt) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (const side of [-1, 1]) {
      const ex = head.x + side * 4 + c.eyeOffsetX * 2
      const ey = head.y - 2 + c.eyeOffsetY * 2
      ctx.fillStyle = eyeColor; ctx.shadowColor = eyeColor; ctx.shadowBlur = 6
      ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  } else if (isHurt) {
    ctx.save(); ctx.strokeStyle = eyeColor; ctx.lineWidth = 1.5; ctx.lineCap = 'round'
    for (const side of [-1, 1]) {
      const ex = head.x + side * 4, ey = head.y - 2
      ctx.beginPath(); ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2)
      ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2); ctx.stroke()
    }
    ctx.restore()
  }

  // Tail orb
  const tail = bones[bones.length - 1]
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const tg = ctx.createRadialGradient(tail.x, tail.y, 0, tail.x, tail.y, 12)
  tg.addColorStop(0, bodyColor); tg.addColorStop(1, 'transparent')
  ctx.fillStyle = tg; ctx.globalAlpha = intensity * 0.7
  ctx.beginPath(); ctx.arc(tail.x, tail.y, 12, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Orbiting sparks
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 4; i++) {
    const a = time * 2 + i * Math.PI / 2
    const r = 20 + Math.sin(time * 3 + i) * 5
    const sx = head.x + Math.cos(a) * r, sy = head.y + Math.sin(a) * r
    ctx.fillStyle = bodyColor; ctx.globalAlpha = intensity * 0.6
    ctx.beginPath(); ctx.arc(sx, sy, 1.5 + Math.sin(time * 4 + i) * 0.5, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}
