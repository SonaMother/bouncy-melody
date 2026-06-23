// Melody Engine v2 — Scale-aware, style-matched melody generation.
//
// Instead of pure weighted-random voice-leading, this engine uses
// genre-specific melodic patterns and motifs to create melodies that
// sound intentional and stylistic rather than random.
//
// Each genre has its own melodic profile:
// - Lofi:      smooth steps, occasional thirds, relaxed contour
// - Mystic:    whole-tone runs, wide leaps, ambiguous direction
// - Synthwave: catchy motifs, repeating patterns with variation
// - Pop:       singable phrases, step-wise motion, strong beat emphasis
// - Doom:      slow descending lines, minor 2nd tensions, low register

import { CHORDS, SCALES, type ChordDef } from './music-theory'

export type MelodyStyle = 'lofi' | 'mystic' | 'synthwave' | 'pop' | 'doom'

interface MelodyProfile {
  // Probability of using a chord tone vs scale tone (0=all scale, 1=all chord)
  chordToneBias: number
  // Preferred intervals (in semitones) — weighted
  preferredSteps: { interval: number; weight: number }[]
  // Maximum leap allowed
  maxLeap: number
  // Contour tendency: -1 = prefer descending, 0 = neutral, 1 = prefer ascending
  contourBias: number
  // Rest probability (chance of repeating last note)
  restProbability: number
  // Motif length — how many notes before generating a new motif
  motifLength: number
}

const PROFILES: Record<MelodyStyle, MelodyProfile> = {
  lofi: {
    chordToneBias: 0.65,
    preferredSteps: [
      { interval: 1, weight: 3 },   // semitone (smooth)
      { interval: 2, weight: 4 },   // whole tone
      { interval: 3, weight: 3 },   // minor third
      { interval: 4, weight: 2 },   // major third
      { interval: 5, weight: 2 },   // fourth
      { interval: 7, weight: 1.5 }, // fifth
    ],
    maxLeap: 9,
    contourBias: 0,
    restProbability: 0.15,
    motifLength: 4,
  },
  mystic: {
    chordToneBias: 0.45,
    preferredSteps: [
      { interval: 2, weight: 3 },   // whole tone (whole-tone scale feel)
      { interval: 4, weight: 2 },   // major third
      { interval: 6, weight: 2.5 }, // tritone (mysterious)
      { interval: 8, weight: 2 },   // minor sixth (wide leap)
      { interval: 1, weight: 1.5 }, // semitone (tension)
      { interval: 3, weight: 1.5 }, // minor third
    ],
    maxLeap: 12,
    contourBias: -0.2,  // slightly descending
    restProbability: 0.2,
    motifLength: 3,
  },
  synthwave: {
    chordToneBias: 0.75,
    preferredSteps: [
      { interval: 2, weight: 3 },   // whole step
      { interval: 4, weight: 3 },   // major third
      { interval: 3, weight: 2.5 }, // minor third
      { interval: 5, weight: 2 },   // fourth
      { interval: 7, weight: 2.5 }, // fifth (catchy jumps)
      { interval: 12, weight: 1.5 },// octave (dramatic)
    ],
    maxLeap: 12,
    contourBias: 0.15,  // slightly ascending (uplifting)
    restProbability: 0.1,
    motifLength: 4,
  },
  pop: {
    chordToneBias: 0.7,
    preferredSteps: [
      { interval: 2, weight: 4 },   // whole step (singable)
      { interval: 1, weight: 2 },   // semitone
      { interval: 3, weight: 3 },   // minor third
      { interval: 4, weight: 3 },   // major third
      { interval: 5, weight: 2 },   // fourth
      { interval: 7, weight: 1.5 }, // fifth
    ],
    maxLeap: 7,
    contourBias: 0.1,  // slightly ascending
    restProbability: 0.1,
    motifLength: 4,
  },
  doom: {
    chordToneBias: 0.8,
    preferredSteps: [
      { interval: 1, weight: 4 },   // semitone (dissonant, tense)
      { interval: 2, weight: 2 },   // whole tone
      { interval: 3, weight: 3 },   // minor third (dark)
      { interval: 6, weight: 2.5 }, // tritone (devil's interval)
      { interval: 7, weight: 1.5 }, // fifth
      { interval: 8, weight: 2 },   // minor sixth (ominous)
    ],
    maxLeap: 8,
    contourBias: -0.4,  // strongly descending (heavy, dragging feel)
    restProbability: 0.25,
    motifLength: 3,
  },
}

