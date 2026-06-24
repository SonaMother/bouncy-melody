// Cute Creature SFX Engine — Procedurally synthesized creature sounds.
//
// Instead of shipping audio files (which are hard to source, license, and
// bloat the bundle), we synthesize cute creature sounds with Web Audio API.
// This gives us:
//   - Endless variety (slight randomization per call)
//   - Tiny bundle size (no audio files)
//   - Multiple sound sets per action (jump, land, boost, break, etc.)
//   - Non-repeating shuffle per action (no back-to-back repeats)
//
// Sound design inspired by:
//   - Cute baby animal chirps (pitched-up sine + triangle)
//   - Bouncy cartoon sounds (frequency sweeps)
//   - Soft purrs (low-frequency vibrato)
//   - Pop cat / bongo cat meme vibes (short percussive blips)

import { NonRepeatingQueue } from './tts-engine'

export type SfxAction = 'jump' | 'land' | 'boost' | 'break' | 'bouncy' | 'gameover'

interface SfxParams {
  freq: number          // base frequency
  freqEnd: number       // ending frequency (for sweeps)
  duration: number      // seconds
  oscType: OscillatorType
  volume: number
  attack: number        // 0-1 portion of duration for attack
  vibratoRate?: number  // Hz
  vibratoDepth?: number // cents
  harmonic2?: number    // multiplier for 2nd oscillator (0 = none)
  harmonic2Vol?: number // volume of 2nd oscillator
  noise?: number        // 0-1 mix of filtered noise (for texture)
}

