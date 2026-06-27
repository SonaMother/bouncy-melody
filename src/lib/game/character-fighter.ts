// Fighter Character — original pixel-art fighting game style character.
//
// Inspired by classic 2D fighting games (Street Fighter, King of Fighters).
// This is an ORIGINAL character, not imported from any copyrighted game.
// Features:
// - Fighting stance with bobbing animation
// - Jump animation (tuck and spin)
// - Fall animation (arms spread, legs trailing)
// - Hurt animation (knocked back pose)
// - Punch animation on boost platforms
//
// Technique: larger pixel grid (16x20) with more detailed sprite art,
// multiple animation frames per state, drawn pixel-by-pixel.

import type { CharacterState } from './types'

const PS = 3  // pixel size (scaled up for visibility)
const GW = 16  // grid width
const GH = 20  // grid height

// Color palette — martial artist in gi (white outfit, black belt, red headband)
const P: Record<string, string> = {
  T: 'transparent',
  K: '#1a1a1a',     // outline/black
  W: '#f5f5f5',     // gi white
  G: '#d0d0d0',     // gi gray (shading)
  S: '#e8b888',     // skin
  D: '#c89868',     // skin shadow
  R: '#e02020',     // red headband
  B: '#1a1a1a',     // black belt
  H: '#2a1a0a',     // hair black
  Y: '#ffdd33',     // blonde hair (alternate)
  E: '#ffffff',     // eye white
}

