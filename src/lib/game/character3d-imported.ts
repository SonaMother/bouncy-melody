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
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)

    // Position camera based on model type
    if (type === 'fox') {
      camera.position.set(0, 30, 70)
      camera.lookAt(0, 10, 0)
    } else {
      camera.position.set(0, 1.5, 4)
      camera.lookAt(0, 1, 0)
    }

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,  // needed for drawImage compositing
    })
    renderer.setSize(64, 64)  // small sprite size
    renderer.setClearColor(0x000000, 0)  // transparent background

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
    dirLight.position.set(2, 5, 3)
    scene.add(dirLight)

    // Load model
    const loader = new GLTFLoader()
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })

    const model = gltf.scene
    scene.add(model)

    // Scale and position based on model type
    if (type === 'fox') {
      model.scale.set(0.8, 0.8, 0.8)
    } else {
      model.scale.set(1.2, 1.2, 1.2)
    }

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
    console.log(`3D model loaded: ${type} (${Object.keys(animations).length} animations)`)
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
