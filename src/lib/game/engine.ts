// Core game engine: physics, platform generation, update loop, collision

import type {
  GameState,
  Platform,
  PlatformType,
  CharacterState,
  CharacterMood,
  CharacterType,
} from './types'
import {
  spawnBounceParticles,
  spawnBouncyParticles,
  spawnBoostParticles,
  spawnBreakParticles,
  spawnLandingRing,
  spawnFloatingText,
  spawnGameOverBurst,
  spawnPixelBurst,
  spawnSubPixelDust,
  spawnPixelTrail,
  spawnPixelSparks,
  updateParticles,
  updateFloatingTexts,
} from './particles'
import {
  addTrailPoint,
  updateCharacterAnimation,
} from './character'
import {
  initStars,
} from './render'
import type { MusicEngine } from './audio'

export const WORLD_WIDTH = 420       // logical play area width
export const GRAVITY = 1400          // px/s^2
export const JUMP_VELOCITY = -780    // normal bounce
export const BOUNCY_VELOCITY = -1180 // bouncy bounce
export const BOOST_VELOCITY = -1900  // boost pad
export const MOVE_ACCEL = 2400
export const MOVE_MAX = 360
export const MOVE_FRICTION = 0.86
export const PIXELS_PER_METER = 60

export function createInitialState(width: number, height: number, characterType: CharacterType = 'pip'): GameState {
  const character: CharacterState = {
    type: characterType,
    x: WORLD_WIDTH / 2,
    y: height - 200,
    vx: 0,
    vy: 0,
    w: 56,
    h: 56,
    mood: 'idle',
    squashX: 1,
    squashY: 1,
    blinkTimer: 2,
    blinkPhase: 0,
    facing: 1,
    armSwing: 0,
    antennaWave: 0,
    trail: [],
    dizzyTimer: 0,
    joyTimer: 0,
    breathPhase: 0,
    rotation: 0,
    earWiggle: 0,
    eyeOffsetX: 0,
    eyeOffsetY: 0,
    mouthOpen: 0,
    blushIntensity: 0.3,
    invulnBoost: 0,
  }

  const platforms: Platform[] = []
  generateInitialPlatforms(platforms, height, 0)
  // Compute next id and highest platform y from generated platforms
  let nextId = 0
  let highestY = 0
  for (const p of platforms) {
    if (p.id >= nextId) nextId = p.id + 1
    if (p.y < highestY) highestY = p.y
  }

  return {
    phase: 'menu',
    time: 0,
    score: 0,
    altitude: 0,
    height: 0,
    bestHeight: 0,
    combo: 0,
    musicStep: 0,
    lastBouncedPlatformId: null,
    lastBouncePlatformY: 0,
    lastBounceWasProgress: false,
    character,
    camera: {
      x: 0,
      y: 0,
      targetY: 0,
      shake: 0,
      shakeOffsetX: 0,
      shakeOffsetY: 0,
      zoom: 1,
      zoomTarget: 1,
    },
    platforms,
    particles: [],
    floatingTexts: [],
    clouds: [],
    stars: initStars(width, height),
    worldHue: 220,
    worldSat: 60,
    worldLight: 55,
    difficulty: 0,
    inputDir: 0,
    inputAccel: 0,
    nextPlatformId: nextId,
    highestPlatformY: highestY,
    bottomY: height + 100,
    flashAlpha: 0,
    flashHue: 0,
    vignettePulse: 0,
    slowMo: 1,
    paused: false,
    bgPulse: 0,
    perfMode: true,  // post-processing OFF by default for performance
  }
}

function makePlatform(id: number, x: number, y: number, w: number, h: number, type: PlatformType): Platform {
  return {
    id,
    x, y, w, h,
    type,
    vx: type === 'moving' ? (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60) : 0,
    broken: false,
    used: false,
    wobble: 0,
    glow: type === 'boost' ? 0.8 : (type === 'bouncy' ? 0.4 : 0.2),
    hue: 0,
    born: 0,
    cloudPhase: Math.random() * Math.PI * 2,
  }
}

