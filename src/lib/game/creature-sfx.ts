// Cute Creature SFX Engine — Organic procedural synthesis.
//
// Instead of simple oscillator beeps, this uses:
//   - Formant filtering (creates vowel-like creature vocalizations)
//   - Pitched noise bursts with envelopes (breathy chirps)
//   - Amplitude modulation (purring/tremolo)
//   - Multi-layer synthesis (body + breath + overtone)
//   - Randomized pitch/timing per call (never sounds machine-gun)
//
// Each action has 4-6 variants drawn via non-repeating shuffle.
// Sounds designed to feel like cute baby animals / small creatures.

import { NonRepeatingQueue } from './tts-engine'

export type SfxAction = 'jump' | 'land' | 'boost' | 'break' | 'bouncy' | 'gameover'

interface SfxParams {
  // Body oscillator (the main voice)
  freq: number
  freqEnd: number
  freqWobble?: number  // cents of random pitch wobble per note
  duration: number
  oscType: OscillatorType
  volume: number
  attack: number       // 0-1 portion of duration
  vibratoRate?: number
  vibratoDepth?: number
  // Formant filter (creates vowel-like creature quality)
  formantFreq?: number  // Hz — mouth resonance
  formantQ?: number     // resonance sharpness
  // Breath layer (noise burst, gives organic texture)
  breathVolume?: number
  breathFilter?: number // Hz lowpass for breath
  // Overtone (second oscillator for richness)
  harmonic2?: number    // multiplier
  harmonic2Vol?: number
  // Pitch glide curve (0 = linear, 1 = exponential)
  glideCurve?: number
}

