// 3D Character Renderer — loads real 3D models (glTF/GLB) via Three.js
// and renders them to an offscreen canvas, then composites onto the game's Canvas2D.
//
// This demonstrates importing real 3D animated models:
// - Fox (CC0): cute low-poly fox with Walk/Run/Survey animations
// - RobotExpressive (CC-BY): cute robot with 14 animations (Idle, Jump, Walk, etc.)
//
// The 3D scene renders to a small offscreen WebGL canvas, then we use
// ctx.drawImage() to composite it into the 2D game canvas at the character's position.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type Model3DType = 'fox' | 'robot'

interface Model3DState {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  mixer: THREE.AnimationMixer | null
  model: THREE.Group | null
  animations: Record<string, THREE.AnimationAction>
  clock: THREE.Clock
  loaded: boolean
}

const modelCache: Map<string, Model3DState> = new Map()

/** Load a 3D model and create a render context for it. */
export async function loadModel3D(type: Model3DType): Promise<Model3DState | null> {
  const url = type === 'fox' ? '/models/Fox.glb' : '/models/RobotExpressive.glb'

  // Check cache
  if (modelCache.has(type)) return modelCache.get(type)!

  try {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    })
    renderer.setSize(128, 128)  // bigger canvas — was 64 (too small, cropped models)
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(1)

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(3, 5, 4)
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.4)
    fillLight.position.set(-3, 2, -2)
    scene.add(fillLight)

    // Load model
    const loader = new GLTFLoader()
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })

    const model = gltf.scene
    scene.add(model)

    // Compute bounding box to properly frame the model
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Normalize model: center it at origin and scale to fit
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim === 0) {
      console.warn(`3D model ${type} has zero size`)
      return null
    }

    // Different target sizes per model type
    let targetSize: number
    let scaleDim: 'x' | 'y' | 'z'  // which dimension to use for scaling
    if (type === 'fox') {
      targetSize = 3.0
      scaleDim = 'y'  // fox is very long in Z (tail), use height (Y) for scaling
    } else {
      targetSize = 2.5
      scaleDim = 'y'  // use height for humanoid too
    }

    const refDim = size[scaleDim]
    if (refDim === 0) {
      console.warn(`3D model ${type} has zero ${scaleDim} size`)
      return null
    }
    const scale = targetSize / refDim
    model.scale.setScalar(scale)

    // Re-center after scaling
    const scaledBox = new THREE.Box3().setFromObject(model)
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3())
    model.position.sub(scaledCenter)

    // Position camera based on model type
    // Fox: side view (it's a horizontal animal)
    // Robot: front view (it's a vertical humanoid)
    if (type === 'fox') {
      camera.position.set(0, 0, targetSize * 2.0)
    } else {
      camera.position.set(0, 0, targetSize * 1.6)
    }
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()

    console.log(`3D model ${type}: size=${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)} scale=${scale.toFixed(2)} target=${targetSize}`)

    // Set up animations
    const mixer = new THREE.AnimationMixer(model)
    const animations: Record<string, THREE.AnimationAction> = {}

    if (gltf.animations && gltf.animations.length > 0) {
      for (const clip of gltf.animations) {
        const action = mixer.clipAction(clip)
        animations[clip.name.toLowerCase()] = action
      }
      // Play idle/walk by default
      const idleAnim = animations['idle'] || animations['survey'] || animations['standing'] || Object.values(animations)[0]
      if (idleAnim) idleAnim.play()
    }

    const state: Model3DState = {
      scene, camera, renderer, mixer, model, animations,
      clock: new THREE.Clock(),
      loaded: true,
    }

    modelCache.set(type, state)
    console.log(`3D model loaded: ${type} (${Object.keys(animations).length} animations: ${Object.keys(animations).join(', ')})`)
    return state
  } catch (e) {
    console.warn(`Failed to load 3D model ${type}:`, e)
    return null
  }
}

/** Update the 3D model animation and render it to the offscreen canvas. */
export function renderModel3D(state: Model3DState, mood: string, vy: number): HTMLCanvasElement | null {
  if (!state.loaded) return null

  // Update animation
  if (state.mixer) {
    const dt = state.clock.getDelta()
    state.mixer.update(dt)

    // Switch animation based on game state
    const currentAction = Object.values(state.animations).find(a => a.isRunning())
    let desiredAnim: string

    if (mood === 'hurt') {
      desiredAnim = 'death' in state.animations ? 'death' : 'idle'
    } else if (vy < -100) {
      desiredAnim = 'jump' in state.animations ? 'jump' : 'run' in state.animations ? 'run' : 'walk'
    } else if (vy > 200) {
      desiredAnim = 'idle' in state.animations ? 'idle' : 'survey'
    } else {
      desiredAnim = 'walk' in state.animations ? 'walk' : 'idle' in state.animations ? 'idle' : 'survey'
    }

    const desired = state.animations[desiredAnim]
    if (desired && desired !== currentAction) {
      currentAction?.fadeOut(0.2)
      desired.reset().fadeIn(0.2).play()
    }
  }

  // Render to offscreen canvas
  state.renderer.render(state.scene, state.camera)
  return state.renderer.domElement
}

/** Preload a 3D model (call on game start). */
export async function preloadModel3D(type: Model3DType) {
  return loadModel3D(type)
}
