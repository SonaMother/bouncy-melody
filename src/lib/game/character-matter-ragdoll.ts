// Matter.js Physics Character — real ragdoll physics using Matter.js.
//
// This character uses the Matter.js physics engine to create a TRUE ragdoll:
// - Body parts (head, chest, arms, legs) are rigid bodies connected by constraints
// - When the character jumps, arms/legs AUTOMATICALLY trail behind (physics, not animation)
// - When landing, body parts compress and bounce (physics reaction)
// - When falling, limbs spread out dynamically
// - No keyframe animations — ALL movement is physics-driven
//
// Based on the official Matter.js ragdoll example (MIT license).

import Matter from 'matter-js'
import type { CharacterState } from './types'

const { Bodies, Body, Composite, Constraint, Engine, World } = Matter

export interface PhysicsRagdoll {
  composite: Matter.Composite
  parts: {
    head: Matter.Body
    chest: Matter.Body
    leftUpperArm: Matter.Body
    leftLowerArm: Matter.Body
    rightUpperArm: Matter.Body
    rightLowerArm: Matter.Body
    leftUpperLeg: Matter.Body
    leftLowerLeg: Matter.Body
    rightUpperLeg: Matter.Body
    rightLowerLeg: Matter.Body
  }
}

const ragdollCache: Map<string, PhysicsRagdoll> = new Map()
let physicsEngine: Matter.Engine | null = null

/** Get or create the shared physics engine. */
function getEngine(): Matter.Engine {
  if (!physicsEngine) {
    physicsEngine = Engine.create()
    physicsEngine.gravity.y = 0  // we handle gravity in the game loop, not physics
  }
  return physicsEngine
}

/** Create a physics ragdoll at the given position. */
export function createRagdoll(x: number, y: number, scale: number = 0.4): PhysicsRagdoll {
  const group = Body.nextGroup(true)
  const opts = { collisionFilter: { group }, chamfer: { radius: 5 * scale } }

  const head = Bodies.rectangle(x, y - 60 * scale, 34 * scale, 40 * scale, { ...opts, label: 'head' })
  const chest = Bodies.rectangle(x, y, 50 * scale, 70 * scale, { ...opts, label: 'chest' })
  const leftUpperArm = Bodies.rectangle(x - 35 * scale, y - 15 * scale, 16 * scale, 35 * scale, opts)
  const leftLowerArm = Bodies.rectangle(x - 35 * scale, y + 20 * scale, 16 * scale, 50 * scale, opts)
  const rightUpperArm = Bodies.rectangle(x + 35 * scale, y - 15 * scale, 16 * scale, 35 * scale, opts)
  const rightLowerArm = Bodies.rectangle(x + 35 * scale, y + 20 * scale, 16 * scale, 50 * scale, opts)
  const leftUpperLeg = Bodies.rectangle(x - 18 * scale, y + 50 * scale, 16 * scale, 35 * scale, opts)
  const leftLowerLeg = Bodies.rectangle(x - 18 * scale, y + 85 * scale, 16 * scale, 50 * scale, opts)
  const rightUpperLeg = Bodies.rectangle(x + 18 * scale, y + 50 * scale, 16 * scale, 35 * scale, opts)
  const rightLowerLeg = Bodies.rectangle(x + 18 * scale, y + 85 * scale, 16 * scale, 50 * scale, opts)

  // Connect body parts with constraints (joints)
  // Lower stiffness = more floppy, higher = more rigid
  const s = 0.4  // stiffness — cute bouncy, not death-ragdoll
  const constraints = [
    // Head to chest
    Constraint.create({ bodyA: head, pointA: { x: 0, y: 20 * scale }, bodyB: chest, pointB: { x: 0, y: -35 * scale }, stiffness: 0.5, length: 2 }),
    // Arms to chest
    Constraint.create({ bodyA: chest, pointA: { x: -22 * scale, y: -20 * scale }, bodyB: leftUpperArm, pointB: { x: 0, y: -15 * scale }, stiffness: s, length: 2 }),
    Constraint.create({ bodyA: chest, pointA: { x: 22 * scale, y: -20 * scale }, bodyB: rightUpperArm, pointB: { x: 0, y: -15 * scale }, stiffness: s, length: 2 }),
    // Lower arms to upper arms
    Constraint.create({ bodyA: leftUpperArm, pointA: { x: 0, y: 15 * scale }, bodyB: leftLowerArm, pointB: { x: 0, y: -22 * scale }, stiffness: s, length: 2 }),
    Constraint.create({ bodyA: rightUpperArm, pointA: { x: 0, y: 15 * scale }, bodyB: rightLowerArm, pointB: { x: 0, y: -22 * scale }, stiffness: s, length: 2 }),
    // Legs to chest
    Constraint.create({ bodyA: chest, pointA: { x: -16 * scale, y: 30 * scale }, bodyB: leftUpperLeg, pointB: { x: 0, y: -15 * scale }, stiffness: s, length: 2 }),
    Constraint.create({ bodyA: chest, pointA: { x: 16 * scale, y: 30 * scale }, bodyB: rightUpperLeg, pointB: { x: 0, y: -15 * scale }, stiffness: s, length: 2 }),
    // Lower legs to upper legs
    Constraint.create({ bodyA: leftUpperLeg, pointA: { x: 0, y: 15 * scale }, bodyB: leftLowerLeg, pointB: { x: 0, y: -22 * scale }, stiffness: s, length: 2 }),
    Constraint.create({ bodyA: rightUpperLeg, pointA: { x: 0, y: 15 * scale }, bodyB: rightLowerLeg, pointB: { x: 0, y: -22 * scale }, stiffness: s, length: 2 }),
  ]

  const composite = Composite.create({
    bodies: [head, chest, leftUpperArm, leftLowerArm, rightUpperArm, rightLowerArm, leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg],
    constraints,
  })

  // Add to physics world
  World.add(getEngine().world, composite)

  return {
    composite,
    parts: { head, chest, leftUpperArm, leftLowerArm, rightUpperArm, rightLowerArm, leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg },
  }
}

