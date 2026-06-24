// Real sampled piano using smplr (SplendidGrandPiano).
//
// smplr fetches real piano samples from a CDN (smpldsnds.github.io) at runtime.
// No need to bundle audio files — samples are cached after first load.
//
// Uses Web Audio SEND architecture for reverb (same as TTS processor).

import { SplendidGrandPiano } from 'smplr'

export class RealPiano {
  private piano: any = null
  private ctx: AudioContext | null = null
  private reverb: ConvolverNode | null = null
  private reverbReturn: GainNode | null = null
  private masterGain: GainNode | null = null
  private ready = false
  private loading = false
  private enabled = false
  private volume = 0.3

  isEnabled() { return this.enabled }
  isReady() { return this.ready }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (enabled && !this.piano && !this.loading) {
      this.init()
    }
  }

  setVolume(vol: number) {
    this.volume = vol
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05)
    }
  }

  private init() {
    if (this.loading || this.piano) return
    this.loading = true
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new Ctx()

      // Master gain
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.ctx.destination)

      // Reverb send (light — piano sounds beautiful with a touch of space)
      this.reverb = this.ctx.createConvolver()
      this.reverb.buffer = this.generateImpulse(2.0, 2.5)
      this.reverbReturn = this.ctx.createGain()
      this.reverbReturn.gain.value = 0.35
      this.reverb.connect(this.reverbReturn)
      this.reverbReturn.connect(this.masterGain)

      // Load SplendidGrandPiano (real sampled grand piano from CDN)
      this.piano = SplendidGrandPiano(this.ctx)
      // Connect piano output to master + reverb send
      this.piano.output.connect(this.masterGain)
      this.piano.output.connect(this.reverb)

      this.piano.ready.then(() => {
        this.ready = true
        this.loading = false
        console.log('Real piano loaded and ready')
      }).catch((e: any) => {
        console.warn('Piano load failed, falling back to synth', e)
        this.loading = false
      })
    } catch (e) {
      console.warn('Real piano unavailable', e)
      this.loading = false
    }
  }

  private generateImpulse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!
    const sampleRate = ctx.sampleRate
    const length = Math.floor(sampleRate * duration)
    const impulse = ctx.createBuffer(2, length, sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        const t = i / length
        const env = Math.pow(1 - t, decay)
        data[i] = (Math.random() * 2 - 1) * env
      }
    }
    return impulse
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  /** Play a note (MIDI number) with given duration and velocity. */
  playNote(midi: number, duration: number = 0.5, velocity: number = 80) {
    if (!this.enabled || !this.ready || !this.piano) return
    this.resume()
    try {
      this.piano.start({ note: midi, duration, velocity })
    } catch (e) {
      // Note failed — ignore
    }
  }

  /** Stop all playing notes. */
  stopAll() {
    if (this.piano && this.piano.stopAll) {
      try { this.piano.stopAll() } catch {}
    }
  }
}
