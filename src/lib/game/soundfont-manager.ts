// Soundfont Manager — lets user select different instruments for melody and pad.
//
// Uses smplr's Soundfont class which fetches real sampled instruments
// from the gleitz MIDI soundfont CDN (FluidR3_GM).
// Each instrument loads as a single JS file (~2-3MB) — no rate limiting.
//
// Available instruments include pianos, organs, pads, bells, strings, etc.

import { Soundfont } from 'smplr'

export interface SoundfontOption {
  id: string
  name: string
  category: string
}

// Curated list of instruments that sound good for melody/pad in a cute game
export const SOUNDFONT_OPTIONS: SoundfontOption[] = [
  // Pianos
  { id: 'acoustic_grand_piano', name: 'Grand Piano', category: 'Piano' },
  { id: 'bright_acoustic_piano', name: 'Bright Piano', category: 'Piano' },
  { id: 'electric_grand_piano', name: 'Electric Piano', category: 'Piano' },
  { id: 'honkytonk_piano', name: 'Honky Tonk', category: 'Piano' },
  // Organs
  { id: 'drawbar_organ', name: 'Drawbar Organ', category: 'Organ' },
  { id: 'church_organ', name: 'Church Organ', category: 'Organ' },
  // Bells / Mallets
  { id: 'music_box', name: 'Music Box', category: 'Bells' },
  { id: 'celesta', name: 'Celesta', category: 'Bells' },
  { id: 'glockenspiel', name: 'Glockenspiel', category: 'Bells' },
  { id: 'vibraphone', name: 'Vibraphone', category: 'Bells' },
  { id: 'marimba', name: 'Marimba', category: 'Bells' },
  { id: 'kalimba', name: 'Kalimba', category: 'Bells' },
  { id: 'tubular_bells', name: 'Tubular Bells', category: 'Bells' },
  // Strings
  { id: 'pizzicato_strings', name: 'Pizzicato', category: 'Strings' },
  { id: 'synth_strings_1', name: 'Synth Strings', category: 'Strings' },
  { id: 'choir_aahs', name: 'Choir Aahs', category: 'Strings' },
  { id: 'synth_choir', name: 'Synth Choir', category: 'Strings' },
  // Pads
  { id: 'pad_2_warm', name: 'Warm Pad', category: 'Pad' },
  { id: 'pad_3_polysynth', name: 'Polysynth Pad', category: 'Pad' },
  { id: 'pad_7_halo', name: 'Halo Pad', category: 'Pad' },
  { id: 'pad_8_sweep', name: 'Sweep Pad', category: 'Pad' },
  // Synth Leads
  { id: 'lead_1_square', name: 'Square Lead', category: 'Synth' },
  { id: 'lead_2_sawtooth', name: 'Saw Lead', category: 'Synth' },
  { id: 'lead_6_voice', name: 'Voice Lead', category: 'Synth' },
  // Other
  { id: 'harpsichord', name: 'Harpsichord', category: 'Other' },
  { id: 'clavinet', name: 'Clavinet', category: 'Other' },
  { id: 'accordion', name: 'Accordion', category: 'Other' },
  { id: 'steel_drums', name: 'Steel Drums', category: 'Other' },
  { id: 'koto', name: 'Koto', category: 'Other' },
  { id: 'sitar', name: 'Sitar', category: 'Other' },
  { id: 'banjo', name: 'Banjo', category: 'Other' },
]

export class SoundfontManager {
  private ctx: AudioContext | null = null
  private currentInstrument: any = null
  private currentName: string = ''
  private ready = false
  private loading = false
  private targetGain: GainNode | null = null
  private volume = 1.0

  /** Set the AudioContext and target gain node for output. */
  setContext(ctx: AudioContext, gain: GainNode) {
    this.ctx = ctx
    this.targetGain = gain
  }

  /** Load a new instrument by ID. Returns true on success. */
  async loadInstrument(instrumentId: string): Promise<boolean> {
    if (!this.ctx || !this.targetGain) return false
    if (this.loading) return false
    if (this.currentName === instrumentId && this.ready) return true

    this.loading = true
    this.ready = false

    // Dispose old instrument
    if (this.currentInstrument) {
      try { this.currentInstrument.output.disconnect() } catch {}
      this.currentInstrument = null
    }

    try {
      this.currentInstrument = Soundfont(this.ctx, { instrument: instrumentId })
      this.currentInstrument.output.connect(this.targetGain)
      this.currentInstrument.output.volume = this.volume

      await this.currentInstrument.loaded
      this.currentName = instrumentId
      this.ready = true
      this.loading = false
      console.log(`Soundfont loaded: ${instrumentId}`)
      return true
    } catch (e) {
      console.warn(`Failed to load soundfont ${instrumentId}`, e)
      this.loading = false
      return false
    }
  }

  /** Play a note (MIDI number) with given velocity and duration. */
  playNote(midi: number, velocity: number = 0.7, duration: number = 0.8) {
    if (!this.ready || !this.currentInstrument) return
    try {
      this.currentInstrument.start({ note: midi, velocity: Math.round(velocity * 127), duration })
    } catch {}
  }

  isReady() { return this.ready }
  isLoading() { return this.loading }
  getCurrentInstrument() { return this.currentName }

  setVolume(v: number) {
    this.volume = v
    if (this.currentInstrument) {
      this.currentInstrument.output.volume = v
    }
  }

  dispose() {
    if (this.currentInstrument) {
      try { this.currentInstrument.output.disconnect() } catch {}
      this.currentInstrument = null
    }
    this.ready = false
  }
}
