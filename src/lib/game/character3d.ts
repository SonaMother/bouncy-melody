// 3D Character Engine — renders 3D meshes using Canvas2D with proper 3D math.
//
// This is a separate engine from the 2D character renderer. It uses:
// - 3D vertex math (rotation matrices, perspective projection)
// - Mesh definitions (vertices + faces with colors)
// - Z-sorting (painter's algorithm) for correct depth
// - Lambertian shading (dot product with light direction)
//
// The result is smooth, high-FPS 3D-looking characters that render on
// the same canvas as the 2D game, with no external dependencies.

// ---- 3D Math ----

export interface Vec3 { x: number; y: number; z: number }

export function vec3(x: number, y: number, z: number): Vec3 { return { x, y, z } }

export function rotateX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }
}

export function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
}

export function rotateZ(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z }
}

/** Project a 3D point to 2D screen coordinates using perspective projection */
export function project(v: Vec3, focalLength: number, centerX: number, centerY: number): { x: number; y: number; scale: number } {
  const z = v.z + focalLength
  if (z <= 0.1) return { x: centerX, y: centerY, scale: 0 }
  const scale = focalLength / z
  return { x: v.x * scale + centerX, y: v.y * scale + centerY, scale }
}

// ---- Mesh definitions ----

export interface Face {
  vertices: number[]  // indices into the vertices array
  color: string       // base color
  normal?: Vec3       // face normal (computed or manual)
}

export interface Mesh {
  vertices: Vec3[]
  faces: Face[]
}

// ---- Mesh builders ----

/** Build a UV sphere mesh */
export function buildSphere(radius: number, color: string, segments = 12, rings = 8): Mesh {
  const vertices: Vec3[] = []
  const faces: Face[] = []

  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2
      vertices.push({
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
      })
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s
      const b = a + segments + 1
      faces.push({
        vertices: [a, b, a + 1],
        color,
      })
      faces.push({
        vertices: [b, b + 1, a + 1],
        color,
      })
    }
  }

  return { vertices, faces }
}

/** Build a cylinder mesh (for limbs, ears, etc.) */
export function buildCylinder(radius: number, height: number, color: string, segments = 8): Mesh {
  const vertices: Vec3[] = []
  const faces: Face[] = []

  // Top and bottom rings
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    vertices.push({ x: radius * Math.cos(angle), y: -height / 2, z: radius * Math.sin(angle) })
  }
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    vertices.push({ x: radius * Math.cos(angle), y: height / 2, z: radius * Math.sin(angle) })
  }

  // Side faces
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    faces.push({
      vertices: [i, next, segments + next],
      color,
    })
    faces.push({
      vertices: [i, segments + next, segments + i],
      color,
    })
  }

  // Top cap
  const topCenter = vertices.length
  vertices.push({ x: 0, y: height / 2, z: 0 })
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    faces.push({ vertices: [segments + i, segments + next, topCenter], color })
  }

  // Bottom cap
  const bottomCenter = vertices.length
  vertices.push({ x: 0, y: -height / 2, z: 0 })
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    faces.push({ vertices: [next, i, bottomCenter], color })
  }

  return { vertices, faces }
}

/** Build a cone mesh (for ears) */
export function buildCone(radius: number, height: number, color: string, segments = 8): Mesh {
  const vertices: Vec3[] = []
  const faces: Face[] = []

  // Base ring
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    vertices.push({ x: radius * Math.cos(angle), y: -height / 2, z: radius * Math.sin(angle) })
  }
  // Tip
  const tip = vertices.length
  vertices.push({ x: 0, y: height / 2, z: 0 })

  // Side faces
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    faces.push({ vertices: [i, next, tip], color })
  }

  // Bottom cap
  const bottomCenter = vertices.length
  vertices.push({ x: 0, y: -height / 2, z: 0 })
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    faces.push({ vertices: [next, i, bottomCenter], color })
  }

  return { vertices, faces }
}

// ---- Transformed mesh (for rendering) ----

interface TransformedFace {
  projected: { x: number; y: number; scale: number }[]
  avgZ: number
  color: string
  brightness: number
}

