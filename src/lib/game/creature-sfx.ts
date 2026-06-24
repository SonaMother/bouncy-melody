// Cute Creature SFX Engine — Real sound samples + procedural fallback.
//
// Uses REAL downloaded creature/game sounds (jump, bounce, pop, cat purr)
// from open-source game repos. Falls back to organic formant synthesis
// if samples aren't loaded yet.
//
// Each action has multiple variants drawn via non-repeating shuffle
// so the same sound never plays twice in a row.

import { NonRepeatingQueue } from './tts-engine'

export type SfxAction = 'jump' | 'land' | 'boost' | 'break' | 'bouncy' | 'gameover'

// Real sound samples per action. Multiple variants per action for variety.
// These are loaded from /public/sfx/*.ogg
// - voice_*.ogg: real human character voices (CC0 from Freesound) — "wee", "yay", "aww"
// - jump/bounce/pop: real game SFX (from open-source game repos)
// - cat_purr: real cat purr
const SAMPLE_MAP: Record<SfxAction, string[]> = {
  // Jump — cute character voices (happy "yay/giggle") + game jump sounds
  jump: ['voice_giggle.ogg', 'voice_yay_3.ogg', 'voice_yeah.ogg', 'jump_2.ogg', 'voice_yay_1.ogg'],
  // Land — pop sounds (soft landing impact)
  land: ['pop_1.ogg', 'pop_2.ogg', 'pop_3.ogg'],
  // Boost — excited "weee/wahoo/woohoo" voices (jumping high!)
  boost: ['voice_wee_1.ogg', 'voice_wee_2.ogg', 'voice_wahoo.ogg', 'voice_woohoo.ogg', 'jump_3.ogg'],
  // Break — sad "aww" voices (falling down / combo lost)
  break: ['voice_aww_1.ogg', 'voice_aww_2.ogg', 'pop_2.ogg'],
  // Bouncy — real bounce sounds + happy voice
  bouncy: ['bounce_1.ogg', 'bounce_2.ogg', 'voice_yay_2.ogg', 'jump_1.ogg'],
  // Game over — sad "aww" + cat purr (melancholy)
  gameover: ['voice_aww_1.ogg', 'cat_purr.ogg', 'voice_aww_2.ogg'],
}

// Procedural fallback presets (used while samples load or if loading fails)
interface FallbackParams {
  freq: number
  freqEnd: number
  duration: number
  oscType: OscillatorType
  volume: number
  attack: number
  vibratoRate?: number
  vibratoDepth?: number
  formantFreq?: number
  formantQ?: number
  breathVolume?: number
  breathFilter?: number
}

const FALLBACK_PRESETS: Record<SfxAction, FallbackParams[]> = {
  jump: [
    { freq: 500, freqEnd: 880, duration: 0.14, oscType: 'sine', volume: 0.28, attack: 0.04, vibratoRate: 7, vibratoDepth: 35, formantFreq: 1200, formantQ: 4, breathVolume: 0.06, breathFilter: 2000 },
    { freq: 700, freqEnd: 1100, duration: 0.11, oscType: 'sine', volume: 0.25, attack: 0.05, vibratoRate: 9, vibratoDepth: 30, formantFreq: 1500, formantQ: 5 },
    { freq: 380, freqEnd: 660, duration: 0.16, oscType: 'triangle', volume: 0.30, attack: 0.03, vibratoRate: 12, vibratoDepth: 60, formantFreq: 900, formantQ: 3 },
  ],
  land: [
    { freq: 280, freqEnd: 180, duration: 0.10, oscType: 'sine', volume: 0.22, attack: 0.02, formantFreq: 600, formantQ: 3, breathVolume: 0.10, breathFilter: 800 },
    { freq: 220, freqEnd: 140, duration: 0.09, oscType: 'triangle', volume: 0.20, attack: 0.02, formantFreq: 500, formantQ: 2, breathVolume: 0.15, breathFilter: 600 },
  ],
  boost: [
    { freq: 450, freqEnd: 1300, duration: 0.26, oscType: 'sine', volume: 0.32, attack: 0.04, vibratoRate: 11, vibratoDepth: 55, formantFreq: 1400, formantQ: 4, breathVolume: 0.08, breathFilter: 3000 },
    { freq: 750, freqEnd: 1500, duration: 0.24, oscType: 'triangle', volume: 0.28, attack: 0.03, formantFreq: 1800, formantQ: 4, vibratoRate: 8, vibratoDepth: 30 },
  ],
  break: [
    { freq: 480, freqEnd: 180, duration: 0.22, oscType: 'triangle', volume: 0.23, attack: 0.03, vibratoRate: 7, vibratoDepth: 35, formantFreq: 800, formantQ: 3 },
    { freq: 280, freqEnd: 140, duration: 0.16, oscType: 'square', volume: 0.20, attack: 0.01, formantFreq: 500, formantQ: 2, breathVolume: 0.18, breathFilter: 700 },
  ],
  bouncy: [
    { freq: 320, freqEnd: 750, duration: 0.19, oscType: 'triangle', volume: 0.27, attack: 0.02, vibratoRate: 14, vibratoDepth: 90, formantFreq: 900, formantQ: 3 },
    { freq: 560, freqEnd: 1150, duration: 0.16, oscType: 'sine', volume: 0.25, attack: 0.03, vibratoRate: 11, vibratoDepth: 55, formantFreq: 1200, formantQ: 4 },
  ],
  gameover: [
    { freq: 580, freqEnd: 130, duration: 0.65, oscType: 'triangle', volume: 0.31, attack: 0.05, vibratoRate: 6, vibratoDepth: 30, formantFreq: 700, formantQ: 3, breathVolume: 0.08, breathFilter: 1000 },
  ],
}

