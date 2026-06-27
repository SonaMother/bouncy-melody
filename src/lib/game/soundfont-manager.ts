// Soundfont Manager — per-channel instrument selection.
//
// Uses smplr's Soundfont class which fetches real sampled instruments
// from the gleitz MIDI soundfont CDN (FluidR3_GM).
//
// Supports 3 independent channels: melody, bass, pad.
// Each channel can have a different instrument.
// MIDI keyboard plays the "active" channel (last selected).

import { Soundfont } from 'smplr'

export interface SoundfontOption {
  id: string
  name: string
  category: string
}

export const SOUNDFONT_OPTIONS: SoundfontOption[] = [
  { id: 'acoustic_grand_piano', name: 'Grand Piano', category: 'Piano' },
  { id: 'bright_acoustic_piano', name: 'Bright Piano', category: 'Piano' },
  { id: 'electric_grand_piano', name: 'Electric Piano', category: 'Piano' },
  { id: 'honkytonk_piano', name: 'Honky Tonk', category: 'Piano' },
  { id: 'drawbar_organ', name: 'Drawbar Organ', category: 'Organ' },
  { id: 'church_organ', name: 'Church Organ', category: 'Organ' },
  { id: 'music_box', name: 'Music Box', category: 'Bells' },
  { id: 'celesta', name: 'Celesta', category: 'Bells' },
  { id: 'glockenspiel', name: 'Glockenspiel', category: 'Bells' },
  { id: 'vibraphone', name: 'Vibraphone', category: 'Bells' },
  { id: 'marimba', name: 'Marimba', category: 'Bells' },
  { id: 'kalimba', name: 'Kalimba', category: 'Bells' },
  { id: 'tubular_bells', name: 'Tubular Bells', category: 'Bells' },
  { id: 'pizzicato_strings', name: 'Pizzicato', category: 'Strings' },
  { id: 'synth_strings_1', name: 'Synth Strings', category: 'Strings' },
  { id: 'choir_aahs', name: 'Choir Aahs', category: 'Strings' },
  { id: 'synth_choir', name: 'Synth Choir', category: 'Strings' },
  { id: 'pad_2_warm', name: 'Warm Pad', category: 'Pad' },
  { id: 'pad_3_polysynth', name: 'Polysynth Pad', category: 'Pad' },
  { id: 'pad_7_halo', name: 'Halo Pad', category: 'Pad' },
  { id: 'pad_8_sweep', name: 'Sweep Pad', category: 'Pad' },
  { id: 'lead_1_square', name: 'Square Lead', category: 'Synth' },
  { id: 'lead_2_sawtooth', name: 'Saw Lead', category: 'Synth' },
  { id: 'lead_6_voice', name: 'Voice Lead', category: 'Synth' },
  { id: 'harpsichord', name: 'Harpsichord', category: 'Other' },
  { id: 'clavinet', name: 'Clavinet', category: 'Other' },
  { id: 'accordion', name: 'Accordion', category: 'Other' },
  { id: 'steel_drums', name: 'Steel Drums', category: 'Other' },
  { id: 'koto', name: 'Koto', category: 'Other' },
  { id: 'sitar', name: 'Sitar', category: 'Other' },
  { id: 'banjo', name: 'Banjo', category: 'Other' },
  { id: 'electric_bass_finger', name: 'Electric Bass', category: 'Bass' },
  { id: 'synth_bass_1', name: 'Synth Bass', category: 'Bass' },
]

export type SoundfontChannel = 'melody' | 'bass' | 'pad'

interface ChannelState {
  instrument: any
  name: string
  ready: boolean
  loading: boolean
  gain: GainNode | null
}

export class SoundfontManager {
  private ctx: AudioContext | null = null
  private channels: Record<SoundfontChannel, ChannelState> = {
    melody: { instrument: null, name: '', ready: false, loading: false, gain: null },
    bass: { instrument: null, name: '', ready: false, loading: false, gain: null },
    pad: { instrument: null, name: '', ready: false, loading: false, gain: null },
  }
  private activeChannel: SoundfontChannel = 'melody'  // for MIDI testing

  setContext(ctx: AudioContext, melodyGain: GainNode, bassGain: GainNode, padGain: GainNode) {
    this.ctx = ctx
    this.channels.melody.gain = melodyGain
    this.channels.bass.gain = bassGain
    this.channels.pad.gain = padGain
  }

  /** Set which channel MIDI keyboard controls (for testing). */
  setActiveChannel(ch: SoundfontChannel) {
    this.activeChannel = ch
  }
  getActiveChannel() { return this.activeChannel }

  /** Load an instrument for a specific channel. */
  async loadInstrument(channel: SoundfontChannel, instrumentId: string): Promise<boolean> {
    if (!this.ctx) return false
    const ch = this.channels[channel]
    if (!ch.gain) {
      console.warn(`Soundfont: channel ${channel} has no gain node — setContext not called?`)
      return false
    }
    if (ch.loading) return false
    if (ch.name === instrumentId && ch.ready) return true

    ch.loading = true
    ch.ready = false

    // Dispose old instrument
    if (ch.instrument) {
      try { ch.instrument.output.disconnect() } catch {}
      ch.instrument = null
    }

    if (instrumentId === '') {
      ch.name = ''
      ch.loading = false
      return true
    }

    try {
      console.log(`Soundfont: loading ${instrumentId} for ${channel}, connecting to gain: ${ch.gain ? 'yes' : 'no'}`)
      ch.instrument = Soundfont(this.ctx, { instrument: instrumentId })
      ch.instrument.output.connect(ch.gain)
      await ch.instrument.loaded
      ch.name = instrumentId
      ch.ready = true
      ch.loading = false
      console.log(`Soundfont loaded: ${instrumentId} for ${channel}`)
      return true
    } catch (e) {
      console.warn(`Failed to load soundfont ${instrumentId} for ${channel}:`, e)
      ch.loading = false
      return false
    }
  }

  /** Play a note on a specific channel. */
  playNote(channel: SoundfontChannel, midi: number, velocity: number = 0.7, duration: number = 0.8) {
    const ch = this.channels[channel]
    if (!ch.ready || !ch.instrument) return false
    try {
      ch.instrument.start({ note: midi, velocity: Math.round(velocity * 127), duration })
      return true
    } catch { return false }
  }

  /** Play a note on the active channel (for MIDI keyboard). */
  playNoteOnActive(midi: number, velocity: number = 0.7) {
    this.playNote(this.activeChannel, midi, velocity, 0.8)
  }

  isChannelReady(channel: SoundfontChannel) { return this.channels[channel].ready }
  isChannelLoading(channel: SoundfontChannel) { return this.channels[channel].loading }
  getChannelInstrument(channel: SoundfontChannel) { return this.channels[channel].name }

  dispose() {
    for (const ch of Object.values(this.channels)) {
      if (ch.instrument) {
        try { ch.instrument.output.disconnect() } catch {}
        ch.instrument = null
      }
      ch.ready = false
    }
  }
}
