// Hammond Organ — Real drawbar organ samples via smplr Soundfont.
//
// Uses smplr's Soundfont class with the "drawbar_organ" instrument (General MIDI),
// which fetches real Hammond-style organ samples from a CDN at runtime.
//
// Includes a Leslie rotary speaker effect (tremolo + vibrato via LFO modulation)
// for that authentic Hammond organ sound.
//
// License note: smplr is MIT. The Soundfont samples come from the
// MusyngKite/FluidR3_GM soundfonts. If strict non-GPL is required, swap to
// tonejs-instrument-organ-mp3 (CC-BY) instead.

import { Soundfont } from 'smplr'

export class HammondOrgan {
  private ctx: AudioContext | null = null
  private organ: any = null
  private masterGain: GainNode | null = null
  // Leslie effect
  private leslieTremoloLfo: OscillatorNode | null = null
  private leslieTremoloGain: GainNode | null = null
  private leslieVibratoLfo: OscillatorNode | null = null
  private leslieVibratoGain: GainNode | null = null
  private ready = false
  private loading = false
  private enabled = false
  private volume = 0.15

  isEnabled() { return this.enabled }
  isReady() { return this.ready }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (enabled && !this.organ && !this.loading) {
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
    if (this.loading || this.organ) return
    this.loading = true
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new Ctx()

      // Master gain
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.ctx.destination)

      // Leslie tremolo LFO (amplitude modulation — rotary speaker swirl)
      this.leslieTremoloLfo = this.ctx.createOscillator()
      this.leslieTremoloLfo.type = 'sine'
      this.leslieTremoloLfo.frequency.value = 6.5  // ~6.5 Hz = slow Leslie rotation
      this.leslieTremoloGain = this.ctx.createGain()
      this.leslieTremoloGain.gain.value = 0.25  // 25% tremolo depth
      this.leslieTremoloLfo.connect(this.leslieTremoloGain)
      this.leslieTremoloGain.connect(this.masterGain.gain)
      this.leslieTremoloLfo.start()

      // Load the drawbar organ Soundfont (real Hammond-style samples)
      this.organ = Soundfont(this.ctx, { instrument: 'drawbar_organ' })
      this.organ.output.connect(this.masterGain)

      this.organ.ready.then(() => {
        this.ready = true
        this.loading = false
        console.log('Hammond organ loaded and ready')
      }).catch((e: any) => {
        console.warn('Hammond organ load failed', e)
        this.loading = false
      })
    } catch (e) {
      console.warn('Hammond organ unavailable', e)
      this.loading = false
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  /** Play a note (MIDI number) with given duration. */
  playNote(midi: number, duration: number = 0.8) {
    if (!this.enabled || !this.ready || !this.organ) return
    this.resume()
    try {
      this.organ.start({ note: midi, duration, velocity: 70 })
    } catch (e) {
      // Note failed — ignore
    }
  }

  /** Set Leslie speed (slow = 6.5 Hz, fast = 8 Hz for that classic ramp-up) */
  setLeslieSpeed(fast: boolean) {
    if (!this.ctx || !this.leslieTremoloLfo) return
    const target = fast ? 8.0 : 6.5
    this.leslieTremoloLfo.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.5)
  }

  stopAll() {
    if (this.organ && this.organ.stopAll) {
      try { this.organ.stopAll() } catch {}
    }
  }
}