function pickPlatformType(difficulty: number): PlatformType {
  const r = Math.random()
  // Easy mode: mostly normal, some bouncy, occasional moving
  if (difficulty < 1) {
    if (r < 0.60) return 'normal'
    if (r < 0.80) return 'bouncy'
    if (r < 0.92) return 'moving'
    if (r < 0.97) return 'boost'
    return 'fragile'
  }
  if (difficulty < 2) {
    if (r < 0.50) return 'normal'
    if (r < 0.70) return 'bouncy'
    if (r < 0.85) return 'moving'
    if (r < 0.93) return 'boost'
    return 'fragile'
  }
  if (r < 0.40) return 'normal'
  if (r < 0.60) return 'bouncy'
  if (r < 0.80) return 'moving'
  if (r < 0.90) return 'fragile'
  return 'boost'
}

export function resetForPlay(state: GameState, width: number, height: number) {
  state.phase = 'playing'
  state.time = 0
  state.score = 0
  state.altitude = 0
  state.height = 0
  state.combo = 0
  state.musicStep = 0
  state.lastBouncedPlatformId = null
  state.lastBouncePlatformY = 0
  state.lastBounceWasProgress = false
  state.difficulty = 0
  state.character.x = WORLD_WIDTH / 2
  state.character.y = height - 200
  state.character.vx = 0
  state.character.vy = JUMP_VELOCITY
  state.character.mood = 'jumping'
  state.character.trail = []
  state.character.dizzyTimer = 0
  state.character.joyTimer = 0
  state.character.invulnBoost = 0
  state.character.squashX = 0.85
  state.character.squashY = 1.2
  state.camera.y = 0
  state.camera.targetY = 0
  state.camera.shake = 0
  state.camera.zoom = 1
  state.camera.zoomTarget = 1
  state.particles = []
  state.floatingTexts = []
  state.clouds = []
  state.stars = initStars(width, height)
  state.worldHue = 220
  state.worldSat = 60
  state.worldLight = 55
  state.bottomY = height + 100
  state.flashAlpha = 0
  state.slowMo = 1
  state.paused = false
  state.bgPulse = 0

  // Regenerate platforms
  state.platforms = []
  generateInitialPlatforms(state.platforms, height, state.nextPlatformId)
  // Update nextPlatformId and highestPlatformY from generated platforms
  let maxId = 0
  let highestY = 0
  for (const p of state.platforms) {
    if (p.id >= maxId) maxId = p.id + 1
    if (p.y < highestY) highestY = p.y
  }
  state.nextPlatformId = maxId
  state.highestPlatformY = highestY
}

/**
 * Generate the initial set of platforms with guaranteed-reachable first few.
 * The first 4 platforms are carefully placed: small gaps, centered horizontally,
 * always normal type. After that, difficulty ramps up gradually.
 */
function generateInitialPlatforms(platforms: Platform[], height: number, startId: number) {
  let id = startId
  // Starting platform — wide, centered, right under the character
  platforms.push(makePlatform(id++, WORLD_WIDTH / 2 - 65, height - 130, 130, 18, 'normal'))

  // First 4 platforms after start: guaranteed reachable
  // Gaps: 90, 100, 110, 120 (gradual increase)
  // X positions: stay within ±100px of center for the first 3
  const safeGaps = [90, 100, 110, 120]
  const safeXOffsets = [0, -40, 50, -30]  // small horizontal shifts near center
  let y = height - 130
  for (let i = 0; i < safeGaps.length; i++) {
    y -= safeGaps[i]
    const x = WORLD_WIDTH / 2 - 50 + safeXOffsets[i]
    const w = 110  // wider for safety
    platforms.push(makePlatform(id++, x, y, w, 18, 'normal'))
  }

  // After the safe zone, generate normally but with slightly easier difficulty
  while (y > -3000) {
    const gap = 85 + Math.random() * 75  // 85-160px (reachable with normal jump)
    y -= gap
    const x = 30 + Math.random() * (WORLD_WIDTH - 130)
    const w = 90 + Math.random() * 30
    const type = pickPlatformType(0)
    platforms.push(makePlatform(id++, x, y, w, 18, type))
  }
}

