// Core game type definitions

export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover'

export type CharacterType = 'pip' | 'pixel' | 'mochi' | 'yuki' | 'kuro' | 'bongo' | 'popcat' | 'neon' | 'blob3d' | 'cat3d' | 'spark' | 'mochi2' | 'juri' | 'pixelbot' | 'ragdoll' | 'geometric' | 'shadow' | 'fox3d' | 'robot3d'

export const CHARACTER_NAMES: Record<CharacterType, string> = {
  pip: 'Pip', pixel: 'Pixel', mochi: 'Mochi', yuki: 'Yuki', kuro: 'Kuro',
  bongo: 'Bongo', popcat: 'Pop', neon: 'Neon', blob3d: 'Blob3D', cat3d: 'Cat3D',
  spark: 'Spark', mochi2: 'Mochi2', juri: 'Juri', pixelbot: 'PixelBot',
  ragdoll: 'Ragdoll', geometric: 'Geo', shadow: 'Shadow',
  fox3d: 'Fox3D', robot3d: 'Robot3D',
}

export const CHARACTER_DESCRIPTIONS: Record<CharacterType, string> = {
  pip: 'A springy pink blob with a glowing antenna. Always bubbly.',
  pixel: 'A retro mint robot with a screen face. Bleeps in binary.',
  mochi: 'An orange cat with headphones. Lives for the rhythm.',
  yuki: 'A soft snow cat with a blue scarf. Quiet and gentle.',
  kuro: 'A sleek night cat with glowing eyes. Mysterious and calm.',
  bongo: 'The legendary Bongo Cat. Paws ready to jam.',
  popcat: 'The iconic Pop Cat. Mouth goes pop!',
  neon: 'A holographic cyber-cat made of pure light. From the grid.',
  blob3d: 'A smooth 3D blob with proper lighting. Next-gen cute.',
  cat3d: 'A fully 3D cat with depth and shading. Rendered in real-time.',
  spark: 'A living energy serpent. Flowing, luminous, alive.',
  mochi2: 'The cutest cloud-fox ever. Huge sparkly eyes, fluffy tail.',
  juri: 'Juri Han — the spider from Street Fighters 6. Sadistic and deadly.',
  pixelbot: 'A pixel-art animated robot with frame-based sprite animation.',
  ragdoll: 'A ragdoll character with spring-physics body parts. Floppy and alive.',
  geometric: 'A geometric vector character with rotating shapes. Modern indie style.',
  shadow: 'A mysterious silhouette with glowing eyes. Dark and minimalist.',
  fox3d: 'A real 3D fox model (CC0) with Walk/Run/Survey animations. Imported glTF.',
  robot3d: 'A real 3D robot model (CC-BY) with 14 animations. Imported glTF.',
}

/** Whether a character uses the 3D engine */
export function is3DCharacter(type: CharacterType): boolean {
  return type === 'blob3d' || type === 'cat3d'
}

export type CharacterMood =
  | 'idle'
  | 'charging'   // just before bounce
  | 'jumping'    // moving up fast
  | 'rising'     // moving up slow / apex
  | 'falling'    // moving down
  | 'scared'     // close to bottom of screen
  | 'joyful'     // high altitude boost
  | 'hurt'       // game over
  | 'dizzy'      // brief after bounce on bouncy pad

export type PlatformType =
  | 'normal'
  | 'bouncy'    // extra boost
  | 'moving'    // slides left/right
  | 'fragile'   // breaks after one bounce
  | 'boost'     // rocket-style launch

export interface Vec2 {
  x: number
  y: number
}

export interface Platform {
  id: number
  x: number
  y: number
  w: number
  h: number
  type: PlatformType
  vx: number          // horizontal velocity (for moving platforms)
  broken: boolean     // for fragile
  used: boolean       // for boost (consumed)
  wobble: number      // bounce animation
  glow: number        // glow strength 0..1
  hue: number         // color hue
  born: number        // creation time for fade-in
  cloudPhase: number  // for cloud puff animation
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number        // remaining lifetime seconds
  maxLife: number
  size: number
  hue: number
  sat: number
  light: number
  alpha: number
  shape: 'circle' | 'star' | 'spark' | 'ring' | 'square'
  rotation: number
  vrot: number
  gravity: number
  drag: number
}

export interface FloatingText {
  x: number
  y: number
  vy: number
  text: string
  life: number
  maxLife: number
  hue: number
  size: number
}

export interface Cloud {
  x: number
  y: number
  scale: number
  speed: number       // parallax speed factor 0..1
  alpha: number
  seed: number
}

export interface Star {
  x: number
  y: number
  size: number
  twinkle: number
  twinkleSpeed: number
  alpha: number
}

export interface CharacterState {
  type: CharacterType
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  mood: CharacterMood
  squashX: number       // 1 = neutral, <1 = squashed horizontally
  squashY: number
  blinkTimer: number
  blinkPhase: number    // 0 open, 1 closing, 2 closed, 3 opening
  facing: number        // -1 left, 1 right
  armSwing: number
  antennaWave: number
  trail: { x: number; y: number; life: number; size: number; hue: number }[]
  dizzyTimer: number
  joyTimer: number
  breathPhase: number   // gentle idle breathing
  rotation: number      // visual tilt based on vx
  earWiggle: number
  eyeOffsetX: number    // pupil look direction
  eyeOffsetY: number
  mouthOpen: number     // 0..1
  blushIntensity: number
  invulnBoost: number   // brief invuln after boost
}

export interface CameraState {
  x: number
  y: number
  targetY: number
  shake: number
  shakeOffsetX: number
  shakeOffsetY: number
  zoom: number
  zoomTarget: number
}

export interface GameState {
  phase: GamePhase
  time: number          // seconds since start
  score: number
  altitude: number      // max altitude reached (px)
  height: number        // current height in meters
  bestHeight: number
  combo: number         // consecutive jumps without falling
  musicStep: number     // musical progression counter
  lastBouncedPlatformId: number | null  // for dip detection
  lastBouncePlatformY: number           // y-coord of last bounce (lower = higher altitude)
  lastBounceWasProgress: boolean        // for UI feedback
  character: CharacterState
  camera: CameraState
  platforms: Platform[]
  particles: Particle[]
  floatingTexts: FloatingText[]
  clouds: Cloud[]
  stars: Star[]
  worldHue: number      // base background hue shift
  worldSat: number
  worldLight: number
  difficulty: number    // ramps with altitude
  inputDir: number      // -1, 0, 1 (touch/tilt)
  inputAccel: number    // smoothed input
  nextPlatformId: number
  highestPlatformY: number
  bottomY: number       // current bottom of the world (kill plane)
  flashAlpha: number    // screen flash for boosts / events
  flashHue: number
  vignettePulse: number
  slowMo: number        // 1 = normal, <1 = slow motion (for impacts)
  paused: boolean
  bgPulse: number       // background breathing
  perfMode: boolean     // performance mode — disables post-processing
}

export interface GameCallbacks {
  onScoreChange?: (score: number) => void
  onHeightChange?: (height: number) => void
  onComboChange?: (combo: number) => void
  onPhaseChange?: (phase: GamePhase) => void
  onGameOver?: (height: number, score: number) => void
}
