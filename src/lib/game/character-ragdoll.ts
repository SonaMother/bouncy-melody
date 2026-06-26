// Ragdoll Character — segmented body parts with spring physics.
//
// This character demonstrates ragdoll/skeletal animation technique:
// - Body is made of segments (head, torso, arms, legs) connected by spring joints
// - Each segment has position, velocity, and angle that responds to physics
// - When the character moves/jumps, body parts lag behind naturally (inertia)
// - Creates a "floppy" life-like feel without pre-made animations
//
// Technique: Verlet integration with distance constraints

import type { CharacterState } from './types'

interface Segment {
  x: number; y: number       // current position (relative to character center)
  px: number; py: number      // previous position (for Verlet integration)
  radius: number
  // anchor point (where this segment attaches to parent, relative to character center)
  anchorX: number; anchorY: number
  restLength: number          // ideal distance from anchor
}

export function drawRagdoll(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  const w = c.w, h = c.h
  const r = Math.min(w, h) * 0.5

  // Initialize segments (stored on the character via a module-level cache)
  const segKey = `rag_${c.x.toFixed(0)}_${c.y.toFixed(0)}`
  let segs = segmentCache.get(segKey)
  if (!segs) {
    segs = createSegments(r)
    segmentCache.set(segKey, segs)
    // Clean old cache entries
    if (segmentCache.size > 20) {
      const firstKey = segmentCache.keys().next().value
      if (firstKey) segmentCache.delete(firstKey)
    }
  }

  // Physics update (Verlet integration)
  const gravity = 0.3
  const damping = 0.92
  const stiffness = 0.4  // how strongly segments pull toward anchor

  // Character velocity influences body parts (inertia)
  const charVx = c.vx * 0.3
  const charVy = c.vy * 0.2

  for (const seg of segs) {
    // Verlet: new position = current + (current - prev) * damping + gravity
    const vx = (seg.x - seg.px) * damping
    const vy = (seg.y - seg.py) * damping
    seg.px = seg.x
    seg.py = seg.y
    seg.x += vx + charVx * 0.1
    seg.y += vy + gravity + charVy * 0.1

    // Spring constraint: pull toward anchor point
    const dx = seg.anchorX - seg.x
    const dy = seg.anchorY - seg.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const diff = (dist - seg.restLength) / dist
    seg.x += dx * diff * stiffness
    seg.y += dy * diff * stiffness
  }

  // Draw
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rotation)
  ctx.scale(c.squashX, c.squashY)

  const isHurt = c.mood === 'hurt'
  const bodyColor = isHurt ? '#ff4444' : '#e87b3a'
  const darkColor = isHurt ? '#cc2222' : '#c4621e'
  const lightColor = isHurt ? '#ff8888' : '#f5a050'

  // Draw connections (limbs) between segments and their anchors
  ctx.strokeStyle = darkColor
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const seg of segs) {
    ctx.beginPath()
    ctx.moveTo(seg.anchorX, seg.anchorY)
    ctx.lineTo(seg.x, seg.y)
    ctx.stroke()
  }

  // Draw torso (main body)
  ctx.fillStyle = bodyColor
  ctx.beginPath()
  ctx.arc(0, r * 0.1, r * 0.55, 0, Math.PI * 2)
  ctx.fill()

  // Torso highlight
  ctx.fillStyle = lightColor
  ctx.beginPath()
  ctx.arc(-r * 0.15, r * 0.0, r * 0.2, 0, Math.PI * 2)
  ctx.fill()

  // Draw segments (body parts)
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    // Head is segment 0 — draw with face
    if (i === 0) {
      // Head
      ctx.fillStyle = '#f5d0b0'
      ctx.beginPath()
      ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2)
      ctx.fill()
      // Eyes
      ctx.fillStyle = '#1a1a2e'
      ctx.beginPath()
      ctx.arc(seg.x - seg.radius * 0.3, seg.y - seg.radius * 0.1, seg.radius * 0.15, 0, Math.PI * 2)
      ctx.arc(seg.x + seg.radius * 0.3, seg.y - seg.radius * 0.1, seg.radius * 0.15, 0, Math.PI * 2)
      ctx.fill()
      // Mouth (changes with mood)
      ctx.strokeStyle = '#8a4030'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      if (c.vy < -100) {
        // Jumping — open mouth (O shape)
        ctx.arc(seg.x, seg.y + seg.radius * 0.3, seg.radius * 0.2, 0, Math.PI * 2)
      } else if (c.vy > 200) {
        // Falling — worried mouth
        ctx.arc(seg.x, seg.y + seg.radius * 0.35, seg.radius * 0.25, Math.PI, Math.PI * 2)
      } else {
        // Idle — small smile
        ctx.arc(seg.x, seg.y + seg.radius * 0.2, seg.radius * 0.25, 0.2, Math.PI - 0.2)
      }
      ctx.stroke()
    } else {
      // Limbs — draw as circles
      ctx.fillStyle = bodyColor
      ctx.beginPath()
      ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}

const segmentCache = new Map<string, Segment[]>()

function createSegments(r: number): Segment[] {
  return [
    // Head — attached above torso
    { x: 0, y: -r * 0.5, px: 0, py: -r * 0.5, radius: r * 0.35, anchorX: 0, anchorY: -r * 0.3, restLength: r * 0.25 },
    // Left arm — attached to left side of torso
    { x: -r * 0.5, y: r * 0.1, px: -r * 0.5, py: r * 0.1, radius: r * 0.15, anchorX: -r * 0.3, anchorY: r * 0.0, restLength: r * 0.3 },
    // Right arm
    { x: r * 0.5, y: r * 0.1, px: r * 0.5, py: r * 0.1, radius: r * 0.15, anchorX: r * 0.3, anchorY: r * 0.0, restLength: r * 0.3 },
    // Left leg
    { x: -r * 0.3, y: r * 0.7, px: -r * 0.3, py: r * 0.7, radius: r * 0.18, anchorX: -r * 0.2, anchorY: r * 0.4, restLength: r * 0.35 },
    // Right leg
    { x: r * 0.3, y: r * 0.7, px: r * 0.3, py: r * 0.7, radius: r * 0.18, anchorX: r * 0.2, anchorY: r * 0.4, restLength: r * 0.35 },
  ]
}