const SFX_PRESETS: Record<SfxAction, SfxParams[]> = {
  jump: [
    // Cute upward chirp — "wee!" (baby bird-like)
    { freq: 500, freqEnd: 880, duration: 0.14, oscType: 'sine', volume: 0.28, attack: 0.04, vibratoRate: 7, vibratoDepth: 35, formantFreq: 1200, formantQ: 4, breathVolume: 0.06, breathFilter: 2000 },
    // Higher sweet peep
    { freq: 700, freqEnd: 1100, duration: 0.11, oscType: 'sine', volume: 0.25, attack: 0.05, vibratoRate: 9, vibratoDepth: 30, formantFreq: 1500, formantQ: 5, breathVolume: 0.05, breathFilter: 2500 },
    // Bouncy "boing" with wobble
    { freq: 380, freqEnd: 660, duration: 0.16, oscType: 'triangle', volume: 0.30, attack: 0.03, vibratoRate: 12, vibratoDepth: 60, formantFreq: 900, formantQ: 3, freqWobble: 15 },
    // Soft "wheee" — sine with vibrato
    { freq: 600, freqEnd: 920, duration: 0.13, oscType: 'sine', volume: 0.26, attack: 0.06, vibratoRate: 6, vibratoDepth: 45, formantFreq: 1100, formantQ: 4, breathVolume: 0.04 },
    // Pop-cat style blip with harmonic
    { freq: 850, freqEnd: 1050, duration: 0.09, oscType: 'sine', volume: 0.22, attack: 0.02, harmonic2: 1.5, harmonic2Vol: 0.10, formantFreq: 1800, formantQ: 6 },
  ],
  land: [
    // Soft "bup" — landing thud + tiny chirp
    { freq: 280, freqEnd: 180, duration: 0.10, oscType: 'sine', volume: 0.22, attack: 0.02, formantFreq: 600, formantQ: 3, breathVolume: 0.10, breathFilter: 800 },
    // Cute "pff" — soft exhale on landing
    { freq: 220, freqEnd: 140, duration: 0.09, oscType: 'triangle', volume: 0.20, attack: 0.02, formantFreq: 500, formantQ: 2, breathVolume: 0.15, breathFilter: 600 },
    // Pitter-patter — quick double note
    { freq: 380, freqEnd: 320, duration: 0.07, oscType: 'sine', volume: 0.18, attack: 0.01, harmonic2: 2, harmonic2Vol: 0.06, formantFreq: 1000, formantQ: 4 },
    // Bongo-cat percussive
    { freq: 180, freqEnd: 120, duration: 0.11, oscType: 'triangle', volume: 0.24, attack: 0.01, formantFreq: 400, formantQ: 2, breathVolume: 0.12, breathFilter: 500 },
  ],
  boost: [
    // Excited upward "wheee!"
    { freq: 450, freqEnd: 1300, duration: 0.26, oscType: 'sine', volume: 0.32, attack: 0.04, vibratoRate: 11, vibratoDepth: 55, formantFreq: 1400, formantQ: 4, breathVolume: 0.08, breathFilter: 3000, glideCurve: 0.7 },
    // Sparkle shimmer
    { freq: 900, freqEnd: 1700, duration: 0.22, oscType: 'sine', volume: 0.26, attack: 0.05, harmonic2: 1.5, harmonic2Vol: 0.16, formantFreq: 2000, formantQ: 5 },
    // Magical chime
    { freq: 750, freqEnd: 1500, duration: 0.24, oscType: 'triangle', volume: 0.28, attack: 0.03, harmonic2: 2, harmonic2Vol: 0.13, formantFreq: 1800, formantQ: 4, vibratoRate: 8, vibratoDepth: 30 },
    // Joyful squeak
    { freq: 650, freqEnd: 1250, duration: 0.20, oscType: 'sine', volume: 0.27, attack: 0.04, vibratoRate: 13, vibratoDepth: 65, formantFreq: 1300, formantQ: 5, breathVolume: 0.06 },
    // Ascending trill
    { freq: 550, freqEnd: 1400, duration: 0.22, oscType: 'sine', volume: 0.25, attack: 0.05, vibratoRate: 16, vibratoDepth: 80, formantFreq: 1500, formantQ: 4 },
  ],
  break: [
    // Sad descending "aww"
    { freq: 480, freqEnd: 180, duration: 0.22, oscType: 'triangle', volume: 0.23, attack: 0.03, vibratoRate: 7, vibratoDepth: 35, formantFreq: 800, formantQ: 3 },
    // Crack + whimper
    { freq: 280, freqEnd: 140, duration: 0.16, oscType: 'square', volume: 0.20, attack: 0.01, formantFreq: 500, formantQ: 2, breathVolume: 0.18, breathFilter: 700 },
    // Tiny cry
    { freq: 560, freqEnd: 280, duration: 0.19, oscType: 'sine', volume: 0.25, attack: 0.04, vibratoRate: 9, vibratoDepth: 45, formantFreq: 1000, formantQ: 4, breathVolume: 0.05 },
  ],
  bouncy: [
    // Springy boing
    { freq: 320, freqEnd: 750, duration: 0.19, oscType: 'triangle', volume: 0.27, attack: 0.02, vibratoRate: 14, vibratoDepth: 90, formantFreq: 900, formantQ: 3 },
    // High playful bounce
    { freq: 560, freqEnd: 1150, duration: 0.16, oscType: 'sine', volume: 0.25, attack: 0.03, vibratoRate: 11, vibratoDepth: 55, formantFreq: 1200, formantQ: 4 },
    // Pop bounce with harmonic
    { freq: 750, freqEnd: 1350, duration: 0.13, oscType: 'sine', volume: 0.23, attack: 0.02, harmonic2: 1.5, harmonic2Vol: 0.11, formantFreq: 1600, formantQ: 5 },
  ],
  gameover: [
    // Sad descending — "aww, game over"
    { freq: 580, freqEnd: 130, duration: 0.65, oscType: 'triangle', volume: 0.31, attack: 0.05, vibratoRate: 6, vibratoDepth: 30, formantFreq: 700, formantQ: 3, breathVolume: 0.08, breathFilter: 1000, glideCurve: 0.8 },
    // Melancholy whimper
    { freq: 480, freqEnd: 90, duration: 0.75, oscType: 'sine', volume: 0.29, attack: 0.08, vibratoRate: 5, vibratoDepth: 25, formantFreq: 600, formantQ: 3, breathVolume: 0.10, breathFilter: 800, glideCurve: 0.9 },
  ],
}