/** Generate platforms above as the character climbs. */
function ensurePlatformsAbove(state: GameState, topScreenY: number) {
  // Keep generating until highestPlatformY is well above the top of the screen
  while (state.highestPlatformY > topScreenY - 800) {
    const gap = 80 + Math.random() * (80 + state.difficulty * 20)
    state.highestPlatformY -= gap
    const w = Math.max(70, 100 - state.difficulty * 5 + Math.random() * 30)
    const x = 30 + Math.random() * (WORLD_WIDTH - w - 30)
    const type = pickPlatformType(state.difficulty)
    const p = makePlatform(state.nextPlatformId++, x, state.highestPlatformY, w, 18, type)
    p.born = state.time
    state.platforms.push(p)
  }

  // Remove platforms far below
  const bottomScreenY = state.camera.y + 1000
  for (let i = state.platforms.length - 1; i >= 0; i--) {
    if (state.platforms[i].y > bottomScreenY) {
      state.platforms.splice(i, 1)
    }
  }
}

export interface UpdateContext {
  width: number
  height: number
  dt: number
  music: MusicEngine
  onGameOver: () => void
  onJump: (kind: 'progress' | 'same' | 'dip') => void
  onJumpMulti: (count: number, kind: 'progress' | 'same' | 'dip') => void
  onBoost: () => void
  onBouncy: () => void
  onBreak: () => void
}