const FRAMES: Record<string, string[][][]> = {
  idle: [
    // Frame 0: fighting stance (slightly crouched, fists up)
    [
      ['T','T','T','T','T','H','H','H','H','H','T','T','T','T','T','T'],
      ['T','T','T','T','H','H','H','H','H','H','H','R','R','T','T','T'],
      ['T','T','T','H','H','S','S','S','S','S','H','R','R','R','T','T'],
      ['T','T','T','H','S','S','E','S','E','S','H','T','R','R','T','T'],
      ['T','T','T','H','S','S','S','S','S','S','H','T','T','T','T','T'],
      ['T','T','T','T','S','S','D','D','S','S','T','T','T','T','T','T'],
      ['T','T','T','W','W','W','W','W','W','W','W','T','T','T','T','T'],
      ['T','T','W','W','W','W','W','W','W','W','W','W','W','T','T','T'],
      ['T','W','W','W','G','W','W','W','W','W','G','W','W','W','T','T'],
      ['T','W','W','G','G','W','B','B','B','W','G','G','W','W','T','T'],
      ['T','T','W','W','W','W','B','B','B','W','W','W','W','T','T','T'],
      ['T','T','T','W','W','W','W','W','W','W','W','W','T','T','T','T'],
      ['T','T','T','S','W','W','W','W','W','W','W','S','T','T','T','T'],
      ['T','T','S','S','S','T','T','T','T','T','S','S','S','T','T','T'],
      ['T','T','S','S','T','T','T','T','T','T','T','S','S','T','T','T'],
      ['T','T','S','S','T','T','T','T','T','T','T','S','S','T','T','T'],
      ['T','T','S','S','T','T','T','T','T','T','T','S','S','T','T','T'],
      ['T','T','S','S','S','T','T','T','T','T','S','S','S','T','T','T'],
      ['T','T','T','K','K','T','T','T','T','T','K','K','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
    // Frame 1: slight bob (shifted up 1px)
    [
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','H','H','H','H','H','T','T','T','T','T','T'],
      ['T','T','T','T','H','H','H','H','H','H','H','R','R','T','T','T'],
      ['T','T','T','H','H','S','S','S','S','S','H','R','R','R','T','T'],
      ['T','T','T','H','S','S','E','S','E','S','H','T','R','R','T','T'],
      ['T','T','T','H','S','S','S','S','S','S','H','T','T','T','T','T'],
      ['T','T','T','T','S','S','D','D','S','S','T','T','T','T','T','T'],
      ['T','T','T','W','W','W','W','W','W','W','W','T','T','T','T','T'],
      ['T','T','W','W','W','W','W','W','W','W','W','W','W','T','T','T'],
      ['T','W','W','W','G','W','W','W','W','W','G','W','W','W','T','T'],
      ['T','W','W','G','G','W','B','B','B','W','G','G','W','W','T','T'],
      ['T','T','W','W','W','W','B','B','B','W','W','W','W','T','T','T'],
      ['T','T','T','W','W','W','W','W','W','W','W','W','T','T','T','T'],
      ['T','T','T','S','W','W','W','W','W','W','W','S','T','T','T','T'],
      ['T','T','S','S','S','T','T','T','T','T','S','S','S','T','T','T'],
      ['T','T','S','S','T','T','T','T','T','T','T','S','S','T','T','T'],
      ['T','T','S','S','T','T','T','T','T','T','T','S','S','T','T','T'],
      ['T','T','S','S','S','T','T','T','T','T','S','S','S','T','T','T'],
      ['T','T','T','K','K','T','T','T','T','T','K','K','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
  ],
  jumping: [
    // Tucked jump pose — knees up, arms in
    [
      ['T','T','T','T','T','H','H','H','H','H','T','T','T','T','T','T'],
      ['T','T','T','T','H','H','H','H','H','H','H','R','R','T','T','T'],
      ['T','T','T','H','H','S','S','S','S','S','H','R','R','R','T','T'],
      ['T','T','T','H','S','S','E','S','E','S','H','T','R','R','T','T'],
      ['T','T','T','T','S','S','S','S','S','S','T','T','T','T','T','T'],
      ['T','T','W','W','W','W','S','S','S','S','W','W','W','W','T','T'],
      ['T','W','W','W','W','W','S','S','S','S','W','W','W','W','W','T'],
      ['W','W','G','W','W','W','W','B','B','B','W','W','W','G','W','W'],
      ['W','W','G','G','W','W','W','B','B','B','W','W','W','G','G','W'],
      ['T','W','W','W','W','W','W','W','W','W','W','W','W','W','W','T'],
      ['T','T','S','W','W','W','W','W','W','W','W','W','S','T','T','T'],
      ['T','S','S','S','S','T','T','T','T','T','S','S','S','S','T','T'],
      ['T','S','S','S','T','T','T','T','T','T','T','S','S','S','T','T'],
      ['T','T','S','S','T','T','T','T','T','T','T','S','S','T','T','T'],
      ['T','T','S','S','T','T','T','T','T','T','T','S','S','T','T','T'],
      ['T','T','T','S','T','T','T','T','T','T','T','S','T','T','T','T'],
      ['T','T','T','K','T','T','T','T','T','T','T','K','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
  ],
  falling: [
    // Arms spread, legs trailing — skydiving pose
    [
      ['T','T','T','T','T','H','H','H','H','H','T','T','T','T','T','T'],
      ['T','T','T','T','H','H','H','H','H','H','H','R','R','T','T','T'],
      ['T','T','T','H','H','S','S','S','S','S','H','R','R','R','T','T'],
      ['S','S','S','S','S','S','E','S','E','S','S','S','S','S','S','S'],
      ['S','S','S','S','S','S','S','S','S','S','S','S','S','S','S','S'],
      ['T','W','W','W','W','W','W','W','W','W','W','W','W','W','W','T'],
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W'],
      ['W','G','W','W','W','W','W','B','B','B','W','W','W','W','G','W'],
      ['T','W','W','W','W','W','W','B','B','B','W','W','W','W','W','T'],
      ['T','T','W','W','W','W','W','W','W','W','W','W','W','W','T','T'],
      ['T','T','T','S','S','W','W','W','W','W','S','S','T','T','T','T'],
      ['T','T','S','S','S','S','T','T','T','S','S','S','S','T','T','T'],
      ['T','S','S','S','T','T','T','T','T','T','T','S','S','S','T','T'],
      ['T','S','S','T','T','T','T','T','T','T','T','T','S','S','T','T'],
      ['T','S','S','T','T','T','T','T','T','T','T','T','S','S','T','T'],
      ['T','T','S','T','T','T','T','T','T','T','T','T','S','T','T','T'],
      ['T','T','K','T','T','T','T','T','T','T','T','T','K','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
  ],
  hurt: [
    // Knocked back — head tilted, arms flailing
    [
      ['T','T','T','T','T','T','H','H','H','H','T','T','T','T','T','T'],
      ['T','T','T','T','T','H','H','H','H','H','H','R','R','T','T','T'],
      ['T','T','T','T','H','H','S','S','S','S','H','R','R','R','T','T'],
      ['T','T','T','H','H','S','S','R','S','R','S','H','T','T','T','T'],
      ['T','T','T','T','S','S','S','S','S','S','T','T','T','T','T','T'],
      ['S','S','S','S','S','S','S','S','S','S','S','S','S','S','T','T'],
      ['S','S','S','S','W','W','W','W','W','W','W','S','S','S','T','T'],
      ['T','T','W','W','W','W','W','W','W','W','W','W','W','T','T','T'],
      ['T','W','W','G','W','W','W','B','B','B','W','W','W','W','T','T'],
      ['T','W','W','G','G','W','W','B','B','B','W','W','G','W','T','T'],
      ['T','T','W','W','W','W','W','W','W','W','W','W','W','T','T','T'],
      ['T','T','T','S','S','W','W','W','W','W','S','S','T','T','T','T'],
      ['T','T','S','S','S','S','T','T','T','S','S','S','S','T','T','T'],
      ['T','S','S','S','T','T','T','T','T','T','T','S','S','S','T','T'],
      ['T','S','S','T','T','T','T','T','T','T','T','T','S','S','T','T'],
      ['T','S','S','T','T','T','T','T','T','T','T','T','S','S','T','T'],
      ['T','T','S','T','T','T','T','T','T','T','T','T','S','T','T','T'],
      ['T','T','K','T','T','T','T','T','T','T','T','T','K','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
  ],
}

export function drawFighter(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rotation)
  ctx.scale(c.squashX, c.squashY)

  let state = 'idle'
  if (c.mood === 'hurt') state = 'hurt'
  else if (c.vy < -100) state = 'jumping'
  else if (c.vy > 200) state = 'falling'

  const frames = FRAMES[state] || FRAMES.idle
  // Idle animates at 4fps, other states are static
  const frameIdx = state === 'idle' ? Math.floor(time / 250) % frames.length : 0
  const grid = frames[frameIdx]

  const offsetX = -(GW * PS) / 2
  const offsetY = -(GH * PS) / 2

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const code = grid[y][x]
      const resolved = P[code]
      if (!resolved || resolved === 'transparent') continue
      ctx.fillStyle = resolved
      ctx.fillRect(offsetX + x * PS, offsetY + y * PS, PS, PS)
    }
  }

  ctx.restore()
}
