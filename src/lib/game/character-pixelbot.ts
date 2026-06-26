// Pixel Sprite Character — animated 2D pixel art with frame-based animation.
//
// This character demonstrates pixel-art sprite animation technique:
// - Drawn pixel by pixel on canvas (no external image files needed)
// - Different animation frames for different game states
// - States: idle (breathing), jumping (stretched), falling (arms up), hurt (flashing)

import type { CharacterState } from './types'

const PIXEL_SIZE = 4
const GRID_W = 12
const GRID_H = 14

// Animation frames — each pixel is a color string or 'T' for transparent
const FRAMES: Record<string, string[][][]> = {
  idle: [
    [
      ['T','T','T','T','T','#ffdd44','T','T','T','T','T','T'],
      ['T','T','T','T','T','#1a1a2e','#1a1a2e','T','T','T','T','T'],
      ['T','T','T','#1a1a2e','#1a1a2e','#4a90d9','#4a90d9','#1a1a2e','#1a1a2e','T','T','T'],
      ['T','T','#1a1a2e','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#6ab0e9','#4a90d9','#1a1a2e','T','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#6ab0e9','#4a90d9','#1a1a2e','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#00ff88','#0a0a1a','#00ff88','#0a0a1a','#4a90d9','#1a1a2e','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#6ab0e9','#4a90d9','#1a1a2e','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#1a1a2e','T'],
      ['T','T','#1a1a2e','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#1a1a2e','T','T'],
      ['T','T','T','#1a1a2e','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#1a1a2e','T','T','T'],
      ['T','T','T','T','#1a1a2e','#2a5a8a','#2a5a8a','#1a1a2e','T','T','T','T'],
      ['T','T','T','T','T','#1a1a2e','#1a1a2e','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
    [
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','#ffdd44','T','T','T','T','T','T','T'],
      ['T','T','T','T','#1a1a2e','#1a1a2e','T','T','T','T','T','T'],
      ['T','T','#1a1a2e','#1a1a2e','#4a90d9','#4a90d9','#1a1a2e','#1a1a2e','T','T','T','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#6ab0e9','#4a90d9','#1a1a2e','T','T','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#4a90d9','#1a1a2e','T','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#00ff88','#0a0a1a','#00ff88','#4a90d9','#1a1a2e','T','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#4a90d9','#1a1a2e','T','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#4a90d9','#6ab0e9','#4a90d9','#1a1a2e','T','T'],
      ['T','T','#1a1a2e','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#1a1a2e','T','T','T'],
      ['T','T','T','#1a1a2e','#4a90d9','#4a90d9','#4a90d9','#1a1a2e','T','T','T','T'],
      ['T','T','T','T','#1a1a2e','#2a5a8a','#1a1a2e','T','T','T','T','T'],
      ['T','T','T','T','T','#1a1a2e','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
  ],
  jumping: [
    [
      ['T','T','T','#ffdd44','T','T','T','T','#ffdd44','T','T','T'],
      ['T','T','#1a1a2e','#1a1a2e','#1a1a2e','T','T','#1a1a2e','#1a1a2e','#1a1a2e','T','T'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#4a90d9','T','T','#4a90d9','#6ab0e9','#4a90d9','#1a1a2e','T'],
      ['#1a1a2e','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','T','T','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#1a1a2e'],
      ['#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#6ab0e9','#4a90d9','#1a1a2e'],
      ['#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#00ff88','#0a0a1a','#0a0a1a','#00ff88','#0a0a1a','#6ab0e9','#4a90d9','#1a1a2e'],
      ['#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#6ab0e9','#4a90d9','#1a1a2e'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#1a1a2e','T'],
      ['T','T','#1a1a2e','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#1a1a2e','T','T'],
      ['T','T','T','#1a1a2e','#4a90d9','#4a90d9','#4a90d9','#4a90d9','#1a1a2e','T','T','T'],
      ['T','T','T','T','#1a1a2e','#4a90d9','#4a90d9','#1a1a2e','T','T','T','T'],
      ['T','T','T','T','T','#1a1a2e','#1a1a2e','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
  ],
  falling: [
    [
      ['T','T','T','T','T','#ffdd44','T','T','T','T','T','T'],
      ['T','T','T','T','T','#1a1a2e','#1a1a2e','T','T','T','T','T'],
      ['T','T','T','#1a1a2e','#1a1a2e','#4a90d9','#4a90d9','#1a1a2e','#1a1a2e','T','T','T'],
      ['#1a1a2e','#1a1a2e','#1a1a2e','#4a90d9','#6ab0e9','#6ab0e9','#4a90d9','#6ab0e9','#4a90d9','#1a1a2e','#1a1a2e','#1a1a2e'],
      ['#1a1a2e','#4a90d9','#4a90d9','#6ab0e9','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#6ab0e9','#4a90d9','#4a90d9','#1a1a2e'],
      ['T','#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#00ff88','#0a0a1a','#00ff88','#0a0a1a','#4a90d9','#1a1a2e','T'],
      ['T','T','#1a1a2e','#4a90d9','#6ab0e9','#0a0a1a','#0a0a1a','#0a0a1a','#6ab0e9','#4a90d9','#1a1a2e','T'],
      ['T','T','T','#1a1a2e','#4a90d9','#6ab0e9','#4a90d9','#6ab0e9','#4a90d9','#1a1a2e','T','T'],
      ['T','T','T','T','#1a1a2e','#4a90d9','#4a90d9','#4a90d9','#1a1a2e','T','T','T'],
      ['T','T','T','T','T','#1a1a2e','#4a90d9','#1a1a2e','T','T','T','T'],
      ['T','T','T','T','#1a1a2e','#1a1a2e','T','#1a1a2e','#1a1a2e','T','T','T'],
      ['T','T','T','T','#1a1a2e','T','T','T','#1a1a2e','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
  ],
  hurt: [
    [
      ['T','T','T','T','T','#ffdd44','T','T','T','T','T','T'],
      ['T','T','T','T','T','#1a1a2e','#1a1a2e','T','T','T','T','T'],
      ['T','T','T','#1a1a2e','#1a1a2e','#ff4444','#ff4444','#1a1a2e','#1a1a2e','T','T','T'],
      ['T','T','#1a1a2e','#ff4444','#ff4444','#ff4444','#ff4444','#ff4444','#ff4444','#1a1a2e','T','T'],
      ['T','#1a1a2e','#ff4444','#ff4444','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#ff4444','#ff4444','#1a1a2e','T'],
      ['T','#1a1a2e','#ff4444','#ff4444','#0a0a1a','#ff4444','#0a0a1a','#ff4444','#0a0a1a','#ff4444','#1a1a2e','T'],
      ['T','#1a1a2e','#ff4444','#ff4444','#0a0a1a','#0a0a1a','#0a0a1a','#0a0a1a','#ff4444','#ff4444','#1a1a2e','T'],
      ['T','#1a1a2e','#ff4444','#ff4444','#ff4444','#ff4444','#ff4444','#ff4444','#ff4444','#ff4444','#1a1a2e','T'],
      ['T','T','#1a1a2e','#ff4444','#ff4444','#ff4444','#ff4444','#ff4444','#ff4444','#1a1a2e','T','T'],
      ['T','T','T','#1a1a2e','#ff4444','#ff4444','#ff4444','#ff4444','#1a1a2e','T','T','T'],
      ['T','T','T','T','#1a1a2e','#ff4444','#ff4444','#1a1a2e','T','T','T','T'],
      ['T','T','T','T','T','#1a1a2e','#1a1a2e','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
      ['T','T','T','T','T','T','T','T','T','T','T','T'],
    ],
  ],
}

export function drawPixelBot(ctx: CanvasRenderingContext2D, c: CharacterState, time: number) {
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rotation)
  ctx.scale(c.squashX, c.squashY)

  let state = 'idle'
  if (c.mood === 'hurt') state = 'hurt'
  else if (c.vy < -100) state = 'jumping'
  else if (c.vy > 200) state = 'falling'

  const frames = FRAMES[state] || FRAMES.idle
  const frameIdx = state === 'idle' ? Math.floor(time / 500) % frames.length : 0
  const grid = frames[frameIdx]

  const offsetX = -(GRID_W * PIXEL_SIZE) / 2
  const offsetY = -(GRID_H * PIXEL_SIZE) / 2

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const color = grid[y][x]
      if (color === 'T') continue
      ctx.fillStyle = color
      ctx.fillRect(offsetX + x * PIXEL_SIZE, offsetY + y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
    }
  }

  ctx.restore()
}
