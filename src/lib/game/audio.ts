// Lofi jazzy procedural music engine
//
// Design:
// - Continuous bass pad that always plays the current chord root (the "always playing bass")
// - Each successful jump (going higher) plays ONE voice-led melody note
// - Every 4th jump: a soft chord stab as a reward
// - Every 8th jump: advance to next chord in the progression
// - Bounce on same platform: repeat the last note (the only allowed repetition)
// - Falling to a lower platform: reset progression to chord I
// - Special platforms (bouncy/boost/break/cloud) play musical sounds on the current scale
//
// All voices share a warm rhodes-like timbre (sine + triangle, low-pass filtered,
// detuned slightly for vintage chorus). Convolution reverb + tape-style delay for space.

import {
  CHORDS,
  SCALES,
  ProgressionEngine,
  GENRE_CONFIGS,
  type ChordDef,
  type MusicGenre,
  midiToFreq,
  getChordTonesInRange,
  getScaleTonesInRange,
} from './music-theory'
import { MelodyEngineV2 } from './melody-engine-v2'

// Default volumes (overridden by genre config)
const VOL = {
  pad:       0.05,
  bass:      0.32,
  melody:    0.20,
  chordStab: 0.08,
  special:   0.18,
}

// Comfortable MIDI ranges (keeps everything audible & musical)
const MELODY_MIN = 67  // G4
const MELODY_MAX = 86  // D6 (won't go above this — wraps to lower octave)
const BASS_MIN   = 33  // A1
const BASS_MAX   = 45  // A2