// Each action has multiple sound variants. We pick from them using a
// non-repeating shuffle so the same variant never plays twice in a row.
const SFX_PRESETS: Record<SfxAction, SfxParams[]> = {
  jump: [
    // Cute upward chirp — like a baby bird "peep!"
    { freq: 600, freqEnd: 900, duration: 0.12, oscType: 'sine', volume: 0.25, attack: 0.05, vibratoRate: 8, vibratoDepth: 30 },
    // Higher sweet chirp
    { freq: 800, freqEnd: 1200, duration: 0.10, oscType: 'sine', volume: 0.22, attack: 0.05, vibratoRate: 10, vibratoDepth: 25 },
    // Bouncy "boing" — triangle sweep
    { freq: 400, freqEnd: 700, duration: 0.15, oscType: 'triangle', volume: 0.28, attack: 0.04 },
    // Soft "wheee" — sine with vibrato
    { freq: 700, freqEnd: 1000, duration: 0.14, oscType: 'sine', volume: 0.24, attack: 0.06, vibratoRate: 6, vibratoDepth: 40 },
    // Pop cat style — short blip
    { freq: 900, freqEnd: 1100, duration: 0.08, oscType: 'square', volume: 0.18, attack: 0.02, harmonic2: 1.5, harmonic2Vol: 0.08 },
  ],
  land: [
    // Soft thud + chirp — landing on platform
    { freq: 300, freqEnd: 200, duration: 0.10, oscType: 'sine', volume: 0.20, attack: 0.02, noise: 0.15 },
    // Cute "bup" — short low blip
    { freq: 250, freqEnd: 180, duration: 0.08, oscType: 'triangle', volume: 0.22, attack: 0.02 },
    // Pitter-patter — two quick notes
    { freq: 400, freqEnd: 350, duration: 0.06, oscType: 'sine', volume: 0.18, attack: 0.01, harmonic2: 2, harmonic2Vol: 0.06 },
    // Bongo cat style — percussive
    { freq: 200, freqEnd: 150, duration: 0.10, oscType: 'triangle', volume: 0.24, attack: 0.01, noise: 0.2 },
  ],
  boost: [
    // Excited upward sweep — "wheee!"
    { freq: 500, freqEnd: 1400, duration: 0.25, oscType: 'sine', volume: 0.30, attack: 0.04, vibratoRate: 12, vibratoDepth: 50 },
    // Sparkle — high shimmer
    { freq: 1000, freqEnd: 1800, duration: 0.20, oscType: 'sine', volume: 0.25, attack: 0.05, harmonic2: 1.5, harmonic2Vol: 0.15 },
    // Magical chime
    { freq: 800, freqEnd: 1600, duration: 0.22, oscType: 'triangle', volume: 0.28, attack: 0.03, harmonic2: 2, harmonic2Vol: 0.12 },
    // Joyful squeak
    { freq: 700, freqEnd: 1300, duration: 0.18, oscType: 'sine', volume: 0.26, attack: 0.04, vibratoRate: 14, vibratoDepth: 60 },
  ],
  break: [
    // Sad descending — "aww"
    { freq: 500, freqEnd: 200, duration: 0.20, oscType: 'triangle', volume: 0.22, attack: 0.03 },
    // Crack + chirp
    { freq: 300, freqEnd: 150, duration: 0.15, oscType: 'square', volume: 0.20, attack: 0.01, noise: 0.3 },
    // Tiny cry
    { freq: 600, freqEnd: 300, duration: 0.18, oscType: 'sine', volume: 0.24, attack: 0.04, vibratoRate: 8, vibratoDepth: 40 },
  ],
  bouncy: [
    // Springy boing
    { freq: 350, freqEnd: 800, duration: 0.18, oscType: 'triangle', volume: 0.26, attack: 0.02, vibratoRate: 15, vibratoDepth: 80 },
    // High bounce
    { freq: 600, freqEnd: 1200, duration: 0.15, oscType: 'sine', volume: 0.24, attack: 0.03, vibratoRate: 12, vibratoDepth: 50 },
    // Playful pop
    { freq: 800, freqEnd: 1400, duration: 0.12, oscType: 'sine', volume: 0.22, attack: 0.02, harmonic2: 1.5, harmonic2Vol: 0.10 },
  ],
  gameover: [
    // Sad descending — "aww, game over"
    { freq: 600, freqEnd: 150, duration: 0.60, oscType: 'triangle', volume: 0.30, attack: 0.05, vibratoRate: 6, vibratoDepth: 30 },
    // Melancholy
    { freq: 500, freqEnd: 100, duration: 0.70, oscType: 'sine', volume: 0.28, attack: 0.08, vibratoRate: 4, vibratoDepth: 25 },
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

    // Slight randomization for variety (so even same preset sounds fresh)
    const pitchVar = 0.95 + Math.random() * 0.1  // ±5%
    const timeVar = 0.9 + Math.random() * 0.2     // ±10%

    this.synthesize(params, pitchVar, timeVar)
  }

  private synthesize(params: SfxParams, pitchVar: number, timeVar: number) {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const duration = params.duration * timeVar
    const startFreq = params.freq * pitchVar
    const endFreq = params.freqEnd * pitchVar

    // Main oscillator
    const osc = ctx.createOscillator()
    osc.type = params.oscType
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration)

    // Gain envelope (ADSR-ish)
    const gain = ctx.createGain()
    const attackTime = duration * params.attack
    const releaseTime = duration * 0.4
    const sustainLevel = params.volume * 0.7
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(params.volume, now + attackTime)
    gain.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc.connect(gain)
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
      lfo.stop(now + duration)
    }

    osc.start(now)
    osc.stop(now + duration + 0.05)

    // Harmonic (2nd oscillator for richness)
    if (params.harmonic2 && params.harmonic2Vol) {
      const osc2 = ctx.createOscillator()
      osc2.type = params.oscType
      osc2.frequency.setValueAtTime(startFreq * params.harmonic2, now)
      osc2.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq * params.harmonic2), now + duration)
      const gain2 = ctx.createGain()
      gain2.gain.setValueAtTime(0, now)
      gain2.gain.linearRampToValueAtTime(params.harmonic2Vol, now + attackTime)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc2.connect(gain2)
      gain2.connect(this.masterGain!)
      osc2.start(now)
      osc2.stop(now + duration + 0.05)
    }

    // Noise component (for texture — land/break sounds)
    if (params.noise && params.noise > 0) {
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseData.length, 2)
      }
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuffer
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.value = startFreq * 2
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = params.volume * params.noise
      noiseSrc.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(this.masterGain!)
      noiseSrc.start(now)
      noiseSrc.stop(now + duration)
    }
  }
}