export class CreatureSfxEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private queues: Record<SfxAction, NonRepeatingQueue>
  private enabled = true
  private volume = 0.7
  private sampleCache: Map<string, AudioBuffer> = new Map()
  private samplesLoading: Set<string> = new Set()

  constructor() {
    this.queues = {
      jump: new NonRepeatingQueue(SAMPLE_MAP.jump.length),
      land: new NonRepeatingQueue(SAMPLE_MAP.land.length),
      boost: new NonRepeatingQueue(SAMPLE_MAP.boost.length),
      break: new NonRepeatingQueue(SAMPLE_MAP.break.length),
      bouncy: new NonRepeatingQueue(SAMPLE_MAP.bouncy.length),
      gameover: new NonRepeatingQueue(SAMPLE_MAP.gameover.length),
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
      // Preload all samples
      this.preloadSamples()
    } catch (e) {
      console.warn('SFX: Web Audio unavailable', e)
    }
  }

  private async preloadSamples() {
    const allSamples = new Set<string>()
    Object.values(SAMPLE_MAP).forEach(files => files.forEach(f => allSamples.add(f)))
    for (const file of allSamples) {
      this.loadSample(file)
    }
  }

  private async loadSample(file: string) {
    if (this.sampleCache.has(file) || this.samplesLoading.has(file)) return
    if (!this.ctx) return
    this.samplesLoading.add(file)
    try {
      const resp = await fetch(`/sfx/${file}`)
      if (!resp.ok) return
      const arr = await resp.arrayBuffer()
      const buf = await this.ctx.decodeAudioData(arr)
      this.sampleCache.set(file, buf)
    } catch (e) {
      // Sample failed to load — will use procedural fallback
    } finally {
      this.samplesLoading.delete(file)
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

    const files = SAMPLE_MAP[action]
    const idx = this.queues[action].next()
    const file = files[idx % files.length]

    // Try to play real sample
    const buffer = this.sampleCache.get(file)
    if (buffer) {
      this.playSample(buffer)
    } else {
      // Sample not loaded yet — use procedural fallback
      const fallbacks = FALLBACK_PRESETS[action]
      const params = fallbacks[idx % fallbacks.length]
      this.synthesize(params)
    }
  }

  private playSample(buffer: AudioBuffer) {
    if (!this.ctx || !this.masterGain) return
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    // Slight random pitch variation (±5%) so repeats don't sound machine-gun
    src.playbackRate.value = 0.95 + Math.random() * 0.10
    src.connect(this.masterGain)
    src.start()
  }

  private synthesize(params: FallbackParams) {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const pitchVar = 0.92 + Math.random() * 0.16
    const startFreq = params.freq * pitchVar
    const endFreq = params.freqEnd * pitchVar

    const formant = ctx.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.value = (params.formantFreq || 1000) * pitchVar
    formant.Q.value = params.formantQ || 3

    const osc = ctx.createOscillator()
    osc.type = params.oscType
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + params.duration)

    const gain = ctx.createGain()
    const attackTime = params.duration * params.attack
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(params.volume, now + attackTime)
    gain.gain.exponentialRampToValueAtTime(0.001, now + params.duration)

    osc.connect(formant)
    formant.connect(gain)
    gain.connect(this.masterGain!)

    if (params.vibratoRate && params.vibratoDepth) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = params.vibratoRate
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = params.vibratoDepth * pitchVar
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start(now)
      lfo.stop(now + params.duration + 0.05)
    }

    osc.start(now)
    osc.stop(now + params.duration + 0.05)

    if (params.breathVolume && params.breathVolume > 0) {
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * params.duration), ctx.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseData.length; i++) {
        const env = Math.pow(1 - i / noiseData.length, 1.5)
        noiseData[i] = (Math.random() * 2 - 1) * env
      }
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = noiseBuffer
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.value = (params.breathFilter || 1500) * pitchVar
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = params.breathVolume
      noiseSrc.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(this.masterGain!)
      noiseSrc.start(now)
      noiseSrc.stop(now + params.duration)
    }
  }
}