export class CreatureSfxEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private queues: Record<SfxAction, NonRepeatingQueue>
  private enabled = true
  private volume = 0.7

  constructor() {
    this.queues = {
      jump: new NonRepeatingQueue(SFX_PRESETS.jump.length),
      land: new NonRepeatingQueue(SFX_PRESETS.land.length),
      boost: new NonRepeatingQueue(SFX_PRESETS.boost.length),
      break: new NonRepeatingQueue(SFX_PRESETS.break.length),
      bouncy: new NonRepeatingQueue(SFX_PRESETS.bouncy.length),
      gameover: new NonRepeatingQueue(SFX_PRESETS.gameover.length),
    }
  }

  init() {
    if (this.ctx) return
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new Ctx()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.ctx.destination)
    } catch (e) {
      console.warn('SFX: Web Audio unavailable', e)
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  setVolume(vol: number) {
    this.volume = vol
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05)
    }
  }

  play(action: SfxAction) {
    if (!this.enabled) return
    this.init()
    if (!this.ctx || !this.masterGain) return
    this.resume()

    const presets = SFX_PRESETS[action]
    const idx = this.queues[action].next()
    const params = presets[idx]

    // Strong randomization per call so even the same preset sounds fresh
    const pitchVar = 0.92 + Math.random() * 0.16  // ±8%
    const timeVar = 0.88 + Math.random() * 0.24    // ±12%

    this.synthesize(params, pitchVar, timeVar)
  }

  private synthesize(params: SfxParams, pitchVar: number, timeVar: number) {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const duration = params.duration * timeVar
    const startFreq = params.freq * pitchVar
    const endFreq = params.freqEnd * pitchVar
    const wobble = (params.freqWobble || 0) * (Math.random() - 0.5)

    // ---- Formant filter (creates vowel-like creature quality) ----
    const formant = ctx.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.value = (params.formantFreq || 1000) * pitchVar
    formant.Q.value = params.formantQ || 3

    // ---- Main oscillator ----
    const osc = ctx.createOscillator()
    osc.type = params.oscType
    const glideCurve = params.glideCurve ?? 0
    if (glideCurve > 0.5) {
      // Exponential glide (more natural for creature sounds)
      osc.frequency.setValueAtTime(startFreq + wobble, now)
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq + wobble), now + duration)
    } else {
      // Linear glide
      osc.frequency.setValueAtTime(startFreq + wobble, now)
      osc.frequency.linearRampToValueAtTime(endFreq + wobble, now + duration)
    }

    // Gain envelope (ADSR)
    const gain = ctx.createGain()
    const attackTime = duration * params.attack
    const releaseTime = duration * 0.45
    const sustainLevel = params.volume * 0.75
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(params.volume, now + attackTime)
    gain.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc.connect(formant)
    formant.connect(gain)
    gain.connect(this.masterGain!)

    // Vibrato (LFO on frequency)
    if (params.vibratoRate && params.vibratoDepth) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = params.vibratoRate
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = params.vibratoDepth * pitchVar
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start(now)
      lfo.stop(now + duration + 0.05)
    }

    osc.start(now)
    osc.stop(now + duration + 0.05)

    // ---- Overtone (2nd oscillator for richness) ----
    if (params.harmonic2 && params.harmonic2Vol) {
      const osc2 = ctx.createOscillator()
      osc2.type = params.oscType
      osc2.frequency.setValueAtTime(startFreq * params.harmonic2, now)
      osc2.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq * params.harmonic2), now + duration)
      const gain2 = ctx.createGain()
      gain2.gain.setValueAtTime(0, now)
      gain2.gain.linearRampToValueAtTime(params.harmonic2Vol, now + attackTime)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration)
      const formant2 = ctx.createBiquadFilter()
      formant2.type = 'bandpass'
      formant2.frequency.value = (params.formantFreq || 1000) * 1.3 * pitchVar
      formant2.Q.value = params.formantQ || 3
      osc2.connect(formant2)
      formant2.connect(gain2)
      gain2.connect(this.masterGain!)
      osc2.start(now)
      osc2.stop(now + duration + 0.05)
    }

    // ---- Breath layer (filtered noise — organic texture) ----
    if (params.breathVolume && params.breathVolume > 0) {
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseData.length; i++) {
        // Pink-ish noise with decay envelope
        const env = Math.pow(1 - i / noiseData.length, 1.5)
        noiseData[i] = (Math.random() * 2 - 1) * env
      }
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuffer
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.value = (params.breathFilter || 1500) * pitchVar
      noiseFilter.Q.value = 1
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = params.breathVolume
      // Breath has its own little attack
      noiseGain.gain.setValueAtTime(0, now)
      noiseGain.gain.linearRampToValueAtTime(params.breathVolume, now + attackTime * 0.5)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8)
      noiseSrc.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(this.masterGain!)
      noiseSrc.start(now)
      noiseSrc.stop(now + duration)
    }
  }
}