export function updateGame(state: GameState, ctx: UpdateContext) {
  if (state.paused) return
  if (state.phase === 'menu') {
    updateMenu(state, ctx)
    return
  }
  if (state.phase !== 'playing') return

  const dt = Math.min(0.05, ctx.dt * state.slowMo)
  state.time += dt

  // Ease slow-mo back to 1
  state.slowMo += (1 - state.slowMo) * Math.min(1, dt * 4)

  // Difficulty ramps with altitude
  state.difficulty = Math.min(3, state.height / 200)

  // Update character animation
  updateCharacterAnimation(state.character, dt, state.time)

  // --- Input ---
  const c = state.character
  state.inputAccel += (state.inputDir - state.inputAccel) * Math.min(1, dt * 12)
  c.vx += state.inputAccel * MOVE_ACCEL * dt
  c.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, c.vx))
  // Friction when no input
  if (Math.abs(state.inputDir) < 0.1) {
    c.vx *= Math.pow(MOVE_FRICTION, dt * 60)
  }
  if (c.vx > 5) c.facing = 1
  else if (c.vx < -5) c.facing = -1

  // --- Physics ---
  c.vy += GRAVITY * dt
  c.x += c.vx * dt
  c.y += c.vy * dt

  // Wrap horizontally (Doodle Jump style)
  if (c.x < -c.w / 2) c.x = WORLD_WIDTH + c.w / 2
  if (c.x > WORLD_WIDTH + c.w / 2) c.x = -c.w / 2

  // --- Platform collisions (only when falling) ---
  if (c.vy > 0) {
    for (const p of state.platforms) {
      if (p.broken || p.used) continue
      const cx = c.x
      const cyBottom = c.y + c.h * 0.4
      const prevCyBottom = cyBottom - c.vy * dt
      // AABB-ish check
      if (
        cx > p.x - c.w * 0.35 &&
        cx < p.x + p.w + c.w * 0.35 &&
        cyBottom >= p.y &&
        prevCyBottom <= p.y + 4
      ) {
        // Bounce!
        handleBounce(state, p, ctx)
        break
      }
    }
  }

  // Update platform behaviors
  for (const p of state.platforms) {
    if (p.type === 'moving' && !p.broken) {
      p.x += p.vx * dt
      if (p.x < 10) { p.x = 10; p.vx = -p.vx }
      if (p.x + p.w > WORLD_WIDTH - 10) { p.x = WORLD_WIDTH - 10 - p.w; p.vx = -p.vx }
    }
    // Wobble decay
    p.wobble *= Math.pow(0.001, dt)
    // Glow decay (boost pads pulse)
    if (p.type === 'boost') {
      p.glow = 0.5 + 0.3 * Math.sin(state.time * 6 + p.id)
    } else if (p.type === 'bouncy') {
      p.glow = 0.3 + 0.2 * Math.sin(state.time * 4 + p.id * 0.5)
    } else {
      p.glow *= Math.pow(0.001, dt)
    }
    p.cloudPhase += dt
  }

  // --- Camera follow ---
  // Camera follows character only when going up (Doodle Jump rule)
  const targetCameraY = Math.min(state.camera.y, c.y - ctx.height * 0.45)
  state.camera.targetY = targetCameraY
  state.camera.y += (state.camera.targetY - state.camera.y) * Math.min(1, dt * 6)

  // Update altitude/height
  const altitude = -state.camera.y
  const prevHeight = state.height
  if (altitude > state.altitude) {
    state.altitude = altitude
    state.height = Math.floor(altitude / PIXELS_PER_METER)
    if (state.height > state.bestHeight) state.bestHeight = state.height
  }
  state.score = state.height * 10 + state.combo * 5

  // Height milestone notifications (every 50m)
  const MILESTONE = 50
  if (Math.floor(prevHeight / MILESTONE) < Math.floor(state.height / MILESTONE) && state.height > 0) {
    const milestone = Math.floor(state.height / MILESTONE) * MILESTONE
    spawnFloatingText(state, c.x, c.y - 60, `${milestone}m!`, 50, 32)
    state.flashAlpha = Math.max(state.flashAlpha, 0.3)
    state.flashHue = 50
    // Extra burst
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 100 + Math.random() * 200
      state.particles.push({
        x: c.x, y: c.y - 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.8, maxLife: 0.8,
        size: 4 + Math.random() * 5,
        hue: 50 + Math.random() * 30,
        sat: 90, light: 70, alpha: 1,
        shape: 'star',
        rotation: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 14,
        gravity: 300, drag: 0.94,
      })
    }
  }

  // Bottom kill plane — moves up slowly to add tension
  state.bottomY = Math.min(state.bottomY, state.camera.y + ctx.height + 60)

  // Check fall death
  if (c.y > state.bottomY) {
    triggerGameOver(state, ctx)
    return
  }

  // Update mood based on state
  updateMood(state, ctx)

  // Add trail when moving fast
  if (Math.abs(c.vy) > 200 || Math.abs(c.vx) > 100) {
    if (Math.random() < dt * 20) addTrailPoint(c, state.time)
  }

  // Generate platforms above
  ensurePlatformsAbove(state, state.camera.y)

  // Update particles
  updateParticles(state, dt)
  updateFloatingTexts(state, dt)

  // Camera shake decay
  state.camera.shake *= Math.pow(0.001, dt)
  if (state.camera.shake > 0.1) {
    state.camera.shakeOffsetX = (Math.random() - 0.5) * state.camera.shake
    state.camera.shakeOffsetY = (Math.random() - 0.5) * state.camera.shake
  } else {
    state.camera.shakeOffsetX = 0
    state.camera.shakeOffsetY = 0
  }
  // Zoom relax
  state.camera.zoom += (state.camera.zoomTarget - state.camera.zoom) * Math.min(1, dt * 4)
  state.camera.zoomTarget += (1 - state.camera.zoomTarget) * Math.min(1, dt * 2)

  // Flash decay
  state.flashAlpha *= Math.pow(0.001, dt)

  // Vignette pulse decay
  state.vignettePulse *= Math.pow(0.01, dt)

  // Background hue shifts with altitude
  state.worldHue = (220 + altitude * 0.05) % 360
  state.worldSat = Math.max(35, 60 - altitude * 0.005)
  state.worldLight = Math.min(75, 55 + altitude * 0.01)

  // Background pulse from music level
  const level = ctx.music.getLevel()
  state.bgPulse += (level - state.bgPulse) * Math.min(1, dt * 8)

  // Star parallax: shift stars with camera
  for (const s of state.stars) {
    s.y += state.camera.y * -0.001 * dt * 60 // very subtle parallax
    // wrap
    if (s.y > ctx.height) s.y = 0
    if (s.y < 0) s.y = ctx.height
  }
}

