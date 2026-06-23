'use client'

import GameCanvas from '@/components/game/GameCanvas'

export default function Home() {
  return (
    <main
      className="fixed inset-0 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 40%, #4a2456 70%, #6b2d5e 100%)',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Mobile-first: portrait aspect ratio with max-width */}
        <div
          className="relative overflow-hidden"
          style={{
            aspectRatio: '9 / 16',
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: 'min(100vw, calc(100vh * 9 / 16))',
            height: 'min(100vh, calc(100vw * 16 / 9))',
            boxShadow: '0 0 80px rgba(236, 72, 153, 0.3)',
          }}
        >
          <GameCanvas />
        </div>
      </div>
    </main>
  )
}
