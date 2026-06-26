// MIDI Keyboard Support — lets user play the game's piano with a MIDI keyboard.
//
// Uses the Web MIDI API (navigator.requestMIDIAccess).
// When a MIDI key is pressed, it plays the game's piano (Tone.js Sampler).
// This is for experimentation and fun — play along with the game's music!

import type { MusicEngine } from './audio'

export class MidiKeyboard {
  private midiAccess: WebMidi.MIDIAccess | null = null
  private enabled = false
  private musicEngine: MusicEngine | null = null

  setMusicEngine(engine: MusicEngine) {
    this.musicEngine = engine
  }

  async init(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported in this browser')
      return false
    }
    try {
      this.midiAccess = await navigator.requestMIDIAccess()
      this.setupInputs()
      this.enabled = true
      console.log('MIDI keyboard support initialized')
      return true
    } catch (e) {
      console.warn('MIDI access denied or failed', e)
      return false
    }
  }

  private setupInputs() {
    if (!this.midiAccess) return
    const handleInput = (input: WebMidi.MIDIInput) => {
      input.onmidimessage = (e) => this.handleMidiMessage(e)
    }
    this.midiAccess.inputs.forEach(handleInput)
    this.midiAccess.onstatechange = () => {
      this.midiAccess?.inputs.forEach(handleInput)
    }
  }

  private handleMidiMessage(e: WebMidi.MIDIMessageEvent) {
    if (!e.data || e.data.length < 3) return
    const [status, note, velocity] = e.data
    const command = status & 0xf0

    // Note On (0x90) with velocity > 0
    if (command === 0x90 && velocity > 0) {
      this.playNote(note, velocity / 127)
    }
    // Note Off (0x80) or Note On with velocity 0
    else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this.releaseNote(note)
    }
  }

  private playNote(midiNote: number, velocity: number) {
    if (!this.musicEngine) return
    // Use the music engine's piano to play the note
    this.musicEngine.playMidiNote(midiNote, velocity)
  }

  private releaseNote(_midiNote: number) {
    // Tone.js Sampler handles note release automatically
    // (we use triggerAttackRelease with a fixed duration)
  }

  isEnabled() { return this.enabled }

  disconnect() {
    if (this.midiAccess) {
      this.midiAccess.inputs.forEach(input => { input.onmidimessage = null })
      this.midiAccess.onstatechange = null
    }
    this.enabled = false
  }
}