export class MelodyEngineV2 {
  private style: MelodyStyle = 'lofi'
  private lastNote = 72  // C5
  private motifIndex = 0
  private motif: number[] = []  // current motif pattern (intervals from start)
  private motifStart = 72
  private recentNotes: number[] = []
  private contourSum = 0  // running contour for balance

  setStyle(style: MelodyStyle) {
    this.style = style
    this.motif = []
    this.motifIndex = 0
  }

  reset() {
    this.lastNote = 72
    this.motif = []
    this.motifIndex = 0
    this.recentNotes = []
    this.contourSum = 0
  }

  /**
   * Generate the next melody note based on the current chord and style.
   * Returns a MIDI note number.
   */
  nextNote(chord: ChordDef, minNote: number, maxNote: number): number {
    const profile = PROFILES[this.style]

    // Generate a new motif if needed
    if (this.motifIndex >= this.motif.length || this.motif.length === 0) {
      this.generateMotif(chord, profile, minNote, maxNote)
      this.motifIndex = 0
      this.motifStart = this.lastNote
    }

    // Play the motif note
    const interval = this.motif[this.motifIndex]
    this.motifIndex++

    let note = this.motifStart + interval

    // Octave wrap
    while (note > maxNote) note -= 12
    while (note < minNote) note += 12

    // Track contour
    const change = note - this.lastNote
    this.contourSum = this.contourSum * 0.7 + change * 0.3

    // Track recent
    this.recentNotes.push(note)
    if (this.recentNotes.length > 6) this.recentNotes.shift()

    this.lastNote = note
    return note
  }

  private generateMotif(chord: ChordDef, profile: MelodyProfile, minNote: number, maxNote: number) {
    const length = profile.motifLength
    this.motif = [0]  // start at current note (interval 0)

    let currentInterval = 0
    const chordTones = CHORDS[chord.type]
    const scale = SCALES[chord.scale]
    const rootPc = chord.root % 12

    for (let i = 1; i < length; i++) {
      // Rest (repeat last note)
      if (Math.random() < profile.restProbability) {
        this.motif.push(currentInterval)
        continue
      }

      // Decide direction based on contour bias
      let direction: number
      if (this.contourSum > 5) direction = -1  // been going up, go down
      else if (this.contourSum < -5) direction = 1  // been going down, go up
      else {
        // Use profile's contour bias
        const r = Math.random()
        if (r < (1 + profile.contourBias) / 2) direction = 1
        else direction = -1
      }

      // Pick a step from the preferred steps
      const step = this.pickWeighted(profile.preferredSteps)
      const actualStep = step * direction

      // Check if the resulting note is a chord tone or scale tone
      const targetInterval = currentInterval + actualStep
      const targetPc = (rootPc + targetInterval + 1200) % 12

      const isChordTone = chordTones.some(t => (rootPc + t) % 12 === targetPc)
      const isScaleTone = scale.some(s => (rootPc + s) % 12 === targetPc)

      // Accept if it matches the bias
      if (isChordTone && Math.random() < profile.chordToneBias) {
        currentInterval = targetInterval
      } else if (isScaleTone) {
        currentInterval = targetInterval
      } else if (isChordTone) {
        // Chord tone but bias said scale — accept anyway sometimes
        if (Math.random() < 0.3) currentInterval = targetInterval
        else currentInterval += direction * 2  // fallback to a step
      } else {
        // Not in scale — use nearest scale tone
        currentInterval += direction * 2
      }

      // Clamp to max leap
      const leap = Math.abs(currentInterval - this.motif[i - 1])
      if (leap > profile.maxLeap) {
        currentInterval = this.motif[i - 1] + direction * Math.min(profile.maxLeap, step)
      }

      this.motif.push(currentInterval)
    }
  }

  private pickWeighted(items: { interval: number; weight: number }[]): number {
    const total = items.reduce((s, i) => s + i.weight, 0)
    let r = Math.random() * total
    for (const item of items) {
      r -= item.weight
      if (r <= 0) return item.interval
    }
    return items[0].interval
  }
}