/** Update physics for a ragdoll — sync with game character position. */
export function updateRagdollPhysics(ragdoll: PhysicsRagdoll, charX: number, charY: number, charVx: number, charVy: number, dt: number) {
  // Move the chest to follow the character, let other parts follow via physics
  const chest = ragdoll.parts.chest
  const targetX = charX
  const targetY = charY

  // Apply velocity to chest (this drives the whole body)
  Body.setVelocity(chest, { x: charVx * 0.5, y: charVy * 0.3 })
  Body.setPosition(chest, { x: targetX, y: targetY })

  // Update the physics engine
  Engine.update(getEngine(), dt * 1000)
}

/** Draw the physics ragdoll onto Canvas2D. */
export function drawPhysicsRagdoll(ctx: CanvasRenderingContext2D, ragdoll: PhysicsRagdoll, isHurt: boolean) {
  const p = ragdoll.parts
  const mainColor = isHurt ? '#ff4444' : '#e87b3a'
  const darkColor = isHurt ? '#cc2222' : '#c4621e'
  const skinColor = isHurt ? '#ffaaaa' : '#f5d0b0'

  // Draw limbs (connections between body parts)
  ctx.strokeStyle = darkColor
  ctx.lineWidth = 6
  ctx.lineCap = 'round'

  // Draw each body part as a rounded rectangle
  const drawPart = (body: Matter.Body, color: string) => {
    const { position, angle, bounds } = body
    const w = bounds.max.x - bounds.min.x
    const h = bounds.max.y - bounds.min.y
    ctx.save()
    ctx.translate(position.x, position.y)
    ctx.rotate(angle)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, 4)
    ctx.fill()
    ctx.restore()
  }

  // Draw limbs first (behind body)
  drawPart(p.leftUpperArm, mainColor)
  drawPart(p.leftLowerArm, mainColor)
  drawPart(p.rightUpperArm, mainColor)
  drawPart(p.rightLowerArm, mainColor)
  drawPart(p.leftUpperLeg, mainColor)
  drawPart(p.leftLowerLeg, darkColor)
  drawPart(p.rightUpperLeg, mainColor)
  drawPart(p.rightLowerLeg, darkColor)

  // Draw chest
  drawPart(p.chest, mainColor)

  // Draw head with face
  ctx.save()
  ctx.translate(p.head.position.x, p.head.position.y)
  ctx.rotate(p.head.angle)
  const headW = p.head.bounds.max.x - p.head.bounds.min.x
  const headH = p.head.bounds.max.y - p.head.bounds.min.y
  // Head shape
  ctx.fillStyle = skinColor
  ctx.beginPath()
  ctx.roundRect(-headW / 2, -headH / 2, headW, headH, 6)
  ctx.fill()
  // Eyes
  ctx.fillStyle = '#1a1a2e'
  ctx.beginPath()
  ctx.arc(-headW * 0.2, -headH * 0.1, headW * 0.1, 0, Math.PI * 2)
  ctx.arc(headW * 0.2, -headH * 0.1, headW * 0.1, 0, Math.PI * 2)
  ctx.fill()
  // Mouth
  ctx.strokeStyle = '#8a4030'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, headH * 0.15, headW * 0.2, 0.2, Math.PI - 0.2)
  ctx.stroke()
  ctx.restore()
}

/** Remove a ragdoll from the physics world. */
export function removeRagdoll(ragdoll: PhysicsRagdoll) {
  World.remove(getEngine().world, ragdoll.composite)
}