/** Compute face normal from 3 vertices */
function computeNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
  const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z
  const bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z
  // Cross product
  return {
    x: ay * bz - az * by,
    y: az * bx - ax * bz,
    z: ax * by - ay * bx,
  }
}

/** Normalize a vector */
function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (len < 0.0001) return { x: 0, y: 0, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

// Light direction (pointing toward the camera, slightly up-left)
const LIGHT_DIR = normalize({ x: -0.5, y: -0.6, z: 1 })

/**
 * Render a 3D mesh to a Canvas2D context.
 * The mesh is positioned at (cx, cy) in screen space.
 * rotX, rotY, rotZ are rotation angles.
 * scale is the overall scale factor.
 */
export function drawMesh3D(
  ctx: CanvasRenderingContext2D,
  mesh: Mesh,
  cx: number,
  cy: number,
  rotX: number,
  rotY: number,
  rotZ: number,
  scale: number,
  focalLength: number = 200,
) {
  // Transform all vertices
  const transformed: Vec3[] = mesh.vertices.map(v => {
    let p = { x: v.x * scale, y: v.y * scale, z: v.z * scale }
    p = rotateX(p, rotX)
    p = rotateY(p, rotY)
    p = rotateZ(p, rotZ)
    return p
  })

  // Project and sort faces
  const faces: TransformedFace[] = []

  for (const face of mesh.faces) {
    if (face.vertices.length < 3) continue

    // Get transformed vertices for this face
    const fv = face.vertices.map(i => transformed[i])
    const origFv = face.vertices.map(i => mesh.vertices[i])

    // Compute face normal (in original space, then rotate)
    const origNormal = computeNormal(origFv[0], origFv[1], origFv[2])
    let rotatedNormal = rotateX(origNormal, rotX)
    rotatedNormal = rotateY(rotatedNormal, rotY)
    rotatedNormal = rotateZ(rotatedNormal, rotZ)
    rotatedNormal = normalize(rotatedNormal)

    // Backface culling — skip faces pointing away from camera
    if (rotatedNormal.z >= 0) continue

    // Lambertian shading — brightness based on angle to light
    const dot = Math.abs(rotatedNormal.x * LIGHT_DIR.x + rotatedNormal.y * LIGHT_DIR.y + rotatedNormal.z * LIGHT_DIR.z)
    const brightness = 0.4 + dot * 0.6  // 0.4 ambient + 0.6 diffuse

    // Project vertices
    const projected = fv.map(v => project(v, focalLength, cx, cy))

    // Average Z for sorting
    const avgZ = fv.reduce((sum, v) => sum + v.z, 0) / fv.length

    faces.push({
      projected,
      avgZ,
      color: face.color,
      brightness,
    })
  }

  // Sort by average Z (far to near — painter's algorithm)
  faces.sort((a, b) => a.avgZ - b.avgZ)

  // Draw faces
  for (const face of faces) {
    ctx.fillStyle = adjustBrightness(face.color, face.brightness)
    ctx.beginPath()
    ctx.moveTo(face.projected[0].x, face.projected[0].y)
    for (let i = 1; i < face.projected.length; i++) {
      ctx.lineTo(face.projected[i].x, face.projected[i].y)
    }
    ctx.closePath()
    ctx.fill()
  }
}

/** Adjust the brightness of an HSL color string */
function adjustBrightness(color: string, factor: number): string {
  // Parse hsl(h, s%, l%) format
  const match = color.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/)
  if (match) {
    const h = parseInt(match[1])
    const s = parseInt(match[2])
    let l = parseInt(match[3])
    l = Math.max(5, Math.min(95, Math.round(l * factor)))
    return `hsl(${h}, ${s}%, ${l}%)`
  }
  // Parse hex format
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    const nr = Math.max(0, Math.min(255, Math.round(r * factor)))
    const ng = Math.max(0, Math.min(255, Math.round(g * factor)))
    const nb = Math.max(0, Math.min(255, Math.round(b * factor)))
    return `rgb(${nr}, ${ng}, ${nb})`
  }
  return color
}