export class MusicEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private masterFilter: BiquadFilterNode | null = null
  private reverbBus: GainNode | null = null
  private convolver: ConvolverNode | null = null
  private delayBus: GainNode | null = null
  private delayNode: DelayNode | null = null
  private delayFeedback: GainNode | null = null
  private analyser: AnalyserNode | null = null

  private started = false
  private muted = false
  public level = 0

  // ---- Continuous pad voices (always playing) ----
  private padVoices: { osc: OscillatorNode; gain: GainNode }[] = []
  private padTargetFreqs: number[] = []
  private padCurrentChord: ChordDef

  // ---- Music state ----
  private progressionEngine: ProgressionEngine
  private melodyEngineV2: MelodyEngineV2
  private useMelodyV2 = true  // use v2 melody engine by default (better style matching)
  private jumpCount = 0
  private currentChord: ChordDef
  private lastMelodyNote = 72  // C5 — pleasant mid-range start
  private lastBassNote = 36    // C2
  private recentMelodyNotes: number[] = []
  private recentBassNotes: number[] = []
  private melodyContour = 0
  private running = false

  constructor() {
    this.progressionEngine = new ProgressionEngine()
    this.melodyEngineV2 = new MelodyEngineV2()
    this.melodyEngineV2.setStyle('lofi')
    this.currentChord = this.progressionEngine.getCurrentChord()
    this.padCurrentChord = this.currentChord
    this.padTargetFreqs = [0, 7, 12].map(i => midiToFreq(this.currentChord.bassNote + i))
  }

  async init() {
    if (this.ctx) return
    try {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      this.ctx = new Ctor()
      await this.ctx.resume()

      // Master chain: masterGain -> masterFilter (lowpass) -> analyser -> destination
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.muted ? 0 : 0.7

      this.masterFilter = this.ctx.createBiquadFilter()
      this.masterFilter.type = 'lowpass'
      this.masterFilter.frequency.value = 5200 // gentle high cut = lofi warmth
      this.masterFilter.Q.value = 0.4

      // Convolution reverb (synthesized impulse)
      this.convolver = this.ctx.createConvolver()
      this.convolver.buffer = this.makeImpulse(2.6, 2.5)
      this.reverbBus = this.ctx.createGain()
      this.reverbBus.gain.value = 0.45
      this.reverbBus.connect(this.convolver)
      this.convolver.connect(this.masterFilter)

      // Tape-style delay
      this.delayNode = this.ctx.createDelay(1.0)
      this.delayNode.delayTime.value = 0.38 // dotted-eighth feel
      this.delayFeedback = this.ctx.createGain()
      this.delayFeedback.gain.value = 0.34
      this.delayBus = this.ctx.createGain()
      this.delayBus.gain.value = 0.35
      this.delayBus.connect(this.delayNode)
      this.delayNode.connect(this.delayFeedback)
      this.delayFeedback.connect(this.delayNode)
      this.delayNode.connect(this.masterFilter)

      // Analyser
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 256

      // Routing
      this.masterGain.connect(this.masterFilter)
      this.masterFilter.connect(this.analyser)
      this.analyser.connect(this.ctx.destination)

      this.started = true
      this.startPad()
    } catch (e) {
      console.warn('MusicEngine init failed', e)
    }
  }

  private makeImpulse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!
    const rate = ctx.sampleRate
    const len = Math.floor(rate * duration)
    const buf = ctx.createBuffer(2, len, rate)
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c)
      for (let i = 0; i < len; i++) {
        const t = i / len
        const env = Math.pow(1 - t, decay) * (1 - Math.pow(1 - t, 8))
        data[i] = (Math.random() * 2 - 1) * env
      }
    }
    return buf
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.masterGain.gain.linearRampToValueAtTime(
        m ? 0 : 0.7,
        this.ctx.currentTime + 0.3,
      )
    }
  }

  isMuted() { return this.muted }

  /** Set the music genre (lofi, mystic, synthwave). Updates synthesis params live. */
  setGenre(genre: MusicGenre) {
    this.progressionEngine.setGenre(genre)
    this.melodyEngineV2.setStyle(genre)
    this.currentChord = this.progressionEngine.getCurrentChord()
    this.padCurrentChord = this.currentChord
    this.setPadChord(this.currentChord)

    // Update synthesis parameters
    const config = GENRE_CONFIGS[genre]
    if (this.masterFilter && this.ctx) {
      this.masterFilter.frequency.linearRampToValueAtTime(config.masterFilterFreq, this.ctx.currentTime + 0.5)
    }
    if (this.reverbBus && this.ctx) {
      this.reverbBus.gain.linearRampToValueAtTime(config.reverbAmount, this.ctx.currentTime + 0.5)
    }
    if (this.delayBus && this.ctx) {
      this.delayBus.gain.linearRampToValueAtTime(config.delayAmount, this.ctx.currentTime + 0.5)
    }
    // Update pad volume
    this.setPadVolume(config.padVolume)
  }

  getGenre(): MusicGenre {
    return this.progressionEngine.getGenre()
  }

  /** Toggle between v1 (random) and v2 (style-aware) melody engines */
  setMelodyEngineV2(enabled: boolean) {
    this.useMelodyV2 = enabled
  }

  isMelodyV2(): boolean {
    return this.useMelodyV2
  }

  start() {
    if (!this.ctx || this.running) return
    this.running = true
    this.resetState()
    const config = GENRE_CONFIGS[this.progressionEngine.getGenre()]
    this.setPadVolume(config.padVolume)
  }

  stop() {
    this.running = false
  }

  /** Reset musical state to the tonic of the starting key. */
  resetState() {
    this.jumpCount = 0
    this.progressionEngine.reset()
    this.melodyEngineV2.reset()
    this.currentChord = this.progressionEngine.getCurrentChord()
    this.padCurrentChord = this.currentChord
    this.lastMelodyNote = 72
    this.lastBassNote = 36
    this.recentMelodyNotes = []
    this.recentBassNotes = []
    this.melodyContour = 0
    this.padTargetFreqs = [0, 7, 12].map(i => midiToFreq(this.currentChord.bassNote + i))
    this.setPadChord(this.currentChord)
  }

  // ---- Continuous bass pad ----

  private startPad() {
    if (!this.ctx || !this.masterGain || !this.reverbBus) return
    // 3 voices: root, fifth, octave — gives a warm harmonic bed
    const intervals = [0, 7, 12]
    for (const interval of intervals) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'sine'
      osc.frequency.value = midiToFreq(this.currentChord.bassNote + interval)

      filter.type = 'lowpass'
      filter.frequency.value = 600

      gain.gain.value = 0

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      gain.connect(this.reverbBus)
      osc.start()
      this.padVoices.push({ osc, gain })
      this.padTargetFreqs.push(osc.frequency.value)
    }
  }

  private setPadVolume(v: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    for (const voice of this.padVoices) {
      voice.gain.gain.cancelScheduledValues(t)
      voice.gain.gain.linearRampToValueAtTime(v, t + 1.2)
    }
  }

  private setPadChord(chord: ChordDef) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const intervals = [0, 7, 12]
    for (let i = 0; i < this.padVoices.length; i++) {
      const voice = this.padVoices[i]
      const newFreq = midiToFreq(chord.bassNote + intervals[i])
      voice.osc.frequency.cancelScheduledValues(t)
      // Slow portamento glide — lofi pad feel
      voice.osc.frequency.setValueAtTime(voice.osc.frequency.value, t)
      voice.osc.frequency.exponentialRampToValueAtTime(newFreq, t + 1.0)
    }
    this.padCurrentChord = chord
  }

  // ---- Main game event: jump ----

  /**
   * Called on every platform bounce.
   *
   * @param kind 'progress' = higher platform, 'same' = same platform, 'dip' = lower platform
   */
  onJump(kind: 'progress' | 'same' | 'dip') {
    if (!this.ctx) return

    if (kind === 'dip') {
      this.onDipReset()
      return
    }

    if (kind === 'same') {
      // Repeat the last melody note (this is the ONLY allowed repetition)
      this.playMelodyVoice(this.lastMelodyNote, 0.7, this.ctx.currentTime)
      this.playBassVoice(this.lastBassNote, 0.8, this.ctx.currentTime)
      return
    }

    // Progress: advance music by 1 step
    this.scheduleProgressionStep(this.ctx.currentTime)
  }

  /**
   * Called when bouncing on a special platform that launches the player higher.
   * Plays `count` melody notes in rapid succession, as if the player jumped on
   * `count` platforms quickly. Each note is voice-led and progresses the music
   * (chord stabs, chord advances, bass walking all happen naturally).
   *
   * @param count number of rapid notes to play (2-5 based on launch height)
   * @param kind 'progress' or 'dip' (dip still resets)
   */
  onJumpMulti(count: number, kind: 'progress' | 'same' | 'dip' = 'progress') {
    if (!this.ctx) return

    if (kind === 'dip') {
      this.onDipReset()
      return
    }

    // Schedule `count` progression steps at 85ms intervals
    // This creates a rapid melodic flourish that mirrors the boosted jump
    const baseTime = this.ctx.currentTime
    const interval = 0.085 // 85ms between notes — fast but musical
    for (let i = 0; i < count; i++) {
      this.scheduleProgressionStep(baseTime + i * interval)
    }
  }

  /**
   * Advance the music by one step at a scheduled time.
   * Handles: jump count, chord advancement, chord stabs, melody, bass.
   */
  private scheduleProgressionStep(time: number) {
    this.jumpCount++

    // Every 8 jumps → advance to the next chord in the progression
    if (this.jumpCount > 0 && this.jumpCount % 8 === 0) {
      this.advanceChord()
    }

    // Every 4 jumps → play a chord stab as a reward
    if (this.jumpCount % 4 === 0) {
      this.playChordStab(time)
    }

    // Always: voice-led melody note
    this.playVoiceLedMelody(time)

    // Always: bass note (walking toward chord root)
    this.playWalkingBass(time)
  }

  private advanceChord() {
    // Use the progression engine — it picks the next chord based on
    // functional harmony rules (I → ii/IV → V → I) and tracks recent
    // chords to avoid repetition. This ensures forward harmonic motion
    // instead of random bouncing.
    this.currentChord = this.progressionEngine.advanceChord()
    this.setPadChord(this.currentChord)
  }

  // ---- Melody: voice-led with chord tones + scale passing notes ----

  private playVoiceLedMelody(time?: number) {
    const chord = this.currentChord
    const t = time ?? this.ctx!.currentTime

    // Use v2 melody engine if enabled (style-aware, less random)
    if (this.useMelodyV2) {
      const note = this.melodyEngineV2.nextNote(chord, MELODY_MIN, MELODY_MAX)
      this.lastMelodyNote = note
      this.playMelodyVoice(note, 1.0, t)
      return
    }

    // Original v1 melody engine (weighted random voice-leading)
    const chordTones = getChordTonesInRange(chord, MELODY_MIN, MELODY_MAX)
    const scaleTones = getScaleTonesInRange(chord, MELODY_MIN, MELODY_MAX)

    // Build weighted candidates
    const candidates: { note: number; weight: number }[] = []
    const seen = new Set<number>()

    // Chord tones get high weight (they're consonant)
    for (const n of chordTones) {
      if (!seen.has(n)) {
        candidates.push({ note: n, weight: 3.0 })
        seen.add(n)
      }
    }
    // Scale tones get lower weight (passing tones)
    for (const n of scaleTones) {
      if (!seen.has(n)) {
        candidates.push({ note: n, weight: 0.7 })
        seen.add(n)
      }
    }

    // Apply voice-leading weights
    for (const c of candidates) {
      const dist = Math.abs(c.note - this.lastMelodyNote)

      // Discourage very large leaps (> octave)
      if (dist > 12) c.weight *= 0.15

      // Discourage exact repeat
      if (dist === 0) c.weight *= 0.1

      // Prefer steps (1-3 semitones) and small leaps (4-7)
      if (dist >= 1 && dist <= 3) c.weight *= 1.6
      if (dist >= 4 && dist <= 7) c.weight *= 1.2

      // Larger leaps (octaves, sixths) occasional — they sound intentional in jazz
      if (dist === 7 || dist === 12) c.weight *= 0.9

      // Contour balance: if we've been climbing, prefer descending, and vice versa
      if (this.melodyContour > 5 && c.note < this.lastMelodyNote) c.weight *= 1.7
      if (this.melodyContour < -5 && c.note > this.lastMelodyNote) c.weight *= 1.7

      // Avoid repeating recent notes too often
      const recentCount = this.recentMelodyNotes.filter(n => n === c.note).length
      c.weight *= Math.pow(0.5, recentCount)

      // Random factor
      c.weight *= 0.4 + Math.random() * 0.8
    }

    // Pick the best candidate
    let best = candidates[0]
    let bestWeight = -Infinity
    for (const c of candidates) {
      if (c.weight > bestWeight) {
        bestWeight = c.weight
        best = c
      }
    }

    // Octave-wrap safety (keeps melody audible and never shrill)
    let note = best.note
    while (note > MELODY_MAX) note -= 12
    while (note < MELODY_MIN) note += 12

    // Update contour tracking (smoothed)
    const interval = note - this.lastMelodyNote
    this.melodyContour = this.melodyContour * 0.65 + interval * 0.35

    this.lastMelodyNote = note
    this.recentMelodyNotes.push(note)
    if (this.recentMelodyNotes.length > 8) this.recentMelodyNotes.shift()

    this.playMelodyVoice(note, 1.0, time ?? this.ctx!.currentTime)
  }

  // ---- Bass: walking toward chord root (lofi/mystic) or arpeggiated (synthwave) ----

  private playWalkingBass(time?: number) {
    const genre = this.progressionEngine.getGenre()

    // Synthwave uses an arpeggiated bass pattern (driving 80s feel)
    if (genre === 'synthwave') {
      this.playSynthwaveArpeggioBass(time)
      return
    }

    // Pop uses a punchy root-octave bass
    if (genre === 'pop') {
      this.playPopBass(time)
      return
    }

    // Lofi/Mystic/Doom: walking bass
    const target = this.currentChord.bassNote
    let note = this.lastBassNote

    const diff = target - note
    if (Math.abs(diff) > 2) {
      const step = Math.sign(diff) * Math.min(3, Math.abs(diff))
      note += step
    } else {
      const tones = CHORDS[this.currentChord.type]
      const candidates = [target, target + tones[1] - tones[0], target + tones[2] - tones[0]]
        .map(n => Math.max(BASS_MIN, Math.min(BASS_MAX, n)))
        .filter(n => !this.recentBassNotes.includes(n))

      if (candidates.length > 0) {
        note = candidates[Math.floor(Math.random() * candidates.length)]
      } else {
        note = target
      }
    }

    if (Math.random() < 0.15) {
      const scale = SCALES[this.currentChord.scale]
      const passingNote = this.currentChord.bassNote + scale[Math.floor(Math.random() * scale.length)]
      if (passingNote >= BASS_MIN && passingNote <= BASS_MAX && !this.recentBassNotes.includes(passingNote)) {
        note = passingNote
      }
    }

    note = Math.max(BASS_MIN, Math.min(BASS_MAX, note))
    this.recentBassNotes.push(note)
    if (this.recentBassNotes.length > 3) this.recentBassNotes.shift()
    this.lastBassNote = note
    this.playBassVoice(note, 1.0, time ?? this.ctx!.currentTime)
  }

  /** Synthwave arpeggiated bass — cycles through chord tones in octave patterns */
  private synthwaveArpStep = 0
  private playSynthwaveArpeggioBass(time?: number) {
    if (!this.ctx) return
    const t = time ?? this.ctx.currentTime
    const chord = this.currentChord
    const tones = CHORDS[chord.type]

    // Arpeggio pattern: root, 5th, octave, 5th (classic synthwave bass)
    const arpPattern = [0, tones[2] - tones[0], 12, tones[2] - tones[0]]  // root, 5th, octave, 5th
    const arpNote = arpPattern[this.synthwaveArpStep % arpPattern.length]
    const note = chord.bassNote + arpNote

    this.synthwaveArpStep++
    this.lastBassNote = note
    this.playBassVoice(note, 0.9, t)
  }

  /** Pop bass — punchy root-octave pattern */
  private popBassStep = 0
  private playPopBass(time?: number) {
    if (!this.ctx) return
    const t = time ?? this.ctx.currentTime
    const chord = this.currentChord
    const pattern = [0, 0, 12, 0]
    const offset = pattern[this.popBassStep % pattern.length]
    const note = chord.bassNote + offset
    this.popBassStep++
    this.lastBassNote = note
    this.playBassVoice(note, 0.85, t)
  }

  // ---- Synthesis: warm Rhodes-like electric piano voice ----

  private playMelodyVoice(midi: number, volume: number, time?: number) {
    if (!this.ctx || !this.masterGain || !this.reverbBus || !this.delayBus) return
    const t = time ?? this.ctx.currentTime
    const freq = midiToFreq(midi)
    const genre = this.progressionEngine.getGenre()
    const config = GENRE_CONFIGS[genre]

    // Three oscillators for rich timbre — type depends on genre
    const osc1 = this.ctx.createOscillator()
    const osc2 = this.ctx.createOscillator()
    const osc3 = this.ctx.createOscillator()

    osc1.type = config.melodyOscType
    osc2.type = 'sine'
    osc3.type = 'triangle'
    osc1.frequency.value = freq
    osc2.frequency.value = freq * 2
    osc3.frequency.value = freq
    osc2.detune.value = 5
    osc3.detune.value = -5

    const g1 = this.ctx.createGain()
    const g2 = this.ctx.createGain()
    const g3 = this.ctx.createGain()
    g1.gain.value = 0.7
    g2.gain.value = 0.18
    g3.gain.value = 0.4

    // Low-pass filter — softens the top end
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(3500, t)
    filter.frequency.exponentialRampToValueAtTime(1800, t + 1.5) // gentle close
    filter.Q.value = 0.6

    // Amp envelope: fast attack, medium decay, long release
    const amp = this.ctx.createGain()
    const peak = config.melodyVolume * volume
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(peak, t + 0.012)        // 12ms attack
    amp.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.35) // decay to sustain
    amp.gain.exponentialRampToValueAtTime(0.0008, t + 2.0)   // long release

    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3)
    g1.connect(filter); g2.connect(filter); g3.connect(filter)
    filter.connect(amp)
    amp.connect(this.masterGain)
    amp.connect(this.delayBus)
    amp.connect(this.reverbBus)

    osc1.start(t); osc2.start(t); osc3.start(t)
    osc1.stop(t + 2.1); osc2.stop(t + 2.1); osc3.stop(t + 2.1)
  }

  private playBassVoice(midi: number, volume: number, time?: number) {
    if (!this.ctx || !this.masterGain) return
    const t = time ?? this.ctx.currentTime
    const freq = midiToFreq(midi)
    const config = GENRE_CONFIGS[this.progressionEngine.getGenre()]

    const osc1 = this.ctx.createOscillator()
    const osc2 = this.ctx.createOscillator()
    osc1.type = config.bassOscType
    osc2.type = 'triangle'
    osc1.frequency.value = freq
    osc2.frequency.value = freq * 2

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 380
    filter.Q.value = 0.5

    const g2 = this.ctx.createGain()
    g2.gain.value = 0.3

    const amp = this.ctx.createGain()
    const peak = config.bassVolume * volume
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(peak, t + 0.04)
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.7)

    osc1.connect(filter)
    osc2.connect(g2); g2.connect(filter)
    filter.connect(amp)
    amp.connect(this.masterGain)

    osc1.start(t); osc2.start(t)
    osc1.stop(t + 0.8); osc2.stop(t + 0.8)
  }

  private playChordStab(time?: number) {
    if (!this.ctx) return
    const chord = this.currentChord
    const tones = CHORDS[chord.type]
    const config = GENRE_CONFIGS[this.progressionEngine.getGenre()]
    const notesToPlay = tones.slice(0, Math.min(4, tones.length))
    const t = time ?? this.ctx.currentTime
    for (let i = 0; i < notesToPlay.length; i++) {
      const note = chord.root + notesToPlay[i] + 12
      this.scheduleRhodesNote(note, t, 1.4, config.chordStabVolume, true)
    }
  }

  /** Schedule a rhodes-voice note at a specific time. */
  private scheduleRhodesNote(midi: number, time: number, duration: number, volume: number, usePan: boolean) {
    if (!this.ctx || !this.masterGain || !this.reverbBus || !this.delayBus) return
    const freq = midiToFreq(midi)

    const osc1 = this.ctx.createOscillator()
    const osc2 = this.ctx.createOscillator()
    const osc3 = this.ctx.createOscillator()
    osc1.type = 'sine'
    osc2.type = 'sine'
    osc3.type = 'triangle'
    osc1.frequency.value = freq
    osc2.frequency.value = freq * 2
    osc3.frequency.value = freq
    osc2.detune.value = 5
    osc3.detune.value = -5

    const g1 = this.ctx.createGain()
    const g2 = this.ctx.createGain()
    const g3 = this.ctx.createGain()
    g1.gain.value = 0.7
    g2.gain.value = 0.18
    g3.gain.value = 0.4

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 3000
    filter.Q.value = 0.6

    const amp = this.ctx.createGain()
    const peak = volume
    amp.gain.setValueAtTime(0, time)
    amp.gain.linearRampToValueAtTime(peak, time + 0.012)
    amp.gain.exponentialRampToValueAtTime(peak * 0.4, time + 0.3)
    amp.gain.exponentialRampToValueAtTime(0.0008, time + duration)

    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3)
    g1.connect(filter); g2.connect(filter); g3.connect(filter)
    filter.connect(amp)

    if (usePan && this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner()
      panner.pan.value = (Math.random() - 0.5) * 0.4
      amp.connect(panner)
      panner.connect(this.masterGain)
      panner.connect(this.reverbBus)
    } else {
      amp.connect(this.masterGain)
      amp.connect(this.reverbBus)
      amp.connect(this.delayBus)
    }

    osc1.start(time); osc2.start(time); osc3.start(time)
    osc1.stop(time + duration + 0.1)
    osc2.stop(time + duration + 0.1)
    osc3.stop(time + duration + 0.1)
  }

  // ---- Special event sounds (all on the current scale) ----

  /** Bouncy pad: sparkly texture flourish (the multi-jump handles the melody) */
  onBouncy() {
    if (!this.ctx) return
    const chord = this.currentChord
    const tones = CHORDS[chord.type]
    const t = this.ctx.currentTime
    // Quick high sparkly notes on top of the progressing melody
    for (let i = 0; i < 3; i++) {
      const tone = tones[i % tones.length]
      const note = chord.root + tone + 24  // two octaves up — sparkly
      this.scheduleRhodesNote(note, t + i * 0.06, 0.4, VOL.special * 0.35, true)
    }
  }

  /** Boost pad: ascending shimmer run (the multi-jump handles the main melody) */
  onBoost() {
    if (!this.ctx) return
    const chord = this.currentChord
    const scale = SCALES[chord.scale]
    const t = this.ctx.currentTime
    // High ascending shimmer overlay
    for (let i = 0; i < 4; i++) {
      const idx = i % scale.length
      const note = chord.root + scale[idx] + 24  // two octaves up
      this.scheduleRhodesNote(note, t + i * 0.08, 0.5, VOL.special * 0.3, true)
    }
    // Plus a high shimmer note at the end
    this.scheduleRhodesNote(chord.root + 24, t + 0.4, 1.2, VOL.special * 0.35, false)
  }

  /** Fragile platform: soft break sound (1 note progression handles the melody) */
  onBreak() {
    if (!this.ctx) return
    const chord = this.currentChord
    const t = this.ctx.currentTime
    // Soft percussive "thunk" — a quick low note
    this.scheduleRhodesNote(chord.root, t, 0.3, VOL.special * 0.4, false)
  }

  // ---- Reset on dip ----

  onDipReset() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    // Soft descending phrase to signal the reset
    const notes = [this.lastMelodyNote, this.lastMelodyNote - 2, this.lastMelodyNote - 3, this.lastMelodyNote - 5]
      .filter(n => n >= MELODY_MIN)
    for (let i = 0; i < notes.length; i++) {
      this.scheduleRhodesNote(notes[i], t + i * 0.07, 0.5, VOL.special * 0.5, false)
    }
    // Reset state
    this.resetState()
  }

  // ---- Game over: slow descending chord sequence ----

  onGameOver() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    // Play a descending melancholy outro using the current chord
    // and progressively lower inversions
    const chord = this.currentChord
    const tones = CHORDS[chord.type]
    for (let i = 0; i < 4; i++) {
      const chordTime = t + i * 0.5
      // Bass note descending
      this.scheduleBassNote(chord.bassNote - i * 2, chordTime, 0.7)
      // Chord notes descending in inversion
      for (let j = 0; j < Math.min(4, tones.length); j++) {
        const noteOffset = tones[j] - i * 3  // descend over time
        this.scheduleRhodesNote(chord.root + noteOffset, chordTime, 1.0, VOL.chordStab * 1.2, true)
      }
    }
    // Fade out pad
    this.setPadVolume(0)
  }

  private scheduleBassNote(midi: number, time: number, duration: number) {
    if (!this.ctx || !this.masterGain) return
    const freq = midiToFreq(midi)
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400

    const amp = this.ctx.createGain()
    amp.gain.setValueAtTime(0, time)
    amp.gain.linearRampToValueAtTime(VOL.bass * 0.9, time + 0.06)
    amp.gain.exponentialRampToValueAtTime(0.001, time + duration)

    osc.connect(filter)
    filter.connect(amp)
    amp.connect(this.masterGain)
    osc.start(time)
    osc.stop(time + duration + 0.1)
  }

  /** Reset for a new game. */
  reset() {
    this.resetState()
    this.setPadVolume(VOL.pad)
  }

  // ---- Accessors ----

  getLevel() {
    if (this.analyser) {
      const data = new Uint8Array(this.analyser.frequencyBinCount)
      this.analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      this.level = sum / (data.length * 255)
    }
    return this.level
  }

  getJumpCount() { return this.jumpCount }
  getCurrentChord() { return this.currentChord }

  getActiveLayers(): string[] {
    const layers = ['pad', 'bass']
    if (this.jumpCount > 0) layers.push('melody')
    if (this.jumpCount >= 4) layers.push('chord')
    return layers
  }
}