function handleBounce(state: GameState, p: Platform, ctx: UpdateContext) {
  const c = state.character
  c.y = p.y - c.h * 0.4
  let vy = JUMP_VELOCITY
  let mood: CharacterMood = 'jumping'
  let bounceHue = 180

  // Squash on impact
  c.squashX = 1.3
  c.squashY = 0.7
  state.camera.shake = Math.max(state.camera.shake, 4)

  switch (p.type) {
    case 'normal':
      vy = JUMP_VELOCITY
      mood = 'jumping'
      bounceHue = 180
      spawnBounceParticles(state, c.x, p.y, 180, 10)
      spawnLandingRing(state, c.x, p.y, 180)
      spawnSubPixelDust(state, c.x, p.y, 180, 5)
      spawnPixelBurst(state, c.x, p.y, 180, 4)
      break
    case 'bouncy':
      vy = BOUNCY_VELOCITY
      mood = 'joyful'
      c.joyTimer = 0.5
      bounceHue = 320
      spawnBouncyParticles(state, c.x, p.y, 320)
      spawnPixelSparks(state, c.x, p.y, 320, 12)
      spawnFloatingText(state, c.x, p.y - 20, 'BOING!', 320, 22)
      state.camera.shake = Math.max(state.camera.shake, 10)
      state.flashAlpha = 0.35
      state.flashHue = 320
      ctx.onBouncy()
      break
    case 'moving':
      vy = JUMP_VELOCITY
      mood = 'jumping'
      bounceHue = 200
      spawnBounceParticles(state, c.x, p.y, 200, 12)
      spawnLandingRing(state, c.x, p.y, 200)
      spawnPixelBurst(state, c.x, p.y, 200, 5)
      break
    case 'fragile':
      vy = JUMP_VELOCITY
      mood = 'jumping'
      bounceHue = 30
      p.broken = true
      spawnBreakParticles(state, c.x, p.y, 30)
      spawnPixelBurst(state, c.x, p.y, 30, 8)
      ctx.onBreak()
      break
    case 'boost':
      if (!p.used) {
        vy = BOOST_VELOCITY
        mood = 'joyful'
        c.joyTimer = 1.2
        c.invulnBoost = 0.4
        bounceHue = 50
        p.used = true
        spawnBoostParticles(state, c.x, p.y)
        spawnPixelTrail(state, c.x, p.y, 50, 8)
        spawnPixelSparks(state, c.x, p.y, 50, 10)
        spawnFloatingText(state, c.x, p.y - 30, 'BOOST!', 50, 28)
        state.camera.shake = Math.max(state.camera.shake, 18)
        state.flashAlpha = 0.6
        state.flashHue = 50
        state.camera.zoomTarget = 0.92
        state.slowMo = 0.4
        ctx.onBoost()
      }
      break
  }

  c.vy = vy
  c.mood = mood
  p.wobble = 0.3

  // ---- Music progression logic ----
  // Determine if this bounce represents progress, repetition, or a dip.
  // - progress: new platform higher than last → advance music
  // - same:     same platform ID → repeat last note (only allowed repetition)
  // - dip:      new platform lower than last → reset music
  let jumpKind: 'progress' | 'same' | 'dip' = 'progress'
  if (state.lastBouncedPlatformId === null) {
    jumpKind = 'progress'
  } else if (p.id === state.lastBouncedPlatformId) {
    jumpKind = 'same'
  } else if (p.y > state.lastBouncePlatformY + 10) {
    // y increases downward, so larger y = lower altitude = dip
    jumpKind = 'dip'
  } else {
    jumpKind = 'progress'
  }

  state.lastBouncedPlatformId = p.id
  state.lastBouncePlatformY = p.y
  state.lastBounceWasProgress = jumpKind === 'progress'

  // Combo updates
  if (jumpKind === 'progress') {
    state.combo += 1
    state.musicStep += 1
  } else if (jumpKind === 'dip') {
    state.combo = 0
    state.musicStep = 0
    spawnFloatingText(state, c.x, c.y - 40, 'reset', 0, 14)
  }
  // 'same' = no combo change, no music step

  // ---- Music playback ----
  // Special platforms that launch the player higher play multiple rapid melody
  // notes in succession — as if the player jumped on several platforms quickly.
  // This makes the music progress faster for bigger launches, which feels
  // musically logical and rewarding.
  //
  // Note counts based on launch height:
  //   normal/moving: 1 note (normal jump)
  //   bouncy:        3 notes (big bounce)
  //   boost:         5 notes (rocket launch — maximum progression)
  //   fragile:       1 note  (normal height, then breaks)
  const specialNoteCounts: Record<PlatformType, number> = {
    normal: 1,
    moving: 1,
    bouncy: 3,
    boost: 5,
    fragile: 1,
  }

  const noteCount = specialNoteCounts[p.type]

  if (noteCount === 1) {
    // Normal: single jump
    ctx.onJump(jumpKind)
  } else {
    // Special platform with multi-note progression
    // The special sound (onBouncy/onBoost/onCloud) adds a texture flourish
    // on top, while onJumpMulti handles the melodic progression.
    ctx.onJumpMulti(noteCount, jumpKind)
  }

  // Floating score
  if (state.combo > 1 && jumpKind === 'progress') {
    spawnFloatingText(state, c.x + 30, c.y - 30, `x${state.combo}`, bounceHue, 16)
  }
}

