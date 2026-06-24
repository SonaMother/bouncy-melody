// Music theory module: scales, jazz chords, progressions, and multi-genre support.
//
// GENRES:
// - Lofi:      warm rhodes, jazzy progressions (the original beloved sound)
// - Mystic:    surreal/ethereal, whole-tone + diminished, dark and mysterious
// - Synthwave: retro 80s, bright major, energetic arpeggios

// ---- Scales (intervals from root) ----
export const SCALES = {
  major:         [0, 2, 4, 5, 7, 9, 11],
  naturalMinor:  [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:  [0, 2, 3, 5, 7, 9, 11],
  dorian:        [0, 2, 3, 5, 7, 9, 10],
  phrygian:      [0, 1, 3, 5, 7, 8, 10],
  lydian:        [0, 2, 4, 6, 7, 9, 11],
  mixolydian:    [0, 2, 4, 5, 7, 9, 10],
  aeolian:       [0, 2, 3, 5, 7, 8, 10],
  locrian:       [0, 1, 3, 5, 6, 8, 10],
  wholeTone:     [0, 2, 4, 6, 8, 10],
  pentatonic:    [0, 2, 4, 7, 9],
} as const

export type ScaleName = keyof typeof SCALES

// ---- Chord types ----
export const CHORDS = {
  maj:     [0, 4, 7],
  min:     [0, 3, 7],
  dim:     [0, 3, 6],
  aug:     [0, 4, 8],
  sus2:    [0, 2, 7],
  sus4:    [0, 5, 7],
  maj7:    [0, 4, 7, 11],
  min7:    [0, 3, 7, 10],
  dom7:    [0, 4, 7, 10],
  maj9:    [0, 4, 7, 11, 14],
  min9:    [0, 3, 7, 10, 14],
  dom9:    [0, 4, 7, 10, 14],
  min7b5:  [0, 3, 6, 10],
  dim7:    [0, 3, 6, 9],
  min11:   [0, 3, 7, 10, 14, 17],
  maj11:   [0, 4, 7, 11, 14, 17],
  min6:    [0, 3, 7, 9],
  maj6:    [0, 4, 7, 9],
  min6add9:[0, 3, 7, 9, 14],
  maj7b5:  [0, 4, 6, 11],
  minMaj7: [0, 3, 7, 11],
  augMaj7: [0, 4, 8, 11],
} as const

export type ChordType = keyof typeof CHORDS

// ---- Chord definition ----
export interface ChordDef {
  root: number
  type: ChordType
  bassNote: number
  scale: ScaleName
}

// ====================================================================
// GENRE 1: LOFI (the original beloved progressions — restored exactly)
// ====================================================================

const LOFI_PROG_C: ChordDef[] = [
  { root: 60, type: 'min9',   bassNote: 36, scale: 'dorian' },
  { root: 65, type: 'min9',   bassNote: 41, scale: 'naturalMinor' },
  { root: 67, type: 'min9',   bassNote: 43, scale: 'dorian' },
  { root: 60, type: 'min9',   bassNote: 36, scale: 'naturalMinor' },
]

const LOFI_PROG_JAZZ: ChordDef[] = [
  { root: 62, type: 'min7b5', bassNote: 38, scale: 'naturalMinor' },
  { root: 67, type: 'dom9',   bassNote: 43, scale: 'mixolydian' },
  { root: 60, type: 'min9',   bassNote: 36, scale: 'dorian' },
  { root: 60, type: 'min9',   bassNote: 36, scale: 'naturalMinor' },
]

const LOFI_PROG_MAJOR: ChordDef[] = [
  { root: 65, type: 'maj9',   bassNote: 41, scale: 'lydian' },
  { root: 64, type: 'min9',   bassNote: 40, scale: 'dorian' },
  { root: 62, type: 'min9',   bassNote: 38, scale: 'dorian' },
  { root: 60, type: 'maj9',   bassNote: 36, scale: 'major' },
]

const LOFI_PROG_NEOSOUL: ChordDef[] = [
  { root: 68, type: 'maj9',   bassNote: 44, scale: 'lydian' },
  { root: 67, type: 'min9',   bassNote: 43, scale: 'dorian' },
  { root: 60, type: 'min9',   bassNote: 36, scale: 'naturalMinor' },
  { root: 65, type: 'min9',   bassNote: 41, scale: 'dorian' },
]

const LOFI_PROG_DORIAN: ChordDef[] = [
  { root: 62, type: 'min9',   bassNote: 38, scale: 'dorian' },
  { root: 69, type: 'min7',   bassNote: 45, scale: 'dorian' },
  { root: 62, type: 'min9',   bassNote: 38, scale: 'dorian' },
  { root: 67, type: 'maj6',   bassNote: 43, scale: 'major' },
]

// ====================================================================
// GENRE 2: MYSTIC (surreal, ethereal, mysterious)
// Uses whole-tone, diminished, and altered chords for a dreamy
// otherworldly feel. Slower harmonic rhythm, darker voicings.
// ====================================================================

const MYSTIC_PROG_1: ChordDef[] = [
  { root: 60, type: 'minMaj7', bassNote: 36, scale: 'harmonicMinor' },  // CmMaj7 — dark, tense
  { root: 63, type: 'dim7',    bassNote: 39, scale: 'wholeTone' },       // D#dim7 — eerie
  { root: 65, type: 'min6',    bassNote: 41, scale: 'melodicMinor' },    // Fm6 — melancholy
  { root: 62, type: 'augMaj7', bassNote: 38, scale: 'wholeTone' },       // DaugMaj7 — surreal
]

const MYSTIC_PROG_2: ChordDef[] = [
  { root: 59, type: 'min9',    bassNote: 35, scale: 'aeolian' },         // Bm9 — brooding
  { root: 64, type: 'min7b5',  bassNote: 40, scale: 'locrian' },         // C#m7b5 — unstable
  { root: 67, type: 'dim7',    bassNote: 43, scale: 'wholeTone' },       // Gdim7 — sinister
  { root: 57, type: 'maj7b5',  bassNote: 33, scale: 'lydian' },          // Amaj7b5 — alien
]

const MYSTIC_PROG_3: ChordDef[] = [
  { root: 61, type: 'minMaj7', bassNote: 37, scale: 'harmonicMinor' },  // C#mMaj7
  { root: 66, type: 'augMaj7', bassNote: 42, scale: 'wholeTone' },       // F#augMaj7
  { root: 63, type: 'min6',    bassNote: 39, scale: 'melodicMinor' },    // D#m6
  { root: 58, type: 'dim7',    bassNote: 34, scale: 'wholeTone' },       // A#dim7
]

// ====================================================================
// GENRE 3: SYNTHWAVE (authentic 80s retro)
// Classic i-VI-III-VII minor progressions with driving arpeggiated bass.
// Think Drive, Stranger Things, Kavinsky, The Midnight.
// ====================================================================

// Am - F - C - G (i - VI - III - VII in A minor) — THE classic synthwave progression
const SYNTH_PROG_1: ChordDef[] = [
  { root: 57, type: 'min9',   bassNote: 33, scale: 'aeolian' },   // Am9 (i)
  { root: 53, type: 'maj9',   bassNote: 29, scale: 'lydian' },    // Fmaj9 (VI)
  { root: 60, type: 'maj9',   bassNote: 36, scale: 'lydian' },    // Cmaj9 (III)
  { root: 55, type: 'dom9',   bassNote: 31, scale: 'mixolydian' }, // G9 (VII)
]

// Dm - Bb - F - C (i - VI - III - VII in D minor)
const SYNTH_PROG_2: ChordDef[] = [
  { root: 62, type: 'min9',   bassNote: 38, scale: 'aeolian' },   // Dm9 (i)
  { root: 58, type: 'maj9',   bassNote: 34, scale: 'lydian' },    // Bbmaj9 (VI)
  { root: 65, type: 'maj9',   bassNote: 41, scale: 'lydian' },    // Fmaj9 (III)
  { root: 60, type: 'dom9',   bassNote: 36, scale: 'mixolydian' }, // C9 (VII)
]

// Em - C - G - D (i - VI - III - VII in E minor)
const SYNTH_PROG_3: ChordDef[] = [
  { root: 64, type: 'min9',   bassNote: 40, scale: 'aeolian' },   // Em9 (i)
  { root: 60, type: 'maj9',   bassNote: 36, scale: 'lydian' },    // Cmaj9 (VI)
  { root: 67, type: 'dom9',   bassNote: 43, scale: 'mixolydian' }, // G9 (III)
  { root: 62, type: 'maj9',   bassNote: 38, scale: 'lydian' },    // Dmaj9 (VII)
]

// ====================================================================
// GENRE 4: POP (bright, catchy, singable)
// I-V-vi-IV — the most used progression in pop music history.
// Pre-composed singable melodies that follow chord tones.
// ====================================================================

// C - G - Am - F (I-V-vi-IV in C) — THE pop progression
const POP_PROG_1: ChordDef[] = [
  { root: 60, type: 'maj9', bassNote: 36, scale: 'major' },       // Cmaj9 (I)
  { root: 67, type: 'dom9', bassNote: 43, scale: 'mixolydian' },   // G9 (V)
  { root: 69, type: 'min9', bassNote: 45, scale: 'aeolian' },      // Am9 (vi)
  { root: 65, type: 'maj9', bassNote: 41, scale: 'lydian' },       // Fmaj9 (IV)
]
// G - D - Em - C (I-V-vi-IV in G)
const POP_PROG_2: ChordDef[] = [
  { root: 67, type: 'maj9', bassNote: 43, scale: 'major' },       // Gmaj9 (I)
  { root: 62, type: 'dom9', bassNote: 38, scale: 'mixolydian' },   // D9 (V)
  { root: 64, type: 'min9', bassNote: 40, scale: 'aeolian' },      // Em9 (vi)
  { root: 60, type: 'maj9', bassNote: 36, scale: 'lydian' },       // Cmaj9 (IV)
]
// D - A - Bm - G (I-V-vi-IV in D)
const POP_PROG_3: ChordDef[] = [
  { root: 62, type: 'maj9', bassNote: 38, scale: 'major' },       // Dmaj9 (I)
  { root: 69, type: 'dom9', bassNote: 45, scale: 'mixolydian' },   // A9 (V)
  { root: 71, type: 'min9', bassNote: 47, scale: 'aeolian' },      // Bm9 (vi)
  { root: 67, type: 'maj9', bassNote: 43, scale: 'lydian' },       // Gmaj9 (IV)
]

// ====================================================================
// GENRE 5: DOOM / FUNERAL DOOM
// Beautiful, sad, emotional. Simple progressions, pre-composed melodies.
// The emotion comes from: minor key, bVI chord (longing), slow tempo,
// descending melody lines, and clean tone over heavy bass.
// ====================================================================

// i - bVI - iv - v in D minor — the classic lament
const DOOM_PROG_1: ChordDef[] = [
  { root: 50, type: 'min9',   bassNote: 26, scale: 'harmonicMinor' },  // Dm9 (i)
  { root: 57, type: 'maj9',   bassNote: 33, scale: 'lydian' },          // Bbmaj9 (bVI)
  { root: 53, type: 'min6',   bassNote: 29, scale: 'naturalMinor' },    // Gm6 (iv)
  { root: 55, type: 'min',    bassNote: 31, scale: 'aeolian' },         // Am (v)
]
// i - bIII - bVII - i in B minor — hopeful sadness
const DOOM_PROG_2: ChordDef[] = [
  { root: 47, type: 'min9',   bassNote: 23, scale: 'harmonicMinor' },  // Bm9 (i)
  { root: 50, type: 'maj7',   bassNote: 26, scale: 'lydian' },          // Dmaj7 (bIII)
  { root: 57, type: 'dom9',   bassNote: 33, scale: 'mixolydian' },      // A9 (bVII)
  { root: 47, type: 'min6',   bassNote: 23, scale: 'naturalMinor' },    // Bm6 (i)
]
// i - bVI - v - i in C minor — funeral march
const DOOM_PROG_3: ChordDef[] = [
  { root: 48, type: 'min9',   bassNote: 24, scale: 'harmonicMinor' },  // Cm9 (i)
  { root: 56, type: 'maj9',   bassNote: 32, scale: 'lydian' },          // Abmaj9 (bVI)
  { root: 55, type: 'min',    bassNote: 31, scale: 'aeolian' },         // Gm (v)
  { root: 48, type: 'min6',   bassNote: 24, scale: 'naturalMinor' },    // Cm6 (i)
]

// ====================================================================
// GENRE 5: REQUIEM (emotional, gloomy, beautiful, touching)
// Neo-classical ambient. Think Nils Frahm, Ólafur Arnalds, Max Richter,
// Ludovico Einaudi. Simple, heartbreakingly beautiful piano-like melodies
// over slow, sustained chords. The beauty comes from:
// - Simple diatonic progressions (no dissonance — pure consonance)
// - Slow melodic phrases that resolve to chord tones
// - Lots of space (rests) — let each note breathe
// - Major 7 and minor 9 chords for warmth and color
// - Descending melodic lines that feel like acceptance, not despair
// ====================================================================

// Am - F - C - G (vi - IV - I - V in C) — emotional but hopeful
const REQUIEM_PROG_1: ChordDef[] = [
  { root: 57, type: 'min9',   bassNote: 33, scale: 'aeolian' },   // Am9 (vi) — gentle sorrow
  { root: 53, type: 'maj9',   bassNote: 29, scale: 'lydian' },    // Fmaj9 (IV) — warmth
  { root: 60, type: 'maj9',   bassNote: 36, scale: 'major' },     // Cmaj9 (I) — resolution/home
  { root: 55, type: 'dom9',   bassNote: 31, scale: 'mixolydian' }, // G9 (V) — gentle tension
]

// Em - C - G - D (vi - IV - I - V in G) — same pattern, higher key
const REQUIEM_PROG_2: ChordDef[] = [
  { root: 64, type: 'min9',   bassNote: 40, scale: 'aeolian' },   // Em9 (vi)
  { root: 60, type: 'maj9',   bassNote: 36, scale: 'lydian' },    // Cmaj9 (IV)
  { root: 67, type: 'maj9',   bassNote: 43, scale: 'major' },     // Gmaj9 (I)
  { root: 62, type: 'dom9',   bassNote: 38, scale: 'mixolydian' }, // D9 (V)
]

// Dm - Bb - F - C (vi - IV - I - V in F) — warm and intimate
const REQUIEM_PROG_3: ChordDef[] = [
  { root: 62, type: 'min9',   bassNote: 38, scale: 'aeolian' },   // Dm9 (vi)
  { root: 58, type: 'maj9',   bassNote: 34, scale: 'lydian' },    // Bbmaj9 (IV)
  { root: 65, type: 'maj9',   bassNote: 41, scale: 'major' },     // Fmaj9 (I)
  { root: 60, type: 'dom9',   bassNote: 36, scale: 'mixolydian' }, // C9 (V)
]

// ====================================================================
// GENRE 6: AURORA — Felt piano + strings, emotional and luminous
// Replaces Requiem with a richer, more cinematic sound.
// Think: Jon Hopkins, Bon Iver, Nils Frahm "All Melody", Hania Rani.
// Uses arpeggio melody mode (ping-pong 2 octaves) for a flowing,
// rippling quality — like northern lights shimmering.
// ====================================================================

// F#m - D - A - E (vi - IV - I - V in A) — soaring, hopeful melancholy
const AURORA_PROG_1: ChordDef[] = [
  { root: 66, type: 'min9',   bassNote: 42, scale: 'aeolian' },     // F#m9 (vi) — yearning
  { root: 62, type: 'maj9',   bassNote: 38, scale: 'lydian' },      // Dmaj9 (IV) — warmth
  { root: 69, type: 'maj9',   bassNote: 45, scale: 'major' },       // Amaj9 (I) — home, bright
  { root: 64, type: 'dom9',   bassNote: 40, scale: 'mixolydian' },  // E9 (V) — gentle tension
]
// C#m - A - E - B (vi - IV - I - V in E) — same pattern, higher key
const AURORA_PROG_2: ChordDef[] = [
  { root: 73, type: 'min9',   bassNote: 49, scale: 'aeolian' },     // C#m9 (vi)
  { root: 69, type: 'maj9',   bassNote: 45, scale: 'lydian' },      // Amaj9 (IV)
  { root: 76, type: 'maj9',   bassNote: 52, scale: 'major' },       // Emaj9 (I)
  { root: 71, type: 'dom9',   bassNote: 47, scale: 'mixolydian' },  // B9 (V)
]
// G#m - E - B - F# (vi - IV - I - V in B) — highest, brightest
const AURORA_PROG_3: ChordDef[] = [
  { root: 68, type: 'min9',   bassNote: 44, scale: 'aeolian' },     // G#m9 (vi)
  { root: 64, type: 'maj9',   bassNote: 40, scale: 'lydian' },      // Emaj9 (IV)
  { root: 71, type: 'maj9',   bassNote: 47, scale: 'major' },       // Bmaj9 (I)
  { root: 66, type: 'dom9',   bassNote: 42, scale: 'mixolydian' },  // F#9 (V)
]

// ---- Genre configurations ----
export type MusicGenre = 'lofi' | 'mystic' | 'synthwave'

export interface GenreConfig {
  name: string
  description: string
  progressions: ChordDef[][]
  // Optional: pre-composed melodies per progression (MIDI notes, -1 = rest)
  // When present, the engine plays these instead of generating random notes
  precomposedMelodies?: number[][][]
  // Melody mode: 'voiceLed' (default v1 engine) or 'arpeggio' (ping-pong 2-3 octaves)
  melodyMode?: 'voiceLed' | 'arpeggio'
  // Synthesis parameters
  masterFilterFreq: number
  reverbAmount: number
  delayAmount: number
  padVolume: number
  bassVolume: number
  melodyVolume: number
  chordStabVolume: number
  melodyOscType: OscillatorType
  bassOscType: OscillatorType
}

export const GENRE_CONFIGS: Record<MusicGenre, GenreConfig> = {
  lofi: {
    name: 'Lofi',
    description: 'Warm rhodes, jazzy chords. The original.',
    progressions: [LOFI_PROG_C, LOFI_PROG_JAZZ, LOFI_PROG_NEOSOUL, LOFI_PROG_DORIAN, LOFI_PROG_MAJOR],
    masterFilterFreq: 5200,
    reverbAmount: 0.45,
    delayAmount: 0.35,
    padVolume: 0.18,  // chord pad — audible bed (was too quiet)
    bassVolume: 0.42,  // louder bass (was 0.34)
    melodyVolume: 0.20,
    chordStabVolume: 0.08,
    melodyOscType: 'sine',
    bassOscType: 'sine',
  },
  mystic: {
    name: 'Mystic',
    description: 'Surreal, ethereal, otherworldly.',
    progressions: [MYSTIC_PROG_1, MYSTIC_PROG_2, MYSTIC_PROG_3],
    masterFilterFreq: 3800,     // darker
    reverbAmount: 0.65,         // more reverb — spacious
    delayAmount: 0.5,           // more delay — echoes
    padVolume: 0.20,            // atmospheric pad — audible (was too quiet)
    bassVolume: 0.38,  // louder bass (was 0.30)
    melodyVolume: 0.17,
    chordStabVolume: 0.06,
    melodyOscType: 'triangle',  // softer, more mysterious
    bassOscType: 'sine',
  },
  synthwave: {
    name: 'Synthwave',
    description: 'Authentic 80s retro. Driving arpeggiated bass.',
    progressions: [SYNTH_PROG_1, SYNTH_PROG_2, SYNTH_PROG_3],
    masterFilterFreq: 8000,     // bright — lets the sawtooth shine
    reverbAmount: 0.25,         // tighter, less wash
    delayAmount: 0.28,          // dotted-eighth delay for that 80s feel
    padVolume: 0.15,           // lush pad — audible bed
    bassVolume: 0.48,           // louder driving bass (was 0.40)
    melodyVolume: 0.20,
    chordStabVolume: 0.10,
    melodyOscType: 'sawtooth',  // bright synth lead
    bassOscType: 'square',      // punchy synth bass
  },
}

// ---- Progression engine with anti-repetition ----
// Cycles through a genre's progressions but avoids repeating recent chords.

export class ProgressionEngine {
  private genre: MusicGenre = 'lofi'
  private progressionIndex = 0
  private chordIndex = 0
  private currentChord: ChordDef
  private recentChordSigs: string[] = []  // signatures of recent chords
  private jumpsSinceProgressionChange = 0

  constructor() {
    this.currentChord = GENRE_CONFIGS.lofi.progressions[0][0]
  }

  setGenre(genre: MusicGenre) {
    this.genre = genre
    this.progressionIndex = 0
    this.chordIndex = 0
    this.recentChordSigs = []
    this.jumpsSinceProgressionChange = 0
    this.currentChord = GENRE_CONFIGS[genre].progressions[0][0]
  }

  getGenre(): MusicGenre {
    return this.genre
  }

  getCurrentChord(): ChordDef {
    return this.currentChord
  }

  getProgressionIndex(): number {
    return this.progressionIndex
  }

  /** Advance to the next chord. Cycles through progressions, avoids recent chords. */
  advanceChord(): ChordDef {
    const config = GENRE_CONFIGS[this.genre]
    this.jumpsSinceProgressionChange++

    // Advance chord index every 8 jumps (2 chords per progression cycle)
    if (this.jumpsSinceProgressionChange >= 8) {
      this.jumpsSinceProgressionChange = 0
      this.progressionIndex = (this.progressionIndex + 1) % config.progressions.length
      this.chordIndex = 0
      this.recentChordSigs = []  // reset memory on progression change
    } else {
      this.chordIndex = (this.chordIndex + 1) % config.progressions[this.progressionIndex].length
    }

    const prog = config.progressions[this.progressionIndex]
    let nextChord = prog[this.chordIndex]
    const nextSig = `${nextChord.root % 12}-${nextChord.type}`

    // If this chord was played recently, try to find an alternative from the
    // same progression that hasn't been played recently
    if (this.recentChordSigs.includes(nextSig)) {
      const alternatives = prog.filter((c, i) => {
        const sig = `${c.root % 12}-${c.type}`
        return !this.recentChordSigs.includes(sig)
      })
      if (alternatives.length > 0) {
        nextChord = alternatives[Math.floor(Math.random() * alternatives.length)]
      }
    }

    // Track recent chords (keep last 3)
    const sig = `${nextChord.root % 12}-${nextChord.type}`
    this.recentChordSigs.push(sig)
    if (this.recentChordSigs.length > 3) this.recentChordSigs.shift()

    this.currentChord = nextChord
    return nextChord
  }

  reset() {
    this.progressionIndex = 0
    this.chordIndex = 0
    this.recentChordSigs = []
    this.jumpsSinceProgressionChange = 0
    this.currentChord = GENRE_CONFIGS[this.genre].progressions[0][0]
  }
}

// ---- Voice-leading helpers ----

export function getChordTonesInRange(chord: ChordDef, minNote: number, maxNote: number): number[] {
  const tones = CHORDS[chord.type]
  const rootPc = chord.root % 12
  const result: number[] = []
  for (let oct = 0; oct < 8; oct++) {
    for (const t of tones) {
      const note = rootPc + t + oct * 12 + 12
      if (note >= minNote && note <= maxNote) {
        result.push(note)
      }
    }
  }
  return result
}

export function getScaleTonesInRange(chord: ChordDef, minNote: number, maxNote: number): number[] {
  const scale = SCALES[chord.scale]
  const rootPc = chord.root % 12
  const result: number[] = []
  for (let oct = 0; oct < 8; oct++) {
    for (const s of scale) {
      const note = rootPc + s + oct * 12 + 12
      if (note >= minNote && note <= maxNote) {
        result.push(note)
      }
    }
  }
  return result
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function getChordName(chord: ChordDef): string {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const root = NOTE_NAMES[chord.root % 12]
  const typeMap: Record<ChordType, string> = {
    maj: '', min: 'm', dim: '°', aug: '+', sus2: 'sus2', sus4: 'sus4',
    maj7: 'maj7', min7: 'm7', dom7: '7', maj9: 'maj9', min9: 'm9',
    dom9: '9', min7b5: 'm7♭5', dim7: '°7', min11: 'm11', maj11: 'maj11',
    min6: 'm6', maj6: '6', min6add9: 'm6add9', maj7b5: 'maj7♭5',
    minMaj7: 'mMaj7', augMaj7: '+maj7',
  }
  return root + typeMap[chord.type]
}

// Backward compatibility
export const PROGRESSIONS: ChordDef[][] = LOFI_PROG_C
