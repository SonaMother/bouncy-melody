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
} from '@/lib/game/render'
import { drawVignette, drawFlash, WeatherSystem } from '@/lib/game/postfx'
import { drawParticle, drawFloatingText } from '@/lib/game/particles'
import {
  TTS_MESSAGES,
  NonRepeatingQueue,
  TtsAudioProcessor,
} from '@/lib/game/tts-engine'
import { CreatureSfxEngine, type SfxAction } from '@/lib/game/creature-sfx'
import { MidiKeyboard } from '@/lib/game/midi-keyboard'
import { SOUNDFONT_OPTIONS } from '@/lib/game/soundfont-manager'

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
  const GAME_VERSION = 'v5.0.0'  // 4 new characters: PixelBot, Ragdoll, Geometric, Shadow
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const musicRef = useRef<MusicEngine | null>(null)
  const sfxRef = useRef<CreatureSfxEngine | null>(null)
  const weatherRef = useRef<WeatherSystem>(new WeatherSystem())
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const lastTtsMilestone = useRef<number>(0)

  // Cat purr on streak — plays when character is on a combo streak
  const lastPurrRef = useRef<number>(0)
  const playPurrRef = useRef<(() => void) | null>(null)
  const activePurrRef = useRef<HTMLAudioElement | null>(null)  // track for hard stop

  // Refs that mirror props/state so the animation loop can read live values
  // without having those values in its useEffect deps (which would cause the
  // loop to tear down and restart on every change — a major source of frame
  // stutters and HMR instability).
  const bestRef = useRef(0)
  const onPhaseChangeRef = useRef(onPhaseChange)
  const onScoreChangeRef = useRef(onScoreChange)
  const onHeightChangeRef = useRef(onHeightChange)
  const onBestChangeRef = useRef(onBestChange)

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
  // TTS settings — voice ON by default per user request
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true)
  const [ttsReverb, setTtsReverb] = useState<number>(0.45)
  const [ttsDelay, setTtsDelay] = useState<number>(0.35)
  const [ttsVolume, setTtsVolume] = useState<number>(1.0)
  // SFX settings — creature sounds ON by default
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(true)
  const [sfxVolume, setSfxVolume] = useState<number>(0.35)
  // Separate music layer volumes (1.0 = original volume, 0 = mute)
  const [bassVolume, setBassVolume] = useState<number>(1.0)
  const [padVolume, setPadVolume] = useState<number>(1.0)
  const [melodyVolume, setMelodyVolume] = useState<number>(1.0)
  // Weather — snow by default (sub-pixel, optimized)
  const [weather, setWeather] = useState<'none' | 'snow' | 'rain'>('snow')
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [showSplash, setShowSplash] = useState<boolean>(true)  // splash on launch
  // Settings tabs
  const [settingsTab, setSettingsTab] = useState<'audio' | 'voice' | 'sfx' | 'midi'>('audio')
  // MIDI keyboard
  const [midiEnabled, setMidiEnabled] = useState<boolean>(false)
  const midiRef = useRef<MidiKeyboard | null>(null)
  // Soundfont selection — per channel
  const [melodySoundfont, setMelodySoundfont] = useState<string>('')
  const [bassSoundfont, setBassSoundfont] = useState<string>('')
  const [padSoundfont, setPadSoundfont] = useState<string>('')
  const [soundfontLoading, setSoundfontLoading] = useState<boolean>(false)
  const [activeMidiChannel, setActiveMidiChannel] = useState<'melody' | 'bass' | 'pad'>('melody')
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('')
  const [subtitleTimer, setSubtitleTimer] = useState<number>(0)
  // Use fixed defaults to avoid hydration mismatch — localStorage loaded in useEffect after mount
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterType>('mochi')
  const [selectedGenre, setSelectedGenre] = useState<MusicGenre>('lofi')

  // ---- TTS (Text-to-Speech) motivational voice ----
  // Story: Our character climbs toward Ah-Rash, the NonExistent — a god-like
  // figure in the sky who may or may not exist. Each milestone brings us
  // closer to the truth. Voice lines are pre-rendered with Kokoro TTS
  // (af_nicole — ASMR whisper) and routed through a Web Audio reverb graph
  // for an epic, dramatic, surreal quality.
  const ttsQueueRef = useRef<NonRepeatingQueue>(new NonRepeatingQueue(TTS_MESSAGES.length))
  const ttsProcessorRef = useRef<TtsAudioProcessor | null>(null)
  const activeTtsAudioRef = useRef<HTMLAudioElement | null>(null)
  const subtitleShownRef = useRef<boolean>(false)
  const ttsEnabledRef = useRef(ttsEnabled)
  const ttsReverbRef = useRef(ttsReverb)
  const ttsDelayRef = useRef(ttsDelay)
  const ttsVolumeRef = useRef(ttsVolume)
  const sfxEnabledRef = useRef(sfxEnabled)
  const sfxVolumeRef = useRef(sfxVolume)

  const speakMotivational = useCallback(() => {
    if (!ttsEnabledRef.current) return

    // Lazy-init the Web Audio send graph on first speak
    if (!ttsProcessorRef.current) {
      const proc = new TtsAudioProcessor()
      proc.init()
      proc.setReverbAmount(ttsReverbRef.current)
      proc.setDelayAmount(ttsDelayRef.current)
      proc.setVolume(ttsVolumeRef.current)
      ttsProcessorRef.current = proc
    }
    ttsProcessorRef.current.resume()

    // Non-repeating shuffle — never plays same line back-to-back
    const idx = ttsQueueRef.current.next()
    const msg = TTS_MESSAGES[idx]
    const audio = new Audio(`/tts/tts_${idx}.ogg`)
    audio.volume = ttsVolumeRef.current
    activeTtsAudioRef.current = audio

    // Route through send graph (dry + reverb + delay)
    ttsProcessorRef.current.connect(audio)

    // Don't show subtitle yet — wait for audio to actually start playing
    // (FIXES: subtitle starting way too early, before audio begins)
    subtitleShownRef.current = false
    const showSubtitle = () => {
      if (subtitleShownRef.current) return  // prevent double-show
      subtitleShownRef.current = true
      setCurrentSubtitle(msg)
      // Subtitle lasts exactly as long as the audio (no +2s padding — user said too long)
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setSubtitleTimer(audio.duration)
      } else {
        // Fallback: estimate from message length (~18 chars/sec)
        setSubtitleTimer(Math.max(2, msg.length / 18))
      }
    }

    audio.addEventListener('playing', showSubtitle, { once: true })

    audio.play().catch(() => {
      // Fallback to Web Speech API if audio play fails — show subtitle immediately
      showSubtitle()
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(msg)
        utterance.rate = 1.1
        utterance.pitch = 1.3
        utterance.volume = ttsVolumeRef.current
        window.speechSynthesis.speak(utterance)
      }
    })

    // Fallback: if 'playing' event doesn't fire within 500ms, show subtitle anyway
    // (covers edge cases where the event is missed)
    setTimeout(() => {
      if (audio.readyState > 0 && !subtitleShownRef.current) {
        showSubtitle()
      }
    }, 500)

    audio.addEventListener('ended', () => {
      if (activeTtsAudioRef.current === audio) activeTtsAudioRef.current = null
    })
  }, [])

  const checkTtsMilestone = useCallback((jumpCount: number) => {
    if (!ttsEnabledRef.current) return
    // Trigger every 30 jumps (was 15 — user wants 2x more climbing between lines)
    // NOTE: This is based on TOTAL climbing progress (jumpCount), NOT combo.
    // Combo can break, fall to zero, whatever — speeches still trigger purely
    // from how high you've climbed. No combo dependency.
    const milestone = Math.floor(jumpCount / 30) * 30
    if (milestone > 0 && milestone > lastTtsMilestone.current) {
      lastTtsMilestone.current = milestone
      speakMotivational()
      return
    }
    // Fallback: onJumpMulti schedules steps in the future (85ms intervals),
    // so getJumpCount() returns the PRE-schedule count. Re-check after the
    // scheduled steps have executed to catch milestones from multi-jumps.
    setTimeout(() => {
      if (!ttsEnabledRef.current || !musicRef.current) return
      const updatedCount = musicRef.current.getJumpCount()
      const updatedMilestone = Math.floor(updatedCount / 30) * 30
      if (updatedMilestone > 0 && updatedMilestone > lastTtsMilestone.current) {
        lastTtsMilestone.current = updatedMilestone
        speakMotivational()
      }
    }, 600)
  }, [speakMotivational])

  // Reset TTS milestone tracking on new game (FIXES: "lost momentum = no speeches")
  const resetTts = useCallback(() => {
    lastTtsMilestone.current = 0
    ttsQueueRef.current.reset()
    setCurrentSubtitle('')
    setSubtitleTimer(0)
    if (activeTtsAudioRef.current) {
      try { activeTtsAudioRef.current.pause() } catch {}
      activeTtsAudioRef.current = null
    }
  }, [])

  useEffect(() => { ttsEnabledRef.current = ttsEnabled }, [ttsEnabled])
  useEffect(() => { ttsReverbRef.current = ttsReverb }, [ttsReverb])
  useEffect(() => { ttsDelayRef.current = ttsDelay }, [ttsDelay])
  useEffect(() => { ttsVolumeRef.current = ttsVolume }, [ttsVolume])
  useEffect(() => { sfxEnabledRef.current = sfxEnabled }, [sfxEnabled])
  useEffect(() => { sfxVolumeRef.current = sfxVolume }, [sfxVolume])
  // Apply layer volume multipliers to music engine
  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.setBassVolumeMult(bassVolume)
      musicRef.current.setPadVolumeMult(padVolume)
      musicRef.current.setMelodyVolumeMult(melodyVolume)
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('bouncy-bass-vol', String(bassVolume))
      localStorage.setItem('bouncy-pad-vol', String(padVolume))
      localStorage.setItem('bouncy-melody-vol', String(melodyVolume))
    }
  }, [bassVolume, padVolume, melodyVolume])
  useEffect(() => {
    if (sfxRef.current) {
      sfxRef.current.setEnabled(sfxEnabled)
      sfxRef.current.setVolume(sfxVolume)
    }
  }, [sfxEnabled, sfxVolume])
  useEffect(() => {
    if (ttsProcessorRef.current) {
      ttsProcessorRef.current.setReverbAmount(ttsReverb)
      ttsProcessorRef.current.setDelayAmount(ttsDelay)
      ttsProcessorRef.current.setVolume(ttsVolume)
    }
  }, [ttsReverb, ttsDelay, ttsVolume])

  useEffect(() => {
    weatherRef.current.setWeather(weather)
    if (typeof window !== 'undefined') localStorage.setItem('bouncy-weather', weather)
  }, [weather])

  // Play a creature SFX (lazy-inits the engine on first call)
  const playSfx = useCallback((action: SfxAction) => {
    if (!sfxEnabledRef.current) return
    if (!sfxRef.current) {
      const engine = new CreatureSfxEngine()
      engine.init()
      engine.setEnabled(sfxEnabledRef.current)
      engine.setVolume(sfxVolumeRef.current)
      sfxRef.current = engine
    }
    sfxRef.current.resume()
    sfxRef.current.play(action)
  }, [])

  // Play cat purr (for streaks) — loads the cat_purr.ogg sample and plays it softly
  useEffect(() => {
    playPurrRef.current = () => {
      if (!sfxEnabledRef.current) return
      // Stop any existing purr
      if (activePurrRef.current) {
        try { activePurrRef.current.pause() } catch {}
      }
      const audio = new Audio('/sfx/cat_purr.ogg')
      audio.volume = 0.3
      activePurrRef.current = audio
      audio.play().catch(() => {})
      audio.addEventListener('ended', () => {
        if (activePurrRef.current === audio) activePurrRef.current = null
      })
    }
  }, [])

  // Hard stop ALL sounds (called when quitting to menu)
  const hardStopAllSounds = useCallback(() => {
    // Stop music engine
    musicRef.current?.stop()
    // Stop any active TTS
    if (activeTtsAudioRef.current) {
      try { activeTtsAudioRef.current.pause() } catch {}
      activeTtsAudioRef.current = null
    }
    // Stop purr
    if (activePurrRef.current) {
      try { activePurrRef.current.pause() } catch {}
      activePurrRef.current = null
    }
    // Stop SFX engine
    if (sfxRef.current) {
      sfxRef.current.resume() // ensure it's running so we can... actually just stop
    }
    // Stop Web Speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Toggle MIDI keyboard support
  const toggleMidi = useCallback(async () => {
    if (midiEnabled) {
      midiRef.current?.disconnect()
      midiRef.current = null
      setMidiEnabled(false)
    } else {
      const midi = new MidiKeyboard()
      const ok = await midi.init()
      if (ok) {
        // If music engine exists, connect. If not, create a minimal one for MIDI testing.
        if (!musicRef.current) {
          musicRef.current = new MusicEngine()
          await musicRef.current.init()
        }
        midi.setMusicEngine(musicRef.current)
        midiRef.current = midi
        setMidiEnabled(true)
      }
    }
  }, [midiEnabled])

  // Load a soundfont for a specific channel
  const loadChannelSoundfont = useCallback(async (channel: 'melody' | 'bass' | 'pad', instrumentId: string) => {
    // Update state immediately
    if (channel === 'melody') setMelodySoundfont(instrumentId)
    if (channel === 'bass') setBassSoundfont(instrumentId)
    if (channel === 'pad') setPadSoundfont(instrumentId)
    if (typeof window !== 'undefined') localStorage.setItem(`bouncy-sf-${channel}`, instrumentId)
    // Set this as active MIDI channel for testing
    setActiveMidiChannel(channel)
    if (!musicRef.current) return
    if (instrumentId === '') {
      musicRef.current.disableSoundfontChannel(channel)
      return
    }
    setSoundfontLoading(true)
    await musicRef.current.loadSoundfont(channel, instrumentId)
    musicRef.current.setMidiActiveChannel(channel)
    setSoundfontLoading(false)
  }, [])
  useEffect(() => {
    if (ttsProcessorRef.current) {
      ttsProcessorRef.current.setReverbAmount(ttsReverb)
      ttsProcessorRef.current.setVolume(ttsVolume)
    }
  }, [ttsReverb, ttsVolume])

  // Keep the prop/state refs in sync so the animation loop's closure reads
  // fresh values without needing to re-create itself.
  useEffect(() => { bestRef.current = best }, [best])
  useEffect(() => { onPhaseChangeRef.current = onPhaseChange }, [onPhaseChange])
  useEffect(() => { onScoreChangeRef.current = onScoreChange }, [onScoreChange])
  useEffect(() => { onHeightChangeRef.current = onHeightChange }, [onHeightChange])
  useEffect(() => { onBestChangeRef.current = onBestChange }, [onBestChange])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bouncy-tts', String(ttsEnabled))
      localStorage.setItem('bouncy-tts-reverb', String(ttsReverb))
      localStorage.setItem('bouncy-tts-delay', String(ttsDelay))
      localStorage.setItem('bouncy-tts-volume', String(ttsVolume))
      localStorage.setItem('bouncy-sfx', String(sfxEnabled))
      localStorage.setItem('bouncy-sfx-volume', String(sfxVolume))
    }
  }, [ttsEnabled, ttsReverb, ttsDelay, ttsVolume, sfxEnabled, sfxVolume])

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
      hardStopAllSounds()
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
    if (storedGenre === 'lofi' || storedGenre === 'mystic' || storedGenre === 'synthwave') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedGenre(storedGenre)
    }
    // Load TTS settings — voice ON by default unless explicitly disabled
    const storedTts = localStorage.getItem('bouncy-tts')
    if (storedTts === 'false') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTtsEnabled(false)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTtsEnabled(true)  // ON by default
    }
    const storedReverb = localStorage.getItem('bouncy-tts-reverb')
    if (storedReverb !== null) {
      const r = parseFloat(storedReverb)
      if (!isNaN(r) && r >= 0 && r <= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTtsReverb(r)
      }
    }
    const storedDelay = localStorage.getItem('bouncy-tts-delay')
    if (storedDelay !== null) {
      const d = parseFloat(storedDelay)
      if (!isNaN(d) && d >= 0 && d <= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTtsDelay(d)
      }
    }
    const storedVol = localStorage.getItem('bouncy-tts-volume')
    if (storedVol !== null) {
      const v = parseFloat(storedVol)
      if (!isNaN(v) && v >= 0 && v <= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTtsVolume(v)
      }
    }
    // Load SFX settings — ON by default unless explicitly disabled
    if (localStorage.getItem('bouncy-sfx') === 'false') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSfxEnabled(false)
    }
    const storedSfxVol = localStorage.getItem('bouncy-sfx-volume')
    if (storedSfxVol !== null) {
      const sv = parseFloat(storedSfxVol)
      if (!isNaN(sv) && sv >= 0 && sv <= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSfxVolume(sv)
      }
    }
    // Load music layer volumes
    const storedBassVol = localStorage.getItem('bouncy-bass-vol')
    if (storedBassVol !== null) {
      const v = parseFloat(storedBassVol)
      if (!isNaN(v) && v >= 0 && v <= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBassVolume(v)
      }
    }
    const storedPadVol = localStorage.getItem('bouncy-pad-vol')
    if (storedPadVol !== null) {
      const v = parseFloat(storedPadVol)
      if (!isNaN(v) && v >= 0 && v <= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPadVolume(v)
      }
    }
    const storedMelodyVol = localStorage.getItem('bouncy-melody-vol')
    if (storedMelodyVol !== null) {
      const v = parseFloat(storedMelodyVol)
      if (!isNaN(v) && v >= 0 && v <= 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMelodyVolume(v)
      }
    }
    // Load weather setting
    const storedWeather = localStorage.getItem('bouncy-weather') as 'none' | 'snow' | 'rain' | null
    if (storedWeather === 'none' || storedWeather === 'snow' || storedWeather === 'rain') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeather(storedWeather)
    }
    // Load saved per-channel soundfont preferences
    const storedMelodySf = localStorage.getItem('bouncy-sf-melody')
    if (storedMelodySf) setMelodySoundfont(storedMelodySf)
    const storedBassSf = localStorage.getItem('bouncy-sf-bass')
    if (storedBassSf) setBassSoundfont(storedBassSf)
    const storedPadSf = localStorage.getItem('bouncy-sf-pad')
    if (storedPadSf) setPadSoundfont(storedPadSf)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    // Auto-hide splash after 2.5 seconds
    const splashTimer = setTimeout(() => setShowSplash(false), 2500)
    return () => clearTimeout(splashTimer)
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
          playSfx('gameover')
          setPhase('gameover')
          onPhaseChangeRef.current?.('gameover')
          const newBest = Math.max(bestRef.current, state.bestHeight)
          setBest(newBest)
          localStorage.setItem('doodle-music-best', String(newBest))
          onBestChangeRef.current?.(newBest)
        },
        onJump: (kind) => {
          music.onJump(kind)
          playSfx('jump')
          if (navigator.vibrate) navigator.vibrate(12)
          // Play cat purr when on a streak (combo >= 5) — happy creature sound
          if (state.combo >= 5 && state.combo % 5 === 0) {
            const now = Date.now()
            if (now - lastPurrRef.current > 5000) {  // at most once per 5s
              lastPurrRef.current = now
              playPurrRef.current?.()
            }
          }
          setCombo(state.combo)
          setMusicStep(state.musicStep)
          setActiveLayers([...music.getActiveLayers()])
          setCurrentChordName(getChordName(music.getCurrentChord()))
          checkTtsMilestone(music.getJumpCount())
        },
        onJumpMulti: (count, kind) => {
          music.onJumpMulti(count, kind)
          if (kind === 'progress') playSfx('jump')
          if (navigator.vibrate) navigator.vibrate(12)
          if (state.combo >= 5 && state.combo % 5 === 0) {
            const now = Date.now()
            if (now - lastPurrRef.current > 5000) {
              lastPurrRef.current = now
              playPurrRef.current?.()
            }
          }
          setCombo(state.combo)
          setMusicStep(state.musicStep)
          setActiveLayers([...music.getActiveLayers()])
          setCurrentChordName(getChordName(music.getCurrentChord()))
          checkTtsMilestone(music.getJumpCount())
        },
        onBoost: () => {
          music.onBoost()
          playSfx('boost')
          if (navigator.vibrate) navigator.vibrate(40)
        },
        onBouncy: () => {
          music.onBouncy()
          playSfx('bouncy')
          if (navigator.vibrate) navigator.vibrate(15)
        },
        onBreak: () => {
          music.onBreak()
          playSfx('break')
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

      // Vignette & flash (skip in performance mode) — uses cached gradients
      if (!state.perfMode) {
        drawVignette(ctx, w, h, 0.5 + state.vignettePulse * 0.3)
        drawFlash(ctx, w, h, state.flashAlpha, state.flashHue)
      }

      // Weather (snow/rain) — sub-pixel, optimized, never syncs into patterns
      weatherRef.current.setSize(w, h)
      weatherRef.current.update(dt, state.time)
      weatherRef.current.draw(ctx, w, h)

      // Side gradient masking (play area framing)
      drawSideFades(ctx, w, h, offsetX)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // NOTE: deps intentionally EXCLUDE `best` and the on*Change callbacks.
    // Including `best` caused the entire RAF loop to tear down and restart
    // every time the best score updated (which happens during gameplay),
    // causing frame stutters. We use refs for values the loop needs to read
    // live, so the loop only needs to be created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Controls ----
  const startGame = useCallback(async () => {
    const music = musicRef.current
    const state = stateRef.current
    if (!music || !state) return
    // Make sure the selected character is applied to the game state
    state.character.type = selectedCharacter
    if (!started) {
      // Start Tone.js audio context FIRST (before creating Sampler)
      // Browser requires user gesture — Play button click counts.
      try {
        const { default: Tone } = await import('tone')
        await Tone.start()
      } catch {}
      await music.init()
      music.setGenre(selectedGenre)
      // Apply stored volumes NOW (gain nodes exist after init)
      music.applyStoredVolumes()
      music.start()
      // Apply saved soundfont if any
      if (melodySoundfont) {
        music.loadSoundfont("melody", melodySoundfont)
      if (bassSoundfont) music.loadSoundfont("bass", bassSoundfont)
      if (padSoundfont) music.loadSoundfont("pad", padSoundfont)
      }
      setStarted(true)
    } else {
      // Restart: just resume Tone's context
      try {
        const { default: Tone } = await import('tone')
        await Tone.start()
      } catch {}
      music.setGenre(selectedGenre)
      music.applyStoredVolumes()
      if (melodySoundfont) {
        music.loadSoundfont("melody", melodySoundfont)
      if (bassSoundfont) music.loadSoundfont("bass", bassSoundfont)
      if (padSoundfont) music.loadSoundfont("pad", padSoundfont)
      }
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
    // Reset TTS state so milestones start fresh (FIXES: lost momentum = no speeches)
    resetTts()
    setActiveLayers(music.getActiveLayers())
    setCurrentChordName(getChordName(music.getCurrentChord()))
  }, [started, onPhaseChange, selectedCharacter, selectedGenre, resetTts])

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

      {/* Splash art — shows on launch, auto-dismisses after 2.5s */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              zIndex: 100,
              background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0a0515 100%)',
            }}
            onClick={() => setShowSplash(false)}
          >
            {/* Animated glow behind text */}
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute"
              style={{
                width: '60%',
                height: '40%',
                background: 'radial-gradient(ellipse, rgba(236,72,153,0.4) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }}
            />
            {/* "ARASH GAMES" — company name */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-center"
            >
              <div
                className="text-[10px] uppercase tracking-[0.4em] text-white/50 font-bold mb-2 text-outline-sm"
                style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}
              >
                Presents
              </div>
              <div
                className="text-4xl sm:text-5xl font-black text-outline-sm"
                style={{
                  fontFamily: "'Baloo 2', system-ui, sans-serif",
                  background: 'linear-gradient(135deg, #fff 0%, #f9a8d4 50%, #c020a0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 40px rgba(236,72,153,0.5)',
                }}
              >
                ARASH GAMES
              </div>
            </motion.div>
            {/* Loading bar */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '60%' }}
              transition={{ duration: 2, ease: 'easeInOut' }}
              className="h-0.5 mt-8 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #ec4899, transparent)',
              }}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-[8px] uppercase tracking-[0.3em] text-white/30 mt-3 text-outline-sm"
            >
              Tap to continue
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto"
            style={{
              zIndex: 20,
              background: 'linear-gradient(180deg, rgba(10,5,20,0.95) 0%, rgba(20,10,35,0.92) 50%, rgba(10,5,20,0.95) 100%)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Title — centered, elegant */}
            <div className="text-center mb-4 mt-2">
              <h1
                className="text-4xl sm:text-5xl font-black leading-tight text-outline-sm"
                style={{
                  fontFamily: "'Baloo 2', 'Nunito', system-ui, sans-serif",
                  background: 'linear-gradient(135deg, #fff 0%, #fce4ec 40%, #f9a8d4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Bouncy Melody
              </h1>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 text-outline-sm mt-1">
                Seeking the NonExistent Ah-Rash
              </div>
            </div>

            {/* Play button — prominent */}
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={startGame}
              className="px-12 py-3 rounded-full font-black text-lg text-white text-outline-sm mb-2"
              style={{
                background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #be185d 100%)',
                boxShadow: '0 4px 20px rgba(236, 72, 153, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              ▶ Play
            </motion.button>

            {best > 0 && (
              <div className="text-white/60 text-[10px] text-outline-sm mb-2">
                Best: <span className="font-bold text-yellow-200">{best}m</span>
              </div>
            )}

            {/* Character grid — fills width */}
            <div className="w-full max-w-[340px] mb-3">
              <div className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-bold text-center mb-1.5 text-outline-sm">Character</div>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(CHARACTER_NAMES) as CharacterType[]).map((type) => {
                  const isSelected = selectedCharacter === type
                  const accentHue = type === 'pip' ? 340 : type === 'pixel' ? 165 : type === 'mochi' ? 25 : type === 'yuki' ? 205 : type === 'kuro' ? 180 : type === 'bongo' ? 30 : type === 'popcat' ? 35 : type === 'neon' ? 290 : type === 'blob3d' ? 280 : type === 'cat3d' ? 20 : type === 'spark' ? 180 : 280
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedCharacter(type)}
                      className="relative rounded-lg p-2 transition-all"
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, hsl(${accentHue}, 70%, 45%), hsl(${accentHue}, 75%, 28%))`
                          : 'rgba(15, 10, 25, 0.8)',
                        border: isSelected
                          ? `1.5px solid hsl(${accentHue}, 90%, 70%)`
                          : '1px solid rgba(255,255,255,0.12)',
                        boxShadow: isSelected ? `0 0 10px hsla(${accentHue}, 80%, 50%, 0.3)` : 'none',
                      }}
                    >
                      <CharacterPreview type={type} />
                      <div
                        className="text-[9px] font-bold mt-1 text-outline-sm"
                        style={{ color: isSelected ? `hsl(${accentHue}, 95%, 82%)` : 'rgba(255,255,255,0.6)' }}
                      >
                        {CHARACTER_NAMES[type]}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Genre + Voice — compact row */}
            <div className="w-full max-w-[340px]">
              <div className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-bold text-center mb-1.5 text-outline-sm">Genre</div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {(Object.keys(GENRE_CONFIGS) as MusicGenre[]).map((genre) => {
                  const isSelected = selectedGenre === genre
                  const config = GENRE_CONFIGS[genre]
                  const genreHue = genre === 'lofi' ? 200 : genre === 'mystic' ? 280 : 320
                  return (
                    <button
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                      className="rounded py-2 transition-all"
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, hsl(${genreHue}, 70%, 45%), hsl(${genreHue}, 75%, 28%))`
                          : 'rgba(15, 10, 25, 0.8)',
                        border: isSelected
                          ? `1.5px solid hsl(${genreHue}, 90%, 70%)`
                          : '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      <span className="text-[10px] font-bold text-outline-sm" style={{ color: isSelected ? 'white' : 'rgba(255,255,255,0.6)' }}>
                        {config.name}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Voice toggle + Settings gear */}
              <div className="flex justify-center gap-1">
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
                  className="rounded px-2 py-0.5 transition-all"
                  style={{
                    background: ttsEnabled
                      ? 'linear-gradient(135deg, hsl(140, 60%, 35%), hsl(140, 65%, 25%))'
                      : 'rgba(15, 10, 25, 0.8)',
                    border: ttsEnabled
                      ? '1.5px solid hsl(140, 80%, 55%)'
                      : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <span className="text-[8px] font-bold text-outline-sm" style={{ color: ttsEnabled ? 'white' : 'rgba(255,255,255,0.5)' }}>
                    {ttsEnabled ? '🔊 Voice' : '🔇 Voice'}
                  </span>
                </button>
                <button
                  onClick={() => setShowSettings(s => !s)}
                  className="rounded px-2 py-0.5 transition-all"
                  style={{
                    background: showSettings
                      ? 'linear-gradient(135deg, hsl(280, 60%, 35%), hsl(280, 65%, 25%))'
                      : 'rgba(15, 10, 25, 0.8)',
                    border: showSettings
                      ? '1.5px solid hsl(280, 80%, 55%)'
                      : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <span className="text-[8px] font-bold text-outline-sm" style={{ color: showSettings ? 'white' : 'rgba(255,255,255,0.6)' }}>
                    ⚙ Settings
                  </span>
                </button>
              </div>

              {/* Settings panel — collapsible */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1.5 rounded p-2"
                    style={{
                      background: 'rgba(15, 10, 25, 0.95)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {/* Tab bar */}
                    <div className="flex gap-0.5 mb-2">
                      {([
                        { id: 'audio', label: 'Audio' },
                        { id: 'voice', label: 'Voice' },
                        { id: 'sfx', label: 'SFX' },
                        { id: 'midi', label: 'MIDI' },
                      ] as const).map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setSettingsTab(tab.id)}
                          className="flex-1 rounded py-1 transition-all"
                          style={{
                            background: settingsTab === tab.id
                              ? 'linear-gradient(135deg, hsl(280, 60%, 35%), hsl(280, 65%, 25%))'
                              : 'rgba(15, 10, 25, 0.6)',
                            border: settingsTab === tab.id
                              ? '1px solid hsl(280, 80%, 55%)'
                              : '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <span className="text-[7px] font-bold text-outline-sm" style={{ color: settingsTab === tab.id ? 'white' : 'rgba(255,255,255,0.5)' }}>
                            {tab.label}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* AUDIO TAB */}
                    {settingsTab === 'audio' && (
                      <div className="space-y-1.5">
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm">Bass</span>
                            <span className="text-[8px] text-white/80 font-mono text-outline-sm">{Math.round(bassVolume * 100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={bassVolume}
                            onChange={(e) => setBassVolume(parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, hsl(200, 70%, 50%) ${bassVolume * 100}%, rgba(255,255,255,0.1) ${bassVolume * 100}%)` }} />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm">Melody (Piano)</span>
                            <span className="text-[8px] text-white/80 font-mono text-outline-sm">{Math.round(melodyVolume * 100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={melodyVolume}
                            onChange={(e) => setMelodyVolume(parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, hsl(45, 70%, 50%) ${melodyVolume * 100}%, rgba(255,255,255,0.1) ${melodyVolume * 100}%)` }} />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm">Pad (Organ)</span>
                            <span className="text-[8px] text-white/80 font-mono text-outline-sm">{Math.round(padVolume * 100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={padVolume}
                            onChange={(e) => setPadVolume(parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, hsl(280, 70%, 50%) ${padVolume * 100}%, rgba(255,255,255,0.1) ${padVolume * 100}%)` }} />
                        </div>
                        {/* Divider */}
                        <div className="border-t border-white/10 my-1"></div>
                        {/* Per-channel soundfont selectors */}
                        <div className="text-[8px] uppercase tracking-wider text-white/40 font-bold text-outline-sm mb-1">
                          Instruments {soundfontLoading && '(loading...)'}
                        </div>
                        {/* Melody instrument */}
                        <div className="mb-1">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setActiveMidiChannel('melody')
                                musicRef.current?.setMidiActiveChannel('melody')
                              }}
                              className="text-[7px] px-1 py-0.5 rounded"
                              style={{
                                background: activeMidiChannel === 'melody' ? 'hsl(45, 70%, 35%)' : 'rgba(15,10,25,0.6)',
                                border: activeMidiChannel === 'melody' ? '1px solid hsl(45,80%,55%)' : '1px solid rgba(255,255,255,0.1)',
                                color: activeMidiChannel === 'melody' ? 'white' : 'rgba(255,255,255,0.4)',
                              }}
                            >MIDI</button>
                            <span className="text-[7px] text-white/60">Melody</span>
                          </div>
                          <select
                            value={melodySoundfont}
                            onChange={(e) => loadChannelSoundfont('melody', e.target.value)}
                            className="w-full rounded px-1 py-0.5 text-[7px] bg-black/50 text-white border border-white/20 mt-0.5"
                          >
                            <option value="">🎹 Salamander Piano (default)</option>
                            {SOUNDFONT_OPTIONS.map(sf => (
                              <option key={sf.id} value={sf.id}>{sf.category} — {sf.name}</option>
                            ))}
                          </select>
                        </div>
                        {/* Bass instrument */}
                        <div className="mb-1">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setActiveMidiChannel('bass')
                                musicRef.current?.setMidiActiveChannel('bass')
                              }}
                              className="text-[7px] px-1 py-0.5 rounded"
                              style={{
                                background: activeMidiChannel === 'bass' ? 'hsl(200, 70%, 35%)' : 'rgba(15,10,25,0.6)',
                                border: activeMidiChannel === 'bass' ? '1px solid hsl(200,80%,55%)' : '1px solid rgba(255,255,255,0.1)',
                                color: activeMidiChannel === 'bass' ? 'white' : 'rgba(255,255,255,0.4)',
                              }}
                            >MIDI</button>
                            <span className="text-[7px] text-white/60">Bass</span>
                          </div>
                          <select
                            value={bassSoundfont}
                            onChange={(e) => loadChannelSoundfont('bass', e.target.value)}
                            className="w-full rounded px-1 py-0.5 text-[7px] bg-black/50 text-white border border-white/20 mt-0.5"
                          >
                            <option value="">🎵 Synth Bass (default)</option>
                            {SOUNDFONT_OPTIONS.map(sf => (
                              <option key={sf.id} value={sf.id}>{sf.category} — {sf.name}</option>
                            ))}
                          </select>
                        </div>
                        {/* Pad instrument */}
                        <div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setActiveMidiChannel('pad')
                                musicRef.current?.setMidiActiveChannel('pad')
                              }}
                              className="text-[7px] px-1 py-0.5 rounded"
                              style={{
                                background: activeMidiChannel === 'pad' ? 'hsl(280, 70%, 35%)' : 'rgba(15,10,25,0.6)',
                                border: activeMidiChannel === 'pad' ? '1px solid hsl(280,80%,55%)' : '1px solid rgba(255,255,255,0.1)',
                                color: activeMidiChannel === 'pad' ? 'white' : 'rgba(255,255,255,0.4)',
                              }}
                            >MIDI</button>
                            <span className="text-[7px] text-white/60">Pad</span>
                          </div>
                          <select
                            value={padSoundfont}
                            onChange={(e) => loadChannelSoundfont('pad', e.target.value)}
                            className="w-full rounded px-1 py-0.5 text-[7px] bg-black/50 text-white border border-white/20 mt-0.5"
                          >
                            <option value="">🎵 Hammond Organ (default)</option>
                            {SOUNDFONT_OPTIONS.map(sf => (
                              <option key={sf.id} value={sf.id}>{sf.category} — {sf.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* VOICE TAB */}
                    {settingsTab === 'voice' && (
                      <div className="space-y-1.5">
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm">Voice Reverb</span>
                            <span className="text-[8px] text-white/80 font-mono text-outline-sm">{Math.round(ttsReverb * 100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={ttsReverb}
                            onChange={(e) => setTtsReverb(parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, hsl(280, 70%, 50%) ${ttsReverb * 100}%, rgba(255,255,255,0.1) ${ttsReverb * 100}%)` }} />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm">Voice Echo</span>
                            <span className="text-[8px] text-white/80 font-mono text-outline-sm">{Math.round(ttsDelay * 100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={ttsDelay}
                            onChange={(e) => setTtsDelay(parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, hsl(200, 70%, 50%) ${ttsDelay * 100}%, rgba(255,255,255,0.1) ${ttsDelay * 100}%)` }} />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm">Voice Volume</span>
                            <span className="text-[8px] text-white/80 font-mono text-outline-sm">{Math.round(ttsVolume * 100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={ttsVolume}
                            onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, hsl(140, 70%, 50%) ${ttsVolume * 100}%, rgba(255,255,255,0.1) ${ttsVolume * 100}%)` }} />
                        </div>
                      </div>
                    )}

                    {/* SFX TAB */}
                    {settingsTab === 'sfx' && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm">Creature SFX</span>
                          <button onClick={() => setSfxEnabled(s => !s)}
                            className="rounded px-1.5 py-0.5 text-[8px] font-bold text-outline-sm transition-all"
                            style={{
                              background: sfxEnabled ? 'linear-gradient(135deg, hsl(280, 60%, 35%), hsl(280, 65%, 25%))' : 'rgba(15, 10, 25, 0.8)',
                              border: sfxEnabled ? '1px solid hsl(280, 80%, 55%)' : '1px solid rgba(255,255,255,0.12)',
                              color: sfxEnabled ? 'white' : 'rgba(255,255,255,0.5)',
                            }}>
                            {sfxEnabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm">SFX Volume</span>
                            <span className="text-[8px] text-white/80 font-mono text-outline-sm">{Math.round(sfxVolume * 100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={sfxVolume}
                            onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, hsl(280, 70%, 50%) ${sfxVolume * 100}%, rgba(255,255,255,0.1) ${sfxVolume * 100}%)` }} />
                        </div>
                        <div className="border-t border-white/10 my-1"></div>
                        <div>
                          <div className="text-[8px] uppercase tracking-wider text-white/60 font-bold text-outline-sm mb-0.5">Weather</div>
                          <div className="grid grid-cols-3 gap-0.5">
                            {(['none', 'snow', 'rain'] as const).map((mode) => (
                              <button key={mode} onClick={() => setWeather(mode)}
                                className="rounded py-0.5 transition-all"
                                style={{
                                  background: weather === mode ? 'linear-gradient(135deg, hsl(200, 60%, 35%), hsl(200, 65%, 25%))' : 'rgba(15, 10, 25, 0.8)',
                                  border: weather === mode ? '1px solid hsl(200, 80%, 55%)' : '1px solid rgba(255,255,255,0.12)',
                                }}>
                                <span className="text-[7px] font-bold text-outline-sm" style={{ color: weather === mode ? 'white' : 'rgba(255,255,255,0.5)' }}>
                                  {mode === 'none' ? 'Clear' : mode === 'snow' ? 'Snow' : 'Rain'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MIDI TAB */}
                    {settingsTab === 'midi' && (
                      <div className="space-y-2">
                        <div className="text-[8px] text-white/60 text-outline-sm leading-relaxed">
                          Connect a MIDI keyboard to play the game's piano. Press keys to hear real piano sounds.
                        </div>
                        <button onClick={toggleMidi}
                          className="w-full rounded py-1.5 text-[9px] font-bold text-outline-sm transition-all"
                          style={{
                            background: midiEnabled ? 'linear-gradient(135deg, hsl(140, 60%, 35%), hsl(140, 65%, 25%))' : 'linear-gradient(135deg, hsl(280, 60%, 35%), hsl(280, 65%, 25%))',
                            border: midiEnabled ? '1px solid hsl(140, 80%, 55%)' : '1px solid hsl(280, 80%, 55%)',
                            color: 'white',
                          }}>
                          {midiEnabled ? '✓ MIDI Connected — Click to Disconnect' : 'Connect MIDI Keyboard'}
                        </button>
                        {!midiEnabled && (
                          <div className="text-[7px] text-white/40 text-outline-sm">
                            Requires Web MIDI API support (Chrome/Edge). Click and allow MIDI access.
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="mt-2 text-center text-white/40 text-[8px] text-outline-sm">
              Tap sides to move · Tilt to steer · Bounce for Ah-Rash
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
                    // STOP music when quitting to menu
                    hardStopAllSounds()
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
              <div className="text-[11px] uppercase tracking-[0.3em] text-pink-200/80 font-bold mb-2 text-outline-sm" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>Ah-Rash is still watching</div>
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
                  // STOP music when going back to menu
                  hardStopAllSounds()
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
        {type === 'juri' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Ox-horn hair buns */}
            <div style={{ position: 'absolute', top: -6, left: 2, width: 8, height: 12, borderRadius: '40%', background: '#2a1050', transform: 'rotate(-15deg)' }} />
            <div style={{ position: 'absolute', top: -6, right: 2, width: 8, height: 12, borderRadius: '40%', background: '#2a1050', transform: 'rotate(15deg)' }} />
            {/* Head */}
            <div style={{ width: '100%', height: '90%', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #f5e0d0, #d8a080)', position: 'relative', marginTop: 2 }}>
              {/* Hair bangs */}
              <div style={{ position: 'absolute', top: -2, left: '15%', width: '70%', height: 8, borderRadius: '50% 50% 0 0', background: '#2a1050' }} />
              {/* Left eye (open) */}
              <div style={{ position: 'absolute', top: 11, left: 6, width: 5, height: 6, borderRadius: '50%', background: '#c020a0' }} />
              {/* Right eye (eye patch) */}
              <div style={{ position: 'absolute', top: 10, right: 5, width: 7, height: 6, borderRadius: '40%', background: '#1a1a1a' }} />
              <div style={{ position: 'absolute', top: 12, right: 7, width: 3, height: 3, borderRadius: '50%', background: '#c020a0', boxShadow: '0 0 4px #c020a0' }} />
              {/* Smirk */}
              <div style={{ position: 'absolute', top: 19, left: '40%', width: 6, height: 2, borderBottom: '1.5px solid #8a4030', borderRadius: '0 0 50% 50%' }} />
            </div>
          </div>
        )}
        {type === 'pixelbot' && (
          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Pixel art robot preview */}
            <div style={{ position: 'relative', width: 24, height: 28 }}>
              {/* Antenna */}
              <div style={{ position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)', width: 2, height: 3, background: '#ffdd44' }} />
              {/* Head */}
              <div style={{ position: 'absolute', top: 1, left: 3, width: 18, height: 14, background: '#4a90d9', border: '1px solid #1a1a2e', borderRadius: 2 }}>
                {/* Screen */}
                <div style={{ position: 'absolute', top: 3, left: 3, width: 12, height: 8, background: '#0a0a1a', borderRadius: 1 }}>
                  {/* Eyes */}
                  <div style={{ position: 'absolute', top: 2, left: 2, width: 2, height: 2, background: '#00ff88', boxShadow: '0 0 3px #00ff88' }} />
                  <div style={{ position: 'absolute', top: 2, right: 2, width: 2, height: 2, background: '#00ff88', boxShadow: '0 0 3px #00ff88' }} />
                </div>
              </div>
              {/* Body */}
              <div style={{ position: 'absolute', top: 15, left: 4, width: 16, height: 10, background: '#4a90d9', border: '1px solid #1a1a2e', borderRadius: 2 }}>
                <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: 6, height: 4, background: '#2a5a8a', borderRadius: 1 }} />
              </div>
              {/* Legs */}
              <div style={{ position: 'absolute', top: 25, left: 6, width: 3, height: 3, background: '#2a5a8a' }} />
              <div style={{ position: 'absolute', top: 25, right: 6, width: 3, height: 3, background: '#2a5a8a' }} />
            </div>
          </div>
        )}
        {type === 'ragdoll' && (
          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 28, height: 32 }}>
              {/* Head */}
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: '#f5d0b0' }}>
                <div style={{ position: 'absolute', top: 4, left: 2, width: 2, height: 2, borderRadius: '50%', background: '#1a1a2e' }} />
                <div style={{ position: 'absolute', top: 4, right: 2, width: 2, height: 2, borderRadius: '50%', background: '#1a1a2e' }} />
              </div>
              {/* Body */}
              <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '40%', background: '#e87b3a' }} />
              {/* Arms */}
              <div style={{ position: 'absolute', top: 12, left: 0, width: 5, height: 5, borderRadius: '50%', background: '#e87b3a' }} />
              <div style={{ position: 'absolute', top: 12, right: 0, width: 5, height: 5, borderRadius: '50%', background: '#e87b3a' }} />
              {/* Legs */}
              <div style={{ position: 'absolute', top: 24, left: 6, width: 5, height: 6, borderRadius: '40%', background: '#e87b3a' }} />
              <div style={{ position: 'absolute', top: 24, right: 6, width: 5, height: 6, borderRadius: '40%', background: '#e87b3a' }} />
            </div>
          </div>
        )}
        {type === 'geometric' && (
          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 24, height: 24, position: 'relative' }}>
              {/* Hexagon */}
              <div style={{ width: '100%', height: '100%', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: '#008877' }} />
              <div style={{ position: 'absolute', top: '15%', left: '15%', width: '70%', height: '70%', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: '#00d9c0' }} />
              {/* Eyes */}
              <div style={{ position: 'absolute', top: '35%', left: '30%', width: 3, height: 3, borderRadius: '50%', background: '#0a0a1a' }} />
              <div style={{ position: 'absolute', top: '35%', right: '30%', width: 3, height: 3, borderRadius: '50%', background: '#0a0a1a' }} />
            </div>
          </div>
        )}
        {type === 'shadow' && (
          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0a0a0a', border: '1px solid #aa66ff', boxShadow: '0 0 8px #aa66ff', position: 'relative' }}>
              {/* Glowing eyes */}
              <div style={{ position: 'absolute', top: '35%', left: '25%', width: 3, height: 5, borderRadius: '50%', background: '#aa66ff', boxShadow: '0 0 4px #aa66ff' }} />
              <div style={{ position: 'absolute', top: '35%', right: '25%', width: 3, height: 5, borderRadius: '50%', background: '#aa66ff', boxShadow: '0 0 4px #aa66ff' }} />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
