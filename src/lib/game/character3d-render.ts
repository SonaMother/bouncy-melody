// 3D Character Renderer — renders 3D characters using the character3d engine.
//
// Two presets:
// - Blob3D: a smooth purple sphere blob with big cute eyes
// - Cat3D:  a fully 3D cat with sphere body, cone ears, cylinder legs

import type { CharacterState } from './types'
import {
  drawMesh3D,
  buildSphere,
  buildCone,
  buildCylinder,
  type Mesh,
} from './character3d'

// Cache meshes so we don't rebuild every frame
let blob3DMeshes: { body: Mesh; eye1: Mesh; eye2: Mesh } | null = null
let cat3DMeshes: { body: Mesh; ear1: Mesh; ear2: Mesh; eye1: Mesh; eye2: Mesh; leg1: Mesh; leg2: Mesh; tail: Mesh } | null = null

function getBlob3DMeshes() {
  if (blob3DMeshes) return blob3DMeshes
  blob3DMeshes = {
    body: buildSphere(20, 'hsl(280, 70%, 60%)', 10, 6),
    eye1: buildSphere(4, 'hsl(0, 0%, 10%)', 8, 5),
    eye2: buildSphere(4, 'hsl(0, 0%, 10%)', 8, 5),
  }
  return blob3DMeshes
}

function getCat3DMeshes() {
  if (cat3DMeshes) return cat3DMeshes
  cat3DMeshes = {
    body: buildSphere(18, 'hsl(25, 75%, 55%)', 10, 6),
    ear1: buildCone(6, 12, 'hsl(25, 75%, 50%)', 6),
    ear2: buildCone(6, 12, 'hsl(25, 75%, 50%)', 6),
    eye1: buildSphere(3.5, 'hsl(0, 0%, 10%)', 8, 5),
    eye2: buildSphere(3.5, 'hsl(0, 0%, 10%)', 8, 5),
    leg1: buildCylinder(4, 10, 'hsl(25, 70%, 45%)', 6),
    leg2: buildCylinder(4, 10, 'hsl(25, 70%, 45%)', 6),
    tail: buildCylinder(3, 20, 'hsl(25, 75%, 50%)', 6),
  }
  return cat3DMeshes
}

export function draw3DCharacter(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  if (c.type === 'blob3d') {
    drawBlob3D(ctx, c, time)
  } else if (c.type === 'cat3d') {
    drawCat3D(ctx, c, time)
  }
}

function drawBlob3D(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  const meshes = getBlob3DMeshes()
  const cx = c.x
  const cy = c.y
  const scale = c.squashY // use squash for slight 3D squash effect
  const rotY = time * 0.5 // gentle rotation
  const rotX = Math.sin(time * 0.3) * 0.1 // subtle bob

  // Body — large sphere
  drawMesh3D(ctx, meshes.body, cx, cy, rotX, rotY, 0, scale, 180)

  // Eyes — positioned on the front of the sphere
  // They rotate with the body so they stay on the surface
  const eyeOffsetX = Math.sin(rotY) * 8
  const eyeZ = Math.cos(rotY) * 15
  if (eyeZ > 0) {  // only draw eyes if they're facing us
    drawMesh3D(ctx, meshes.eye1, cx - 6 + eyeOffsetX, cy - 4, 0, 0, 0, scale, 180)
    drawMesh3D(ctx, meshes.eye2, cx + 6 + eyeOffsetX, cy - 4, 0, 0, 0, scale, 180)
  }

  // Hurt mood = red
  if (c.mood === 'hurt') {
    meshes.body.faces.forEach(f => f.color = 'hsl(0, 80%, 50%)')
  } else {
    meshes.body.faces.forEach(f => f.color = 'hsl(280, 70%, 60%)')
  }
}

function drawCat3D(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  const meshes = getCat3DMeshes()
  const cx = c.x
  const cy = c.y
  const scale = c.squashY
  const rotY = time * 0.4 // gentle rotation
  const rotX = Math.sin(time * 0.3) * 0.08

  // Body
  drawMesh3D(ctx, meshes.body, cx, cy, rotX, rotY, 0, scale, 180)

  // Ears — positioned on top of body, rotated with body
  const earRotY = rotY
  drawMesh3D(ctx, meshes.ear1, cx - 10, cy - 16, rotX, earRotY, 0, scale, 180)
  drawMesh3D(ctx, meshes.ear2, cx + 10, cy - 16, rotX, earRotY, 0, scale, 180)

  // Eyes — only if facing camera
  const eyeOffsetX = Math.sin(rotY) * 6
  const eyeZ = Math.cos(rotY) * 14
  if (eyeZ > 0) {
    drawMesh3D(ctx, meshes.eye1, cx - 6 + eyeOffsetX, cy - 2, 0, 0, 0, scale, 180)
    drawMesh3D(ctx, meshes.eye2, cx + 6 + eyeOffsetX, cy - 2, 0, 0, 0, scale, 180)
  }

  // Legs — small cylinders at the bottom
  drawMesh3D(ctx, meshes.leg1, cx - 8, cy + 18, 0, 0, 0, scale, 180)
  drawMesh3D(ctx, meshes.leg2, cx + 8, cy + 18, 0, 0, 0, scale, 180)

  // Tail — cylinder extending behind/beside
  const tailSway = Math.sin(time * 1.5) * 0.3
  drawMesh3D(ctx, meshes.tail, cx + 16, cy + 8, tailSway, 0, 0.3, scale, 180)

  // Hurt mood = red
  if (c.mood === 'hurt') {
    meshes.body.faces.forEach(f => f.color = 'hsl(0, 80%, 50%)')
    meshes.ear1.faces.forEach(f => f.color = 'hsl(0, 80%, 45%)')
    meshes.ear2.faces.forEach(f => f.color = 'hsl(0, 80%, 45%)')
  } else {
    meshes.body.faces.forEach(f => f.color = 'hsl(25, 75%, 55%)')
    meshes.ear1.faces.forEach(f => f.color = 'hsl(25, 75%, 50%)')
    meshes.ear2.faces.forEach(f => f.color = 'hsl(25, 75%, 50%)')
  }
}
