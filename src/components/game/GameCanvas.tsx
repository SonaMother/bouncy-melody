'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  createInitialState,
  resetForPlay,
  updateGame,
  WORLD_WIDTH,
  type UpdateContext,
} from '@/lib/game/engine'
import type { GameState, GamePhase, CharacterType } from '@/lib/game/types'
import { CHARACTER_NAMES, CHARACTER_DESCRIPTIONS } from '@/lib/game/types'
import { MusicEngine } from '@/lib/game/audio'
import { getChordName, GENRE_CONFIGS, type MusicGenre } from '@/lib/game/music-theory'
import { drawCharacter, drawCharacterTrail } from '@/lib/game/character'
import {
  drawBackground,
  drawPlatform,
  drawAmbientParticles,
  drawVignette,
  drawFlash,
} from '@/lib/game/render'
import { drawParticle, drawFloatingText } from '@/lib/game/particles'

interface GameCanvasProps {
  onPhaseChange?: (phase: GamePhase) => void
  onScoreChange?: (score: number) => void
  onHeightChange?: (height: number) => void
  onBestChange?: (best: number) => void
}

export default function GameCanvas({
  onPhaseChange,
  onScoreChange,
  onHeightChange,
  onBestChange,
}: GameCanvasProps) {
  const GAME_VERSION = 'v1.0.0'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const musicRef = useRef<MusicEngine | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const lastTtsMilestone = useRef<number>(0)
  const ttsEnabledRef = useRef(false)

  const [phase, setPhase] = useState<GamePhase>('menu')
  const [score, setScore] = useState(0)
  const [height, setHeight] = useState(0)
  const [best, setBest] = useState(0)
  const [combo, setCombo] = useState(0)
  const [muted, setMuted] = useState(false)
  const [musicStep, setMusicStep] = useState(0)
  const [activeLayers, setActiveLayers] = useState<string[]>([])
  const [currentChordName, setCurrentChordName] = useState<string>('')
  const [started, setStarted] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false)
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('')
  const [subtitleTimer, setSubtitleTimer] = useState<number>(0)
  // Use fixed defaults to avoid hydration mismatch — localStorage loaded in useEffect after mount
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterType>('mochi')
  const [selectedGenre, setSelectedGenre] = useState<MusicGenre>('lofi')

  // ---- TTS (Text-to-Speech) motivational voice ----
  // Story: Our character climbs toward Arash, the NonExistent — a god-like figure
  // in the sky who may or may not exist. Each milestone brings us closer to the truth.
  const TTS_MESSAGES = [
    // General motivation
    'Amazing! Keep going!', 'You are doing great!', 'Beautiful jumping!',
    'Keep climbing, you star!', 'Incredible rhythm!', 'Never give up!',
    'You are unstoppable!', 'Fantastic progress!', 'Keep bouncing, keep dreaming!',
    'You are a champion!', 'Every jump takes you higher!', 'Believe in yourself!',
    'The sky is not the limit!', 'You make this look easy!', 'Pure perfection!',
    // Story — Arash the NonExistent
    'Arash waits for you at the top. Or does He?',
    'They say Arash does not exist. Climb higher and find out.',
    'The NonExistent watches. Can you reach Him?',
    'Every jump brings you closer to Arash. Or closer to the truth.',
    'Arash is the sky, and you are the climber.',
    'Does Arash exist? Only the climb will tell.',
    'The higher you go, the closer to the NonExistent you become.',
    'Arash is not at the top. Arash IS the top.',
    'Some say Arash is a myth. You are here to prove them wrong.',
    'The NonExistent Arash — can faith be reached by jumping?',
    'Climb for Arash. Climb for truth. Climb for yourself.',
    'Arash does not exist, yet you climb. That is faith.',
    'The sky holds no Arash. The sky IS Arash.',
    'You seek the NonExistent. The NonExistent seeks you.',
    'Arash whispers: higher. Always higher.',
  ]

  const speakMotivational = useCallback(() => {
    if (!ttsEnabledRef.current) return
    // Use pre-rendered Kokoro TTS audio files (high quality whispery voice)
    const idx = Math.floor(Math.random() * TTS_MESSAGES.length)
    const msg = TTS_MESSAGES[idx]
    const audio = new Audio('/tts/tts_' + idx + '.wav')
    audio.volume = 1.0
    audio.play().catch(() => {
      // Fallback to Web Speech API if audio play fails
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(msg)
        utterance.rate = 1.1
        utterance.pitch = 1.3
        utterance.volume = 1.0
        window.speechSynthesis.speak(utterance)
      }
    })
    setCurrentSubtitle(msg)
    setSubtitleTimer(3.5)
  }, [])

  const checkTtsMilestone = useCallback((jumpCount: number) => {
    if (!ttsEnabledRef.current) return
    const milestone = Math.floor(jumpCount / 20) * 20
    if (milestone > 0 && milestone > lastTtsMilestone.current) {
      lastTtsMilestone.current = milestone
      speakMotivational()
    }
  }, [speakMotivational])

  useEffect(() => { ttsEnabledRef.current = ttsEnabled }, [ttsEnabled])

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('bouncy-tts', String(ttsEnabled))
  }, [ttsEnabled])

  useEffect(() => {
    if (subtitleTimer <= 0) return
    const interval = setInterval(() => {
      setSubtitleTimer(prev => {
        if (prev <= 0.1) { setCurrentSubtitle(''); return 0 }
        return prev - 0.1
      })
    }, 100)
    return () => clearInterval(interval)
  }, [subtitleTimer])

  // ---- Initialize state and music (runs ONCE on mount) ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      sizeRef.current = { w: rect.width, h: rect.height, dpr }
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }
    resize()
    window.addEventListener('resize', resize)

    musicRef.current = new MusicEngine()
    stateRef.current = createInitialState(sizeRef.current.w, sizeRef.current.h, selectedCharacter)
    // Sync best score from localStorage on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBest(parseInt(localStorage.getItem('doodle-music-best') || '0', 10))

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
      musicRef.current?.stop()
    }
  }, [])

  // ---- Load saved settings from localStorage after mount (avoids hydration mismatch) ----
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedChar = localStorage.getItem('bouncy-character') as CharacterType
    if (storedChar) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCharacter(storedChar)
    }
    const storedGenre = localStorage.getItem('bouncy-genre') as MusicGenre
    if (storedGenre === 'lofi' || storedGenre === 'mystic' || storedGenre === 'synthwave' || storedGenre === 'pop' || storedGenre === 'doom') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedGenre(storedGenre)
    }
    if (localStorage.getItem('bouncy-tts') === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTtsEnabled(true)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  // ---- Update character type when selection changes (does NOT recreate state) ----
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bouncy-character', selectedCharacter)
    }
    const state = stateRef.current
    if (state) {
      state.character.type = selectedCharacter
    }
  }, [selectedCharacter])

  // ---- Update music genre when selection changes ----
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bouncy-genre', selectedGenre)
    }
    const music = musicRef.current
    if (music && started) {
      music.setGenre(selectedGenre)
    }
  }, [selectedGenre, started])

  // ---- Input handlers ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let touchActive = false
    let touchX = 0

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 0) return
      touchActive = true
      touchX = e.touches[0].clientX
      const rect = canvas!.getBoundingClientRect()
      const relX = touchX - rect.left
      const w = rect.width
      const state = stateRef.current
      if (!state) return
      if (relX < w / 2) state.inputDir = -1
      else state.inputDir = 1
    }
    function handleTouchMove(e: TouchEvent) {
      if (!touchActive || e.touches.length === 0) return
      const rect = canvas!.getBoundingClientRect()
      const relX = e.touches[0].clientX - rect.left
      const w = rect.width
      const state = stateRef.current
      if (!state) return
      if (relX < w / 2) state.inputDir = -1
      else state.inputDir = 1
    }
    function handleTouchEnd() {
      touchActive = false
      const state = stateRef.current
      if (state) state.inputDir = 0
    }

    function handleMouseMove(e: MouseEvent) {
      const state = stateRef.current
      if (!state || state.phase !== 'playing') return
      const rect = canvas!.getBoundingClientRect()
      const relX = e.clientX - rect.left
      const w = rect.width
      // Mouse: control direction by position
      const center = w / 2
      const dist = relX - center
      state.inputDir = Math.max(-1, Math.min(1, dist / (w * 0.3)))
    }
    function handleMouseLeave() {
      const state = stateRef.current
      if (state) state.inputDir = 0
    }

    function handleKey(e: KeyboardEvent) {
      const state = stateRef.current
      if (!state) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.inputDir = -1
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.inputDir = 1
    }
    function handleKeyUp(e: KeyboardEvent) {
      const state = stateRef.current
      if (!state) return
      if (
        (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') ||
        (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
      ) state.inputDir = 0
    }

    // Device orientation for tilt
    function handleOrientation(e: DeviceOrientationEvent) {
      const state = stateRef.current
      if (!state || state.phase !== 'playing') return
      const gamma = e.gamma || 0  // left-right tilt in degrees
      state.inputDir = Math.max(-1, Math.min(1, gamma / 25))
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true })
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('deviceorientation', handleOrientation)

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [])

  // ---- Animation loop ----
  useEffect(() => {
    if (!stateRef.current) return

    function loop(now: number) {
      const state = stateRef.current
      const canvas = canvasRef.current
      const music = musicRef.current
      if (!state || !canvas || !music) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      const last = lastTimeRef.current || now
      const dt = Math.min(0.05, (now - last) / 1000)
      lastTimeRef.current = now

      const { w, h, dpr } = sizeRef.current

      const updateCtx: UpdateContext = {
        width: w,
        height: h,
        dt,
        music,
        onGameOver: () => {
          music.onGameOver()
          setPhase('gameover')
          onPhaseChange?.('gameover')
          const newBest = Math.max(best, state.bestHeight)
          setBest(newBest)
          localStorage.setItem('doodle-music-best', String(newBest))
          onBestChange?.(newBest)
        },
        onJump: (kind) => {
          music.onJump(kind)
          setCombo(state.combo)
          setMusicStep(state.musicStep)
          setActiveLayers([...music.getActiveLayers()])
          setCurrentChordName(getChordName(music.getCurrentChord()))
          checkTtsMilestone(music.getJumpCount())
        },
        onJumpMulti: (count, kind) => {
          music.onJumpMulti(count, kind)
          // Update combo/step to reflect the multi-progression
          if (kind === 'progress') {
            setCombo(state.combo)
            setMusicStep(state.musicStep)
          }
          setActiveLayers([...music.getActiveLayers()])
          setCurrentChordName(getChordName(music.getCurrentChord()))
          checkTtsMilestone(music.getJumpCount())
        },
        onBoost: () => {
          music.onBoost()
          if (navigator.vibrate) navigator.vibrate(40)
        },
        onBouncy: () => {
          music.onBouncy()
          if (navigator.vibrate) navigator.vibrate(15)
        },
        onBreak: () => {
          music.onBreak()
          if (navigator.vibrate) navigator.vibrate(8)
        },
      }

      updateGame(state, updateCtx)

      // Sync score / height to UI — throttled to every 6 frames for performance
      frameCountRef.current++
      if (frameCountRef.current % 6 === 0) {
        setScore(state.score)
        setHeight(state.height)
      }

      // ---- Render ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Background (screen space)
      drawBackground(ctx, state, w, h, state.time)

      // World transform: shift by camera
      ctx.save()
      // Center horizontally (play field is WORLD_WIDTH wide)
      const offsetX = (w - WORLD_WIDTH) / 2
      const offsetXShake = state.camera.shakeOffsetX
      ctx.translate(offsetX + offsetXShake, -state.camera.y + state.camera.shakeOffsetY)
      // Scale for zoom
      const zoom = state.camera.zoom
      if (zoom !== 1) {
        ctx.translate(WORLD_WIDTH / 2, state.camera.y + h / 2)
        ctx.scale(zoom, zoom)
        ctx.translate(-WORLD_WIDTH / 2, -(state.camera.y + h / 2))
      }

      // Clip to play area
      ctx.beginPath()
      ctx.rect(0, state.camera.y - 100, WORLD_WIDTH, h + 200)
      ctx.clip()

      // Platforms — only draw visible ones
      const visibleTop = state.camera.y - 50
      const visibleBottom = state.camera.y + h + 50
      for (const p of state.platforms) {
        if (p.y < visibleBottom && p.y > visibleTop) {
          drawPlatform(ctx, p, state.time)
        }
      }

      // Character trail
      drawCharacterTrail(ctx, state.character)

      // Particles (in world space)
      for (const p of state.particles) {
        drawParticle(ctx, p)
      }

      // Character
      drawCharacter(ctx, state.character, state.time)

      // Floating text
      for (const t of state.floatingTexts) {
        drawFloatingText(ctx, t)
      }

      ctx.restore()

      // Vignette & flash (skip in performance mode)
      if (!state.perfMode) {
        drawVignette(ctx, w, h, 0.5 + state.vignettePulse * 0.3)
        drawFlash(ctx, w, h, state.flashAlpha, state.flashHue)
      }

      // Side gradient masking (play area framing)
      drawSideFades(ctx, w, h, offsetX)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [best, onPhaseChange, onScoreChange, onHeightChange, onBestChange])

  // ---- Controls ----
  const startGame = useCallback(async () => {
    const music = musicRef.current
    const state = stateRef.current
    if (!music || !state) return
    // Make sure the selected character is applied to the game state
    state.character.type = selectedCharacter
    if (!started) {
      await music.init()
      music.setGenre(selectedGenre)
      music.start()
      setStarted(true)
    } else {
      music.setGenre(selectedGenre)
      music.reset()
      music.start()
    }
    resetForPlay(state, sizeRef.current.w, sizeRef.current.h)
    setPhase('playing')
    onPhaseChange?.('playing')
    setScore(0)
    setHeight(0)
    setCombo(0)
    setMusicStep(0)
    lastTtsMilestone.current = 0
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    setActiveLayers(music.getActiveLayers())
    setCurrentChordName(getChordName(music.getCurrentChord()))
  }, [started, onPhaseChange, selectedCharacter, selectedGenre])

  const togglePause = useCallback(() => {
    const state = stateRef.current
    if (!state || state.phase !== 'playing') return
    state.paused = !state.paused
    if (state.paused) {
      stateRef.current.phase = 'paused'
      setPhase('paused')
      onPhaseChange?.('paused')
    } else {
      stateRef.current.phase = 'playing'
      setPhase('playing')
      onPhaseChange?.('playing')
    }
  }, [onPhaseChange])

  const toggleMute = useCallback(() => {
    const music = musicRef.current
    if (!music) return
    const next = !music.isMuted()
    music.setMuted(next)
    setMuted(next)
  }, [])

  const [perfMode, setPerfMode] = useState(true)  // ON by default
  const togglePerfMode = useCallback(() => {
    const state = stateRef.current
    if (!state) return
    const next = !state.perfMode
    state.perfMode = next
    setPerfMode(next)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

      {/* Version number — always visible, top center */}
      <div
        className="absolute top-1 left-1/2 -translate-x-1/2 pointer-events-none text-outline-sm"
        style={{
          zIndex: 50,
          opacity: 0.7,
          fontSize: 10,
          color: '#ffffff',
          fontFamily: 'monospace',
          fontWeight: 700,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em',
        }}
      >
        {GAME_VERSION}
      </div>

      {/* HUD overlay */}
      {(phase === 'playing' || phase === 'paused') && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div className="flex flex-col gap-1">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl px-3 py-1.5 border border-white/25 shadow-lg">
              <div className="text-[10px] uppercase tracking-widest text-white/80 font-semibold text-outline-sm" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Score</div>
              <div className="text-white font-black text-xl leading-tight tabular-nums text-outline-sm" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.8)' }}>
                {score.toLocaleString()}
              </div>
            </div>
            <div className="bg-black/30 backdrop-blur-md rounded-2xl px-3 py-1 border border-white/20 shadow-lg">
              <div className="text-[9px] uppercase tracking-widest text-white/70 font-semibold text-outline-sm" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Height</div>
              <div className="text-white font-bold text-sm tabular-nums text-outline-sm" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{height}m</div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl px-3 py-1.5 border border-white/20 shadow-lg flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-white/70 font-semibold text-outline-sm" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Combo</span>
              <span className="text-white font-black text-lg leading-none text-outline-sm" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>x{combo}</span>
            </div>
            <button
              onClick={togglePause}
              className="pointer-events-auto bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/20 transition-all"
              aria-label="Pause"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                <rect x="2" y="2" width="3" height="10" rx="1" />
                <rect x="9" y="2" width="3" height="10" rx="1" />
              </svg>
            </button>
            <button
              onClick={toggleMute}
              className="pointer-events-auto bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/20 transition-all"
              aria-label="Mute"
            >
              {muted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3l2.5 2.5-1 1L15.5 13l-2.5 2.5-1-1 2.5-2.5L12 9.5l1-1L15.5 11z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
            <button
              onClick={togglePerfMode}
              className="pointer-events-auto bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/20 transition-all"
              aria-label="Toggle performance mode"
              title={perfMode ? "Performance mode ON — effects disabled" : "Performance mode OFF — full effects"}
            >
              {perfMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 7v5l3 2"/>
                </svg>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Subtitle display */}
      <AnimatePresence>
        {currentSubtitle && (phase === 'playing' || phase === 'paused') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-1/2 bottom-16 -translate-x-1/2 pointer-events-none"
            style={{ zIndex: 15 }}
          >
            <div style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 10, padding: '8px 16px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
              <span className="text-outline-sm" style={{ color: '#fff', fontFamily: "'Baloo 2', 'Nunito', system-ui, sans-serif", fontSize: 14, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                {currentSubtitle}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Music progression indicator (bottom) */}
      {(phase === 'playing' || phase === 'paused') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div className="bg-black/30 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/20 shadow-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-white/70 font-semibold text-outline-sm" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Music</span>
              <div className="flex gap-1">
                {['pad', 'bass', 'melody', 'chord'].map((layer) => (
                  <div
                    key={layer}
                    className={`w-1.5 h-3 rounded-full transition-all ${activeLayers.includes(layer) ? 'bg-pink-300 shadow-[0_0_8px_rgba(244,114,182,0.8)]' : 'bg-white/15'}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentChordName && (
                <span className="text-[11px] text-yellow-200 font-mono font-bold text-outline-sm" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.6)' }}>{currentChordName}</span>
              )}
              <span className="text-[10px] text-white/70 font-mono text-outline-sm" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>#{musicStep}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Menu screen */}
      <AnimatePresence>
        {phase === 'menu' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center p-2 pt-3 overflow-y-auto"
            style={{ zIndex: 20, background: 'rgba(10, 5, 20, 0.92)' }}
          >
            {/* Title */}
            <div className="text-center mb-1">
              <h1
                className="text-2xl font-black leading-none text-outline-sm"
                style={{
                  fontFamily: "'Baloo 2', 'Nunito', system-ui, sans-serif",
                  background: 'linear-gradient(180deg, #fff 0%, #ffe4f0 50%, #f9a8d4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Bouncy Melody
              </h1>
              <div className="text-[9px] uppercase tracking-[0.15em] text-white/60 text-outline-sm">
                Seeking the NonExistent Arash
              </div>
            </div>

            {/* Play + Best in a row */}
            <div className="flex items-center gap-3 mb-1">
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="px-8 py-1.5 rounded-full font-black text-base text-white text-outline-sm"
                style={{
                  background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #be185d 100%)',
                  boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)',
                  border: '2px solid rgba(255,255,255,0.2)',
                }}
              >
                Play
              </motion.button>
              {best > 0 && (
                <div className="text-white/80 text-[10px] text-outline-sm">
                  Best: <span className="font-bold text-yellow-200">{best}m</span>
                </div>
              )}
            </div>

            {/* Character grid — fills width */}
            <div className="w-full max-w-[320px] mb-1">
              <div className="text-[9px] uppercase tracking-[0.1em] text-white/60 font-bold text-center mb-0.5 text-outline-sm">Character</div>
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(CHARACTER_NAMES) as CharacterType[]).map((type) => {
                  const isSelected = selectedCharacter === type
                  const accentHue = type === 'pip' ? 340 : type === 'pixel' ? 165 : type === 'mochi' ? 25 : type === 'yuki' ? 205 : type === 'kuro' ? 180 : type === 'bongo' ? 30 : type === 'popcat' ? 35 : type === 'neon' ? 290 : type === 'blob3d' ? 280 : type === 'cat3d' ? 20 : type === 'spark' ? 180 : 280
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedCharacter(type)}
                      className="relative rounded-lg p-1.5 transition-all"
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, hsl(${accentHue}, 70%, 45%), hsl(${accentHue}, 75%, 30%))`
                          : 'rgba(20, 15, 35, 0.9)',
                        border: isSelected
                          ? `2px solid hsl(${accentHue}, 90%, 70%)`
                          : '1.5px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <CharacterPreview type={type} />
                      <div
                        className="text-[9px] font-bold mt-0.5 text-outline-sm"
                        style={{ color: isSelected ? `hsl(${accentHue}, 95%, 85%)` : 'rgba(255,255,255,0.75)' }}
                      >
                        {CHARACTER_NAMES[type]}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Genre + Voice row */}
            <div className="w-full max-w-[320px]">
              <div className="text-[9px] uppercase tracking-[0.1em] text-white/60 font-bold text-center mb-0.5 text-outline-sm">Genre</div>
              <div className="grid grid-cols-5 gap-0.5 mb-1">
                {(Object.keys(GENRE_CONFIGS) as MusicGenre[]).map((genre) => {
                  const isSelected = selectedGenre === genre
                  const config = GENRE_CONFIGS[genre]
                  const genreHue = genre === 'lofi' ? 200 : genre === 'mystic' ? 280 : genre === 'synthwave' ? 320 : genre === 'pop' ? 350 : 0
                  return (
                    <button
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                      className="rounded py-1 transition-all"
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, hsl(${genreHue}, 70%, 45%), hsl(${genreHue}, 75%, 30%))`
                          : 'rgba(20, 15, 35, 0.9)',
                        border: isSelected
                          ? `2px solid hsl(${genreHue}, 90%, 70%)`
                          : '1.5px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <span className="text-[9px] font-bold text-outline-sm" style={{ color: isSelected ? 'white' : 'rgba(255,255,255,0.75)' }}>
                        {config.name}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Voice toggle */}
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    const next = !ttsEnabled
                    setTtsEnabled(next)
                    if (next && typeof window !== 'undefined' && window.speechSynthesis) {
                      window.speechSynthesis.cancel()
                      const warmup = new SpeechSynthesisUtterance('')
                      warmup.volume = 0
                      window.speechSynthesis.speak(warmup)
                    }
                  }}
                  className="rounded-md px-2.5 py-1 transition-all"
                  style={{
                    background: ttsEnabled
                      ? 'linear-gradient(135deg, hsl(140, 70%, 40%), hsl(140, 75%, 28%))'
                      : 'rgba(20, 15, 35, 0.9)',
                    border: ttsEnabled
                      ? '2px solid hsl(140, 90%, 65%)'
                      : '1.5px solid rgba(255,255,255,0.2)',
                  }}
                >
                  <span className="text-[9px] font-bold text-outline-sm" style={{ color: ttsEnabled ? 'white' : 'rgba(255,255,255,0.75)' }}>
                    {ttsEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-1 text-center text-white/50 text-[8px] text-outline-sm">
              Tap sides to move · Tilt to steer · Bounce for Arash
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paused overlay */}
      <AnimatePresence>
        {phase === 'paused' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6"
            style={{ zIndex: 20, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          >
            <h2 className="text-4xl font-black text-white mb-6 text-outline-sm" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>Paused</h2>
            <div className="flex gap-3">
              <button
                onClick={togglePause}
                className="px-8 py-3 rounded-full font-bold text-white text-outline-sm"
                style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)' }}
              >
                Resume
              </button>
              <button
                onClick={() => {
                  const state = stateRef.current
                  if (state) {
                    state.phase = 'menu'
                    setPhase('menu')
                    onPhaseChange?.('menu')
                  }
                }}
                className="px-8 py-3 rounded-full font-bold text-white/90 bg-white/10 border border-white/20 text-outline-sm"
              >
                Quit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game over overlay */}
      <AnimatePresence>
        {phase === 'gameover' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6"
            style={{ zIndex: 20, background: 'rgba(20,0,30,0.6)', backdropFilter: 'blur(10px)' }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="text-center"
            >
              <div className="text-[11px] uppercase tracking-[0.3em] text-pink-200/80 font-bold mb-2 text-outline-sm" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>Arash is still watching</div>
              <h2
                className="text-5xl font-black text-white mb-6 text-outline-sm"
                style={{
                  fontFamily: "'Baloo 2', system-ui, sans-serif",
                  textShadow: '0 4px 16px rgba(0,0,0,0.6), 0 0 4px rgba(0,0,0,0.5)',
                }}
              >
                Game Over
              </h2>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-black/30 backdrop-blur-md rounded-3xl p-5 mb-6 border border-white/20 shadow-lg flex gap-6"
            >
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/70 font-semibold mb-1 text-outline-sm" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Height</div>
                <div className="text-3xl font-black text-white tabular-nums text-outline-sm" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>{height}m</div>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/70 font-semibold mb-1 text-outline-sm" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Best</div>
                <div className="text-3xl font-black text-yellow-200 tabular-nums text-outline-sm" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>{best}m</div>
              </div>
            </motion.div>

            {height >= best && height > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: 'spring' }}
                className="mb-6 px-4 py-2 rounded-full bg-yellow-400/20 border border-yellow-300/40"
              >
                <span className="text-yellow-200 font-bold text-sm text-outline-sm">New Best!</span>
              </motion.div>
            )}

            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="px-10 py-4 rounded-full font-black text-xl text-white shadow-2xl text-outline-sm"
              style={{
                background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #be185d 100%)',
                boxShadow: '0 8px 32px rgba(236, 72, 153, 0.5)',
              }}
            >
              Try Again
            </motion.button>
            <button
              onClick={() => {
                const state = stateRef.current
                if (state) {
                  state.phase = 'menu'
                  setPhase('menu')
                  onPhaseChange?.('menu')
                }
              }}
              className="mt-3 text-white/70 hover:text-white text-sm font-semibold text-outline-sm"
            >
              Back to Menu
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function drawSideFades(ctx: CanvasRenderingContext2D, w: number, h: number, offsetX: number) {
  // Fade the area outside the play field for a clean mobile look
  if (offsetX <= 0) return
  const grad = ctx.createLinearGradient(0, 0, offsetX, 0)
  grad.addColorStop(0, 'rgba(0,0,0,0.5)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, offsetX, h)
  const grad2 = ctx.createLinearGradient(w - offsetX, 0, w, 0)
  grad2.addColorStop(0, 'rgba(0,0,0,0)')
  grad2.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = grad2
  ctx.fillRect(w - offsetX, 0, offsetX, h)
}

// Character preview card with a small bouncing animation
function CharacterPreview({ type }: { type: CharacterType }) {
  return (
    <div className="flex justify-center items-end h-12">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 32, height: 32, position: 'relative' }}
      >
        {type === 'pip' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Antenna */}
            <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)' }}>
              <div style={{ width: 2, height: 6, background: 'hsl(340, 80%, 50%)', margin: '0 auto' }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'hsl(360, 95%, 75%)', boxShadow: '0 0 5px hsl(360, 95%, 70%)', margin: '0 auto' }} />
            </div>
            {/* Body (blob) */}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50% 50% 45% 45%',
              background: 'radial-gradient(circle at 30% 30%, hsl(340, 95%, 85%), hsl(340, 90%, 65%) 60%, hsl(340, 80%, 50%))',
              boxShadow: '0 0 10px hsla(340, 90%, 70%, 0.6)',
              position: 'relative',
            }}>
              {/* Eyes */}
              <div style={{ position: 'absolute', top: 11, left: 7, width: 5, height: 5, borderRadius: '50%', background: '#1a1a2e' }} />
              <div style={{ position: 'absolute', top: 11, right: 7, width: 5, height: 5, borderRadius: '50%', background: '#1a1a2e' }} />
            </div>
          </div>
        )}
        {type === 'pixel' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Antenna */}
            <div style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)' }}>
              <div style={{ width: 2, height: 5, background: 'hsl(165, 50%, 40%)', margin: '0 auto' }} />
              <div style={{ width: 5, height: 5, background: 'hsl(60, 100%, 70%)', boxShadow: '0 0 5px hsl(60, 100%, 70%)', margin: '0 auto' }} />
            </div>
            {/* Body (square) */}
            <div style={{
              width: '100%', height: '100%', borderRadius: 6,
              background: 'linear-gradient(180deg, hsl(165, 70%, 70%), hsl(165, 75%, 50%) 50%, hsl(165, 80%, 40%))',
              boxShadow: '0 0 10px hsla(165, 90%, 60%, 0.6)',
              position: 'relative',
            }}>
              {/* Screen face */}
              <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 22, height: 14, borderRadius: 3, background: '#000' }}>
                <div style={{ position: 'absolute', top: 4, left: 4, width: 3, height: 3, background: '#5cffa8', boxShadow: '0 0 3px #5cffa8' }} />
                <div style={{ position: 'absolute', top: 4, left: 9, width: 3, height: 3, background: '#5cffa8', boxShadow: '0 0 3px #5cffa8' }} />
                <div style={{ position: 'absolute', top: 4, right: 9, width: 3, height: 3, background: '#5cffa8', boxShadow: '0 0 3px #5cffa8' }} />
                <div style={{ position: 'absolute', top: 4, right: 4, width: 3, height: 3, background: '#5cffa8', boxShadow: '0 0 3px #5cffa8' }} />
                <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 8, height: 2, background: '#5cffa8', boxShadow: '0 0 3px #5cffa8' }} />
              </div>
            </div>
          </div>
        )}
        {type === 'mochi' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Ears */}
            <div style={{ position: 'absolute', top: -3, left: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid hsl(25, 85%, 50%)' }} />
            <div style={{ position: 'absolute', top: -3, right: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid hsl(25, 85%, 50%)' }} />
            {/* Body */}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, hsl(25, 95%, 80%), hsl(25, 90%, 60%) 60%, hsl(25, 80%, 45%))',
              boxShadow: '0 0 10px hsla(25, 90%, 60%, 0.6)',
              position: 'relative',
            }}>
              {/* Headphones */}
              <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', width: 22, height: 10, borderTop: '3px solid hsl(280, 60%, 35%)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', top: 7, left: -2, width: 7, height: 9, borderRadius: '40%', background: 'hsl(280, 70%, 42%)' }} />
              <div style={{ position: 'absolute', top: 7, right: -2, width: 7, height: 9, borderRadius: '40%', background: 'hsl(280, 70%, 42%)' }} />
              {/* Eyes */}
              <div style={{ position: 'absolute', top: 11, left: 8, width: 4, height: 6, borderRadius: '50%', background: '#1a1a2e' }} />
              <div style={{ position: 'absolute', top: 11, right: 8, width: 4, height: 6, borderRadius: '50%', background: '#1a1a2e' }} />
              {/* Nose */}
              <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '2px solid transparent', borderRight: '2px solid transparent', borderTop: '3px solid #ff80a0' }} />
            </div>
          </div>
        )}
        {type === 'yuki' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Ears */}
            <div style={{ position: 'absolute', top: -3, left: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid hsl(210, 25%, 88%)' }} />
            <div style={{ position: 'absolute', top: -3, right: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid hsl(210, 25%, 88%)' }} />
            {/* Body */}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #ffffff, #f0f4fa 60%, #d8e0ec)',
              boxShadow: '0 0 10px hsla(210, 40%, 80%, 0.6)',
              position: 'relative',
            }}>
              {/* Scarf */}
              <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', width: 24, height: 4, background: 'hsl(205, 65%, 60%)', borderRadius: '40%' }} />
              {/* Eyes (round, soft) */}
              <div style={{ position: 'absolute', top: 11, left: 8, width: 5, height: 5, borderRadius: '50%', background: '#1a1a2e' }} />
              <div style={{ position: 'absolute', top: 11, right: 8, width: 5, height: 5, borderRadius: '50%', background: '#1a1a2e' }} />
              {/* Nose */}
              <div style={{ position: 'absolute', top: 17, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '2px solid transparent', borderRight: '2px solid transparent', borderTop: '3px solid #ff80a0' }} />
            </div>
          </div>
        )}
        {type === 'kuro' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Ears */}
            <div style={{ position: 'absolute', top: -3, left: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid hsl(240, 30%, 25%)' }} />
            <div style={{ position: 'absolute', top: -3, right: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid hsl(240, 30%, 25%)' }} />
            {/* Body */}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #3a3a52, #252538 60%, #15151f)',
              boxShadow: '0 0 10px hsla(240, 40%, 30%, 0.6)',
              position: 'relative',
            }}>
              {/* Crescent moon */}
              <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'hsl(180, 80%, 70%)', boxShadow: '0 0 4px hsl(180, 80%, 70%)' }} />
              {/* Glowing cyan eyes */}
              <div style={{ position: 'absolute', top: 11, left: 7, width: 5, height: 5, borderRadius: '50%', background: '#5cffe8', boxShadow: '0 0 5px #5cffe8' }} />
              <div style={{ position: 'absolute', top: 11, right: 7, width: 5, height: 5, borderRadius: '50%', background: '#5cffe8', boxShadow: '0 0 5px #5cffe8' }} />
              {/* Nose */}
              <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '2px solid transparent', borderRight: '2px solid transparent', borderTop: '3px solid #5cffe8' }} />
            </div>
          </div>
        )}
        {type === 'bongo' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Ears (rounded) */}
            <div style={{ position: 'absolute', top: -2, left: 2, width: 7, height: 9, borderRadius: '40%', background: '#a8a098' }} />
            <div style={{ position: 'absolute', top: -2, right: 2, width: 7, height: 9, borderRadius: '40%', background: '#a8a098' }} />
            {/* Body (gray, chonky) */}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #d8d0c8, #a8a098 60%, #787068)',
              boxShadow: '0 0 10px hsla(30, 15%, 50%, 0.5)',
              position: 'relative',
            }}>
              {/* Eyes (round) */}
              <div style={{ position: 'absolute', top: 10, left: 8, width: 5, height: 5, borderRadius: '50%', background: '#1a1a1a' }} />
              <div style={{ position: 'absolute', top: 10, right: 8, width: 5, height: 5, borderRadius: '50%', background: '#1a1a1a' }} />
              {/* Nose */}
              <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '2px solid transparent', borderRight: '2px solid transparent', borderTop: '3px solid #ffa0b0' }} />
              {/* Paws (front) */}
              <div style={{ position: 'absolute', bottom: -2, left: 4, width: 9, height: 9, borderRadius: '50%', background: '#e8e0d8' }} />
              <div style={{ position: 'absolute', bottom: -2, right: 4, width: 9, height: 9, borderRadius: '50%', background: '#e8e0d8' }} />
            </div>
          </div>
        )}
        {type === 'popcat' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Ears */}
            <div style={{ position: 'absolute', top: -3, left: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #e8c898' }} />
            <div style={{ position: 'absolute', top: -3, right: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #e8c898' }} />
            {/* Body (cream) */}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #fff5e8, #f0d8b8 60%, #d8b888)',
              boxShadow: '0 0 10px hsla(35, 50%, 60%, 0.5)',
              position: 'relative',
            }}>
              {/* Big surprised eyes */}
              <div style={{ position: 'absolute', top: 10, left: 7, width: 6, height: 6, borderRadius: '50%', background: '#1a1a1a' }} />
              <div style={{ position: 'absolute', top: 10, right: 7, width: 6, height: 6, borderRadius: '50%', background: '#1a1a1a' }} />
              <div style={{ position: 'absolute', top: 11, left: 8.5, width: 2, height: 2, borderRadius: '50%', background: '#fff' }} />
              <div style={{ position: 'absolute', top: 11, right: 8.5, width: 2, height: 2, borderRadius: '50%', background: '#fff' }} />
              {/* The iconic O mouth */}
              <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', width: 5, height: 7, borderRadius: '50%', background: '#1a1a1a' }} />
            </div>
          </div>
        )}
        {type === 'neon' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Ears (wireframe triangles) */}
            <div style={{ position: 'absolute', top: -2, left: 4, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '6px solid hsl(290, 100%, 70%)', filter: 'drop-shadow(0 0 3px hsl(290, 100%, 60%))' }} />
            <div style={{ position: 'absolute', top: -2, right: 4, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '6px solid hsl(290, 100%, 70%)', filter: 'drop-shadow(0 0 3px hsl(290, 100%, 60%))' }} />
            {/* Body (hexagon outline with glow) */}
            <div style={{
              width: '100%', height: '100%',
              background: 'radial-gradient(circle, hsla(290, 100%, 70%, 0.4), hsla(180, 100%, 60%, 0.1))',
              boxShadow: '0 0 12px hsla(290, 100%, 60%, 0.6), inset 0 0 8px hsla(180, 100%, 60%, 0.3)',
              borderRadius: '20%',
              border: '2px solid hsl(290, 100%, 70%)',
              position: 'relative',
            }}>
              {/* Glowing eye bars */}
              <div style={{ position: 'absolute', top: 12, left: 5, width: 7, height: 3, background: 'hsl(180, 100%, 80%)', borderRadius: 2, boxShadow: '0 0 4px hsl(180, 100%, 60%)' }} />
              <div style={{ position: 'absolute', top: 12, right: 5, width: 7, height: 3, background: 'hsl(180, 100%, 80%)', borderRadius: 2, boxShadow: '0 0 4px hsl(180, 100%, 60%)' }} />
              {/* Glowing mouth line */}
              <div style={{ position: 'absolute', top: 19, left: '50%', transform: 'translateX(-50%)', width: 6, height: 1.5, background: 'hsl(180, 100%, 70%)', borderRadius: 1, boxShadow: '0 0 3px hsl(180, 100%, 60%)' }} />
            </div>
          </div>
        )}
        {type === 'blob3d' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* 3D-style blob — circle with radial gradient for 3D effect */}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, hsl(280, 80%, 80%), hsl(280, 70%, 50%) 50%, hsl(280, 75%, 30%))',
              boxShadow: '0 0 12px hsla(280, 70%, 50%, 0.5), inset -4px -4px 8px rgba(0,0,0,0.3)',
              position: 'relative',
            }}>
              {/* Eyes */}
              <div style={{ position: 'absolute', top: 11, left: 8, width: 5, height: 5, borderRadius: '50%', background: '#1a1a2e' }} />
              <div style={{ position: 'absolute', top: 11, right: 8, width: 5, height: 5, borderRadius: '50%', background: '#1a1a2e' }} />
              {/* Specular highlight */}
              <div style={{ position: 'absolute', top: 5, left: 8, width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
            </div>
          </div>
        )}
        {type === 'cat3d' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Ears */}
            <div style={{ position: 'absolute', top: -3, left: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '8px solid hsl(25, 75%, 45%)' }} />
            <div style={{ position: 'absolute', top: -3, right: 3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '8px solid hsl(25, 75%, 45%)' }} />
            {/* Body — 3D-style sphere */}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, hsl(25, 85%, 75%), hsl(25, 75%, 50%) 50%, hsl(25, 80%, 30%))',
              boxShadow: '0 0 12px hsla(25, 75%, 50%, 0.5), inset -4px -4px 8px rgba(0,0,0,0.3)',
              position: 'relative',
            }}>
              {/* Eyes */}
              <div style={{ position: 'absolute', top: 11, left: 7, width: 5, height: 5, borderRadius: '50%', background: '#1a1a2e' }} />
              <div style={{ position: 'absolute', top: 11, right: 7, width: 5, height: 5, borderRadius: '50%', background: '#1a1a2e' }} />
              {/* Specular highlight */}
              <div style={{ position: 'absolute', top: 5, left: 7, width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
              {/* Nose */}
              <div style={{ position: 'absolute', top: 17, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '2px solid transparent', borderRight: '2px solid transparent', borderTop: '3px solid #ff80a0' }} />
            </div>
          </div>
        )}
        {type === 'spark' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" style={{ filter: 'drop-shadow(0 0 4px hsl(180, 100%, 50%))' }}>
              <path d="M 16 28 Q 12 20 16 16 Q 20 12 16 8 Q 14 5 16 4" stroke="hsl(180, 100%, 50%)" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.3" />
              <path d="M 16 28 Q 12 20 16 16 Q 20 12 16 8 Q 14 5 16 4" stroke="hsl(180, 100%, 60%)" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.5" />
              <path d="M 16 28 Q 12 20 16 16 Q 20 12 16 8 Q 14 5 16 4" stroke="hsl(180, 100%, 70%)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M 16 28 Q 12 20 16 16 Q 20 12 16 8 Q 14 5 16 4" stroke="white" strokeWidth="0.6" fill="none" strokeLinecap="round" opacity="0.9" />
              <circle cx="16" cy="4" r="4" fill="hsl(180, 100%, 60%)" opacity="0.4" />
              <circle cx="16" cy="4" r="2.5" fill="hsl(180, 100%, 70%)" />
              <circle cx="16" cy="4" r="1" fill="white" />
              <circle cx="14.5" cy="3.5" r="0.8" fill="hsl(60, 100%, 80%)" />
              <circle cx="17.5" cy="3.5" r="0.8" fill="hsl(60, 100%, 80%)" />
            </svg>
          </div>
        )}
        {type === 'mochi2' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -2, left: 0, width: 9, height: 16, borderRadius: '45%', background: 'hsl(280, 50%, 70%)', transform: 'rotate(-25deg)' }} />
            <div style={{ position: 'absolute', top: -2, right: 0, width: 9, height: 16, borderRadius: '45%', background: 'hsl(280, 50%, 70%)', transform: 'rotate(25deg)' }} />
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, hsl(280, 60%, 88%), hsl(280, 50%, 72%) 60%, hsl(280, 55%, 58%))', boxShadow: '0 0 10px hsla(280, 50%, 70%, 0.5)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 10, left: 6, width: 7, height: 7, borderRadius: '50%', background: '#3a2a4a' }} />
              <div style={{ position: 'absolute', top: 10, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#3a2a4a' }} />
              <div style={{ position: 'absolute', top: 11, left: 7.5, width: 3, height: 3, borderRadius: '50%', background: '#fff' }} />
              <div style={{ position: 'absolute', top: 11, right: 7.5, width: 3, height: 3, borderRadius: '50%', background: '#fff' }} />
              <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', fontSize: '7px', color: 'hsl(340, 90%, 65%)', lineHeight: 1 }}>♥</div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