function updateMood(state: GameState, ctx: UpdateContext) {
  const c = state.character
  if (c.dizzyTimer > 0) {
    c.mood = 'dizzy'
    return
  }
  if (c.joyTimer > 0) {
    c.mood = 'joyful'
    return
  }
  if (c.vy < -200) c.mood = 'jumping'
  else if (c.vy < 0) c.mood = 'rising'
  else if (c.vy > 200) {
    // If close to bottom of screen, scared
    const screenY = c.y - state.camera.y
    if (screenY > ctx.height * 0.75) c.mood = 'scared'
    else c.mood = 'falling'
  } else c.mood = 'idle'
}

function triggerGameOver(state: GameState, ctx: UpdateContext) {
  state.phase = 'gameover'
  state.character.mood = 'hurt'
  state.character.squashX = 1.4
  state.character.squashY = 0.6
  state.camera.shake = 30
  state.flashAlpha = 0.7
  state.flashHue = 0
  state.vignettePulse = 0.9
  state.slowMo = 0.3
  spawnGameOverBurst(state, state.character.x, state.character.y, 340)
  ctx.onGameOver()
}

/** Idle menu animation: character bounces gently in place on a soft platform. */
function updateMenu(state: GameState, ctx: UpdateContext) {
  const dt = Math.min(0.05, ctx.dt)
  state.time += dt

  const c = state.character
  // Place character in lower-center of the screen, below the menu UI
  const targetY = ctx.height * 0.78
  c.x = WORLD_WIDTH / 2 + Math.sin(state.time * 0.8) * 40
  // Bouncing motion
  const bouncePeriod = 1.8
  const phase = (state.time % bouncePeriod) / bouncePeriod
  const bounce = Math.sin(phase * Math.PI) * 70  // 0 → peak → 0
  c.y = targetY - bounce
  c.vx = Math.cos(state.time * 0.8) * 40
  c.vy = phase < 0.5 ? -200 : 200

  // Mood: use 'joyful' (pink/magenta) for visibility against the dark purple bg
  // 'joyful' triggers happy closed eyes + big smile which is super cute on the menu
  c.mood = 'joyful'
  c.joyTimer = 0.1  // keep joyful mood active

  updateCharacterAnimation(c, dt, state.time)

  // Spawn occasional sparkle particle for ambience
  if (Math.random() < dt * 4) {
    state.particles.push({
      x: c.x + (Math.random() - 0.5) * c.w,
      y: c.y + (Math.random() - 0.5) * c.h,
      vx: (Math.random() - 0.5) * 30,
      vy: -20 - Math.random() * 30,
      life: 0.8 + Math.random() * 0.4,
      maxLife: 1.2,
      size: 3 + Math.random() * 4,
      hue: 320 + Math.random() * 60,
      sat: 80, light: 80, alpha: 1,
      shape: 'star',
      rotation: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 8,
      gravity: 30, drag: 0.95,
    })
  }

  // Update particles
  updateParticles(state, dt)
  updateFloatingTexts(state, dt)

  // Subtle camera idle drift
  state.camera.y = Math.sin(state.time * 0.3) * 5

  // Background pulse (gentle breathing)
  state.bgPulse = 0.2 + 0.1 * Math.sin(state.time * 1.5)
}

