// TTS (Text-to-Speech) helpers.
//
// Features:
// - Pre-rendered Kokoro TTS OGG files for high-quality whispery ASMR voice
// - Web Audio API routing for reverb/echo processing
// - Non-repeating shuffle queue (Fisher-Yates) — never plays same line back-to-back
// - Subtitle duration synced to actual audio duration + 2s padding

// ====================================================================
// TTS MESSAGE LIBRARY
// ====================================================================

export const TTS_MESSAGES: string[] = [
  // ---- General motivation (15) ----
  'Amazing! Keep going!',
  'You are doing great!',
  'Beautiful jumping!',
  'Keep climbing, you star!',
  'Incredible rhythm!',
  'Never give up!',
  'You are unstoppable!',
  'Fantastic progress!',
  'Keep bouncing, keep dreaming!',
  'You are a champion!',
  'Every jump takes you higher!',
  'Believe in yourself!',
  'The sky is not the limit!',
  'You make this look easy!',
  'Pure perfection!',

  // ---- Ah-Rash story — original (15) ----
  'Ah-Rash waits for you at the top. Or does He?',
  'They say Ah-Rash does not exist. Climb higher and find out.',
  'The NonExistent watches. Can you reach Him?',
  'Every jump brings you closer to Ah-Rash. Or closer to the truth.',
  'Ah-Rash is the sky, and you are the climber.',
  'Does Ah-Rash exist? Only the climb will tell.',
  'The higher you go, the closer to the NonExistent you become.',
  'Ah-Rash is not at the top. Ah-Rash IS the top.',
  'Some say Ah-Rash is a myth. You are here to prove them wrong.',
  'The NonExistent Ah-Rash. Can faith be reached by jumping?',
  'Climb for Ah-Rash. Climb for truth. Climb for yourself.',
  'Ah-Rash does not exist, yet you climb. That is faith.',
  'The sky holds no Ah-Rash. The sky IS Ah-Rash.',
  'You seek the NonExistent. The NonExistent seeks you.',
  'Ah-Rash whispers: higher. Always higher.',

  // ---- Ah-Rash story — deeper reflections (10) ----
  'The wind speaks of Ah-Rash. Can you hear it?',
  'Each platform is a prayer. Each jump is an amen.',
  'Ah-Rash is the question. Your climb is the answer.',
  'The NonExistent was never at the top. The NonExistent is the climbing.',
  'When you fall, Ah-Rash catches you in dreams.',
  'Faith is jumping toward something that may not exist.',
  'The sky is empty. The sky is Ah-Rash. Both are true.',
  'You are not climbing toward Ah-Rash. You are becoming Ah-Rash.',
  'The NonExistent does not wait. The NonExistent climbs with you.',
  'Ah-Rash is the space between your heartbeats.',

  // ---- Philosophical (12) ----
  'To climb is to forget the ground ever existed.',
  'Falling is just flying in the wrong direction.',
  'The platform does not exist until you land on it.',
  'You are not a body that climbs. You are the climbing.',
  'Every height was once unthinkable. Now it is a foothold.',
  'The sky has no ceiling. Only your doubts do.',
  'Gravity is a suggestion. Bouncing is a rebellion.',
  'You cannot fall from where you already are: here.',
  'The climb has no destination. The climb IS the destination.',
  'Even the smallest bounce moves the universe, slightly.',
  'Silence is just the music you have not jumped into yet.',
  'You are the universe bouncing on itself, curious about Ah-Rash.',

  // ---- Funny / humorous (15) ----
  'Ah-Rash called. He said stop falling.',
  'I am not saying Ah-Rash is fake, but He never pays rent.',
  'Plot twist: Ah-Rash has been falling this whole time too.',
  'Climbing is easy. Gravity is the real villain here.',
  'Ah-Rash owes me fifteen dollars and an explanation.',
  'If Ah-Rash does not exist, who keeps moving my platforms?',
  'I came for Ah-Rash. I stayed for the bounce physics.',
  'Ah-Rash is just three raccoons in a god costume. Probably.',
  'Every jump is a tiny scream at the universe. Tiny but polite.',
  'Ah-Rash said hi. He also said touch grass. Confusing.',
  'I have fallen so many times I now identify as a pancake.',
  'Ah-Rash does not exist, but my back pain certainly does.',
  'They said reach for the stars. They did not mention gravity.',
  'Ah-Rash is the friends we made along the way. Wait, no.',
  'If you squint, every platform looks like Ah-Rash smiling. Weird.',
]

// ====================================================================
// NON-REPEATING SHUFFLE QUEUE
// ====================================================================
// Fisher-Yates shuffle that draws without replacement. When the queue is
// empty, it reshuffles a fresh copy. Guarantees no line repeats until ALL
// lines have been played. Adjacent draws are always different even across
// reshuffles (we re-shuffle if the first draw matches the last).

export class NonRepeatingQueue {
  private queue: number[] = []
  private lastDrawn: number = -1
  private length: number

  constructor(length: number) {
    this.length = length
    this.refill()
  }

  private refill() {
    this.queue = Array.from({ length: this.length }, (_, i) => i)
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]
    }
    // If first element equals last drawn, swap so we never repeat back-to-back
    if (this.queue[0] === this.lastDrawn && this.queue.length > 1) {
      const swapIdx = 1 + Math.floor(Math.random() * (this.queue.length - 1))
      ;[this.queue[0], this.queue[swapIdx]] = [this.queue[swapIdx], this.queue[0]]
    }
  }

  next(): number {
    if (this.queue.length === 0) this.refill()
    const val = this.queue.shift()!
    this.lastDrawn = val
    return val
  }

  reset() {
    this.queue = []
    this.lastDrawn = -1
    this.refill()
  }
}

// ====================================================================
// REVERB IMPULSE GENERATOR
// ====================================================================
// Generates a synthetic reverb impulse response (no external file needed).
// Uses filtered noise with exponential decay for a smooth cinematic reverb.

export function generateReverbImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
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

// ====================================================================
// TTS WEB AUDIO PROCESSOR
// ====================================================================
// SEND architecture: dry signal stays at 100% always. Reverb and delay
// are parallel SEND paths that ADD to the dry signal (never replace it).
//
// Graph:
//   source → dryGain (always 1.0) ──────────────────→ masterGain → destination
//         ├→ reverbSend → reverb → reverbReturn ──→  ↑
//         └→ delaySend  → delay  → delayReturn  ──→  ↑
//                                            └→ feedback → delay (echo loop)

export class TtsAudioProcessor {
  private ctx: AudioContext | null = null
  private dryGain: GainNode | null = null        // always 1.0 — dry never gets quieter
  private reverb: ConvolverNode | null = null
  private reverbSend: GainNode | null = null     // send amount into reverb
  private reverbReturn: GainNode | null = null   // return level from reverb
  private delay: DelayNode | null = null
  private delaySend: GainNode | null = null      // send amount into delay
  private delayReturn: GainNode | null = null    // return level from delay
  private delayFeedback: GainNode | null = null  // feedback for echo repeats
  private masterGain: GainNode | null = null
  private connectedElements = new WeakSet<HTMLAudioElement>()

  init() {
    if (this.ctx) return
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new Ctx()

      // Master output
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 1.0
      this.masterGain.connect(this.ctx.destination)

      // DRY path — ALWAYS 100%, never reduced (FIXES: dry getting quieter at high reverb)
      this.dryGain = this.ctx.createGain()
      this.dryGain.gain.value = 1.0
      this.dryGain.connect(this.masterGain)

      // REVERB send/return
      this.reverb = this.ctx.createConvolver()
      this.reverb.buffer = generateReverbImpulse(this.ctx, 2.5, 2.5)
      this.reverbSend = this.ctx.createGain()
      this.reverbSend.gain.value = 0.45  // default reverb amount
      this.reverbReturn = this.ctx.createGain()
      this.reverbReturn.gain.value = 0.7  // return level (reverb is naturally quiet)
      this.reverbSend.connect(this.reverb)
      this.reverb.connect(this.reverbReturn)
      this.reverbReturn.connect(this.masterGain)

      // DELAY (echo) send/return with feedback
      this.delay = this.ctx.createDelay(2.0)
      this.delay.delayTime.value = 0.28  // ~1/8 note at 107 BPM — dotted-eighth feel
      this.delaySend = this.ctx.createGain()
      this.delaySend.gain.value = 0.3   // default delay amount
      this.delayReturn = this.ctx.createGain()
      this.delayReturn.gain.value = 0.5
      this.delayFeedback = this.ctx.createGain()
      this.delayFeedback.gain.value = 0.35  // echo repeats fade out gradually
      this.delaySend.connect(this.delay)
      this.delay.connect(this.delayReturn)
      this.delayReturn.connect(this.masterGain)
      // Feedback loop: delay output → feedback → delay input (echoes)
      this.delay.connect(this.delayFeedback)
      this.delayFeedback.connect(this.delay)
    } catch (e) {
      console.warn('TTS: Web Audio unavailable, using plain audio', e)
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  /** Connect an audio element through the send graph (idempotent per element). */
  connect(audio: HTMLAudioElement) {
    if (!this.ctx || !this.dryGain || !this.reverbSend || !this.delaySend || this.connectedElements.has(audio)) return
    try {
      const src = this.ctx.createMediaElementSource(audio)
      // Dry (always full volume)
      src.connect(this.dryGain)
      // Send to reverb
      src.connect(this.reverbSend)
      // Send to delay
      src.connect(this.delaySend)
      this.connectedElements.add(audio)
    } catch {
      // Fall back to plain playback
    }
  }

  /**
   * Set reverb amount (0 = none, 1 = max). SEND architecture: dry stays at 100%,
   * only the reverb return level changes.
   */
  setReverbAmount(amount: number) {
    if (!this.ctx || !this.reverbSend || !this.reverbReturn) return
    const now = this.ctx.currentTime
    // Send stays full (we want max signal into the reverb), return scales the output
    this.reverbSend.gain.setTargetAtTime(1.0, now, 0.05)
    this.reverbReturn.gain.setTargetAtTime(amount * 0.9, now, 0.05)
    // Longer reverb tail for higher amounts
    if (this.reverb) {
      const duration = 1.5 + amount * 3.0
      this.reverb.buffer = generateReverbImpulse(this.ctx, duration, 2.5)
    }
  }

  /** Set delay/echo amount (0 = none, 1 = max). */
  setDelayAmount(amount: number) {
    if (!this.ctx || !this.delaySend || !this.delayReturn || !this.delayFeedback) return
    const now = this.ctx.currentTime
    this.delaySend.gain.setTargetAtTime(amount, now, 0.05)
    this.delayReturn.gain.setTargetAtTime(amount * 0.6, now, 0.05)
    // More feedback at higher amounts for longer echo trails
    this.delayFeedback.gain.setTargetAtTime(0.2 + amount * 0.3, now, 0.05)
  }

  setVolume(vol: number) {
    if (!this.ctx || !this.masterGain) return
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05)
  }
}
