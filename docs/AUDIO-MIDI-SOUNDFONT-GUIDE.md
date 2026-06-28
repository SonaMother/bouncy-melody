# Web Audio, MIDI & Soundfonts — Deep Reference Guide

> A reference document for implementing audio in web games (JavaScript/TypeScript, Web Audio API, Next.js, Tone.js, smplr).
> Every section is written to **prevent the bugs we have actually hit**. Where a section maps to a real bug in the codebase, it is called out with a `🐛 Found in codebase` note.

**Table of Contents**

1. [Web Audio API Fundamentals](#1-web-audio-api-fundamentals)
2. [MIDI in Web Apps](#2-midi-in-web-apps)
3. [Soundfonts in Web](#3-soundfonts-in-web)
4. [Audio Routing Best Practices](#4-audio-routing-best-practices)
5. [Instrument / Channel Management](#5-instrument--channel-management)
6. [Common Pitfalls](#6-common-pitfalls)
7. [Code Patterns](#7-code-patterns)
8. [Appendix: Quick Reference Tables](#8-appendix-quick-reference-tables)

---

## 1. Web Audio API Fundamentals

Web Audio is a **graph-based** audio processing system. You create `AudioNode`s and wire them together with `connect()`; audio flows from source nodes toward the `AudioContext.destination` (the speakers). Everything — volume, panning, reverb, delay — is a node in that graph.

### 1.1 AudioContext — the heart of everything

The `AudioContext` is the **global controller**: it owns the audio graph, the hardware, the clock (`currentTime`), and the sample rate.

```ts
const ctx = new AudioContext();
console.log(ctx.state);      // "suspended" | "running" | "closed"
console.log(ctx.sampleRate); // 44100 (typically)
console.log(ctx.currentTime); // seconds since context creation, monotonic
```

#### States & the autoplay policy (THE #1 gotcha)

A brand-new `AudioContext` starts in the **`suspended`** state on every modern browser. Browsers block autoplay, so the context will **not** transition to `running` until a **user gesture** occurs (click, tap, keydown). This is non-negotiable and enforced by Chrome, Safari, Firefox, etc.

```ts
// ❌ WRONG — created on page load, will stay suspended, no sound
const ctx = new AudioContext();
playMusic(); // silence — context is suspended

// ✅ CORRECT — create/resume inside a user gesture handler
startButton.addEventListener('click', async () => {
  const ctx = new AudioContext();       // or reuse an existing one
  if (ctx.state === 'suspended') {
    await ctx.resume();                  // returns a Promise
  }
  playMusic();
});
```

Key methods:

| Method | What it does | When to use |
|---|---|---|
| `new AudioContext()` | Create the context (starts suspended) | Once, lazily — ideally not on page load |
| `ctx.resume()` | Move `suspended → running`. **Must** be in a user gesture. | On first interaction, or after returning to a tab |
| `ctx.suspend()` | Move `running → suspended`. Frees the audio thread. | **Almost never** in a game — see §6.1 |
| `ctx.close()` | Permanently release the context and all its nodes. | Only when fully tearing down the app |

**Listen for state changes** to react to the browser tabbing away:

```ts
ctx.addEventListener('statechange', () => {
  console.log('AudioContext state →', ctx.state);
});
```

> ⚠️ On iOS Safari the context can suspend when the app is backgrounded and **won't auto-resume** when you come back. You must call `ctx.resume()` from a new user gesture on return. There is no reliable programmatic workaround.

### 1.2 GainNode — volume, mixing, post-fader control

A `GainNode` multiplies its input by a `gain` AudioParam. It is the **single most-used node** — it's how you do volume, mixing (summing), and fading.

```ts
const gain = ctx.createGain();
gain.gain.value = 0.5;   // halve the volume
source.connect(gain);
gain.connect(ctx.destination);
```

Important properties:

- **`gain`** is an `AudioParam` (see §1.8) — you can ramp it smoothly.
- **Multiple inputs are summed**: connecting 5 sources to one GainNode mixes them together (this is how a mixer bus works).
- **Channel handling**: a GainNode defaults to `channelCount: 2`, `channelCountMode: "max"`, `channelInterpretation: "speakers"`. This means **a GainNode preserves stereo** — it adapts to the max channel count of its inputs. You do **not** lose stereo by routing through a GainNode (see §4.4 for the real stereo-summing bug).
- **Fan-out**: one node's output can `connect()` to many destinations (e.g., dry signal + reverb send + delay send).

```ts
// A mixer bus: sum 4 instruments into one gain, then to master
const bus = ctx.createGain();
bus.gain.value = 1.0;
melodyGain.connect(bus);
bassGain.connect(bus);
padGain.connect(bus);
chordGain.connect(bus);
bus.connect(masterGain);
```

### 1.3 StereoPannerNode — left/right positioning

```ts
const panner = ctx.createStereoPanner();
panner.pan.value = -0.5;   // -1 = full left, 0 = center, +1 = full right
```

- `pan` is an `AudioParam` ranging **-1.0 to +1.0**.
- Uses an equal-power pan law (a center-panned signal is ~ -3 dB per channel, not -6 dB).
- **Channel handling**: `channelCountMode` is `"clamped-max"` and `channelCount` is clamped to `[1, 2]`. A mono input is **up-mixed to stereo** before panning, so the output is always stereo (unless the downstream node down-mixes it — see §6.7).
- There is **no `connect()` on a panner's pan** in the way you might expect — to automate pan, ramp `panner.pan` (it's an AudioParam).
- For >2-channel surround you'd need `PannerNode` (the 3D one) or a `ChannelMergerNode`; for games, `StereoPannerNode` is almost always what you want.

### 1.4 BiquadFilterNode — tone shaping (EQ)

```ts
const filter = ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 800;   // cutoff
filter.Q.value = 1.0;           // resonance
```

| `type` | Use case |
|---|---|
| `lowpass` | Muffle/warm a tone; remove harshness; lofi low-pass |
| `highpass` | Remove rumble; thin out a bass |
| `bandpass` | Telephone/narrow tone effect |
| `lowshelf` | Boost/cut bass below a frequency |
| `highshelf` | Boost/cut treble above a frequency |
| `peaking` | Boost/cut a specific band (parametric EQ) |
| `notch` | Cut a narrow band (remove hum/whistle) |
| `allpass` | Phase shift (special effects) |

`frequency` and `Q` are AudioParams — ramp them for filter sweeps.

### 1.5 ConvolverNode — reverb via impulse responses

A `ConvolverNode` convolves its input with an **impulse response** (IR) buffer — typically a recording of a reverberant space decaying. This is how you get realistic reverb cheaply.

```ts
const convolver = ctx.createConvolver();
// Load an IR (a short .wav of a room's reverb decay)
const ir = await fetch('/impulse/cathedral.wav').then(r => r.arrayBuffer());
convolver.buffer = await ctx.decodeAudioData(ir);

// Reverb is a SEND: split dry from wet
const dry = ctx.createGain(); dry.gain.value = 0.8;
const wet = ctx.createGain(); wet.gain.value = 0.2;
source.connect(dry); dry.connect(master);
source.connect(wet); wet.connect(convolver); convolver.connect(master);
```

- The IR buffer defines the character (hall, plate, room, spring).
- You can **synthesize** an IR with noise + exponential decay if you don't have a file.
- Convolution is CPU-heavy; one shared convolver on a reverb bus is far cheaper than one per instrument.

### 1.6 DelayNode — echo / delay

```ts
const delay = ctx.createDelay(5.0); // max delay time in seconds
delay.delayTime.value = 0.375;       // dotted-eighth at 120 BPM

const feedback = ctx.createGain();
feedback.gain.value = 0.35;          // < 1.0 or it never decays

delay.connect(feedback);
feedback.connect(delay);             // feedback loop
```

- Constructor arg is `maxDelayTime` (default 1s). Set it larger than your longest delay.
- **Always** put a `GainNode` (gain < 1.0) in the feedback path, or you build an infinite-gain oscillator.
- `delayTime` is an AudioParam — you can sweep it for tape-style pitch wobble (but ramp gently to avoid clicks).

### 1.7 DynamicsCompressorNode — limiting / glue

```ts
const comp = ctx.createDynamicsCompressor();
comp.threshold.value = -10;  // start compressing above -10 dB
comp.knee.value = 30;        // soft transition width
comp.ratio.value = 4;        // 4:1 compression
comp.attack.value = 0.003;   // 3 ms
comp.release.value = 0.25;   // 250 ms
```

- Put one on the **master bus** to prevent clipping when many instruments play at once ("glue").
- It is **not** a true limiter, but with `ratio: 20`, `attack: 0.001` it approximates one.
- It introduces latency (~`delayTime` of the detector); don't put it on a monitor path that needs to be sample-tight.

### 1.8 AudioParam — `setValueAtTime` vs `linearRamp` vs `setTargetAtTime`

Every automatable value (gain, frequency, pan, delayTime…) is an `AudioParam`. You **schedule** changes against `ctx.currentTime`. There are four key scheduling methods:

| Method | Shape | Use when |
|---|---|---|
| `setValueAtTime(v, t)` | Instant step at time `t` | Hard cuts, snapping to a known value before a ramp |
| `linearRampToValueAtTime(v, t)` | Straight line to `v` by `t` | Predictable linear fades; UI-driven smooth changes |
| `exponentialRampToValueAtTime(v, t)` | Exponential curve to `v` by `t` | Natural-sounding volume fades; **`v` must be > 0** (can't cross 0) |
| `setTargetAtTime(v, t, tc)` | Exponential *approach* toward `v`, time-constant `tc` | Smooth, click-free transitions; the "go to 0.7 smoothly" call |

```ts
const t = ctx.currentTime;

// Smooth fade-in over 2s (exponential feels natural for volume)
gain.gain.setValueAtTime(0.0001, t);
gain.gain.exponentialRampToValueAtTime(0.7, t + 2.0);

// Click-free volume change to a new target (time constant 0.05s)
gain.gain.setTargetAtTime(0.5, t, 0.05);

// Hard mute then fade out
gain.gain.cancelScheduledValues(t);
gain.gain.setValueAtTime(gain.gain.value, t);
gain.gain.linearRampToValueAtTime(0, t + 0.3);
```

**Critical rules:**

1. **`exponentialRampToValueAtTime` cannot reach 0 and cannot start from 0** — it throws/produces NaN. Start from `0.0001` and ramp to `0.0001`, never 0.
2. **Always `setValueAtTime` a known anchor before a ramp** that follows other scheduled events, or the ramp starts from wherever the param currently is (often surprising). Use `cancelScheduledValues(t)` first if you need to abort prior automation.
3. **`setTargetAtTime` never actually arrives at the target** — it approaches it asymptotically. For a "close enough" arrival, after ~5× the time constant you're within 1%. This is the **best method for live UI volume changes** because it's click-free and idempotent.
4. Ramps are evaluated **at audio rate**, so even a "fast" `linearRamp` of 30 ms is smooth; a raw `gain.value = x` assignment is instantaneous and **clicks** ( zipper noise).

### 1.9 Signal routing: connect / disconnect / fan-out / summing

```ts
// connect(sourceOutputIndex, destinationNode, destinationInputIndex)
node.connect(anotherNode);          // audio → audio
node.connect(anotherNode.gain);     // audio → AudioParam (modulate gain!)
node.disconnect();                  // disconnect ALL outputs
node.disconnect(destinationNode);   // disconnect one specific destination
```

- **Fan-out (one → many):** `source.connect(a); source.connect(b);` — one source can drive multiple destinations (dry + reverb send + analyser). Each connection is independent.
- **Summing (many → one):** `a.connect(bus); b.connect(bus);` — multiple sources into one GainNode are added together. This is your mixer.
- **`connect()` returns the destination node**, enabling chaining: `source.connect(gain).connect(filter).connect(ctx.destination);`
- **Connecting to an AudioParam** lets you modulate a parameter with audio (e.g., an LFO oscillator → `gain.gain` for tremolo). This returns `undefined`, not a node — you can't chain from it.

> The graph is a **DAG** (directed acyclic graph). The only allowed cycles are **delay-based feedback loops** (a cycle that doesn't pass through a `DelayNode` is illegal and silently breaks).

---

## 2. MIDI in Web Apps

MIDI is a **hardware protocol + message format** for musical instruments. The **Web MIDI API** exposes connected MIDI controllers to JavaScript. It is **completely separate** from Web Audio — MIDI gives you *events* ("note 60 pressed, velocity 80"); you decide how to turn those into *sound* (typically by driving a sampler or synth via Web Audio).

### 2.1 Web MIDI API — `navigator.requestMIDIAccess()`

```ts
async function initMidi(): Promise<boolean> {
  if (!navigator.requestMIDIAccess) return false;       // not supported
  const access = await navigator.requestMIDIAccess({ sysex: false });
  access.inputs.forEach(input => {
    input.onmidimessage = (e) => handleMidi(e.data);
  });
  access.onstatechange = () => { /* device plugged/unplugged */ };
  return true;
}
```

- `requestMIDIAccess({ sysex })` — `sysex: true` requires a more prominent permission prompt (needed for SysEx bulk dumps; set `false` for normal note/controller input).
- Returns a `MIDIAccess` object with `.inputs` and `.outputs` (both `Map`s).
- **Re-bind `onmidimessage` on `statechange`** — hot-plugging a keyboard adds a new `MIDIInput` you must subscribe to.

### 2.2 MIDI message format

A MIDI message is 1–3 bytes:

| Byte | Meaning |
|---|---|
| Byte 0 | **Status byte** — high nibble = command, low nibble = channel (0–15) |
| Byte 1 | Data 1 — usually **note number** (0–127, where 60 = middle C / C4) |
| Byte 2 | Data 2 — usually **velocity** (0–127) |

```ts
function handleMidi(data: Uint8Array) {
  const [status, note, velocity] = data;
  const command = status & 0xf0;   // top nibble
  const channel = status & 0x0f;   // bottom nibble
  // ...
}
```

Common commands:

| Command | Hex | Meaning |
|---|---|---|
| Note Off | `0x80`–`0x8F` | Release note; velocity = release speed |
| Note On | `0x90`–`0x9F` | Press note; **velocity 0 means Note Off** (very common) |
| Control Change (CC) | `0xB0`–`0xBF` | Pedals, knobs, mod wheel (e.g., CC 64 = sustain pedal) |
| Program Change | `0xC0`–`0xCF` | Switch instrument (0–127, General MIDI) |
| Pitch Bend | `0xE0`–`0xEF` | 14-bit bend (two data bytes, LSB + MSB) |

> 🐛 **Note number convention**: in the MIDI spec middle C is C3 (Yamaha convention), but in most DAWs and in Web Audio/General MIDI contexts it's **C4 = note 60**. smplr and Tone.js both treat 60 as C4. Pick one convention and stick to it.

### 2.3 Note On (0x90) vs Note Off (0x80) — and the velocity-0 trick

```ts
const command = status & 0xf0;

if (command === 0x90 && velocity > 0) {
  noteOn(note, velocity);
} else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
  noteOff(note);
}
```

**You MUST handle both Note Off forms:**
- `0x80` explicit Note Off, and
- `0x90` Note On with **velocity === 0** (most modern keyboards use this to save a status byte — "running status").

If you only check `0x80`, notes will hang on many controllers.

### 2.4 Parsing MIDI input — full pattern

```ts
const heldNotes = new Map<number, { velocity: number; startedAt: number }>();

function handleMidiMessage(e: WebMidi.MIDIMessageEvent) {
  if (!e.data || e.data.length < 2) return;     // some messages are 1 byte
  const [status, data1, data2] = e.data;
  const command = status & 0xf0;

  switch (command) {
    case 0x90:
      if (data2 > 0) {
        heldNotes.set(data1, { velocity: data2, startedAt: performance.now() });
        noteOn(data1, data2);
      } else {
        heldNotes.delete(data1);
        noteOff(data1);
      }
      break;
    case 0x80:
      heldNotes.delete(data1);
      noteOff(data1);
      break;
    case 0xB0: // Control Change
      handleCC(data1, data2);
      break;
    case 0xE0: // Pitch bend (14-bit)
      const bend = ((data2 << 7) | data1) - 8192; // -8192..+8191
      handlePitchBend(bend / 8192);
      break;
  }
}
```

### 2.5 Browser support

| Browser | Web MIDI support |
|---|---|
| Chrome | ✅ 43+ |
| Edge | ✅ 79+ (Chromium) |
| Opera | ✅ 30+ |
| Samsung Internet | ✅ 4+ |
| Firefox | ⚠️ 108+ (shipped, but historically gated; verify in your target version) |
| Safari (macOS) | ❌ Not supported |
| Safari/iOS | ❌ Not supported |

**Consequences:**
- Chrome/Edge now show a **permission prompt** for MIDI access (treat it like camera/mic). It must be triggered from a user gesture.
- For Safari/iOS, you need a **polyfill** (e.g. `WebMIDIAPIShim` + Jazz plugin, or a custom bridge) — or, more realistically, provide an **on-screen keyboard fallback** so the feature degrades gracefully.
- Always feature-detect: `if (!navigator.requestMIDIAccess) { /* fallback */ }`.

### 2.6 Polyphony — handling multiple simultaneous notes

MIDI is inherently polyphonic: the keyboard fires independent Note On/Off events. Your sound engine must keep a **voice per held note**. The standard approach is a `Map<noteNumber, voice>`:

```ts
const voices = new Map<number, { stop: () => void }>();

function noteOn(note: number, velocity: number) {
  // If already held (re-trigger), stop the old voice first
  voices.get(note)?.stop();
  const stop = instrument.start({ note, velocity, duration: Infinity });
  voices.set(note, { stop });
}

function noteOff(note: number) {
  const voice = voices.get(note);
  if (voice) {
    voice.stop();          // begin release
    voices.delete(note);
  }
}
```

If using **smplr**, `start()` returns a per-note `stop` function — perfect for this. If using **Tone.js Sampler**, use `triggerAttack(note, time, velocity)` (returns nothing; pair with `triggerRelease(note)` on Note Off) instead of `triggerAttackRelease` for keyboard-style held notes.

### 2.7 MIDI vs Web Audio — how they relate

| | MIDI | Web Audio |
|---|---|---|
| What it is | A protocol for **events** | An engine for **sound** |
| Layer | Control / input | DSP / output |
| Latency | Event delivery (a few ms) | Audio block (2–10 ms) |
| Owns sound? | No — it's just messages | Yes |
| Typ. use | "User pressed key 60" | "Play this sample at 440 Hz" |

**MIDI is the input; Web Audio is the output.** A MIDI Note On becomes a `Soundfont.start({note:60})` or a `triggerAttack()` call. The MIDI layer should **never** own AudioNodes — it should hand notes to the audio engine, which owns the graph.

---

## 3. Soundfonts in Web

A **soundfont** is a collection of pre-recorded samples mapped to MIDI notes and velocities. Instead of synthesizing a piano from oscillators, you play back a recording of a real piano. There are two relevant formats:

### 3.1 Soundfont formats

- **SF2 (SoundFont 2)** — the classic binary format (`.sf2`). Banks of samples with loop points, velocity layers, etc. FluidR3_GM.sf2 is the famous General MIDI bank (148 MB). Reading SF2 in-browser is heavy; libraries like `smplr`'s `Soundfont2` class or `spessasynth` can do it.
- **DLS (Downloadable Sounds)** — Microsoft's equivalent; rare on the web.
- **Pre-rendered per-instrument JS/JSON** — the pragmatic web approach (see §3.3): each instrument is a JS file mapping note names → base64 MP3 data URIs. This is what `gleitz/midi-js-soundfonts` provides and what `smplr` consumes by default.

### 3.2 smplr — the modern web sampler

[`smplr`](https://github.com/danigb/smplr) is a collection of sampled instruments for Web Audio with **no setup required** — samples are fetched from a CDN (`smpldsnds.github.io` and `gleitz.github.io`). It ships ~11 instrument factories: `Soundfont`, `SplendidGrandPiano`, `ElectricPiano`, `DrumMachine`, `Mallet`, `Mellotron`, `Smolken`, `Versilian`, `Soundfont2`, plus a generic `Sampler`.

```ts
import { Soundfont } from "smplr";

const ctx = new AudioContext();
const marimba = Soundfont(ctx, { instrument: "marimba" });
await marimba.ready;                       // wait for all samples
marimba.start({ note: 60, velocity: 80, duration: 0.8 });
```

#### How the `Soundfont` factory works

`Soundfont(ctx, options)` returns an instrument instance. Key options (all shared across smplr instruments):

| Option | Type | Default | Notes |
|---|---|---|---|
| `instrument` | `string` | — | GM instrument name, e.g. `"marimba"`, `"acoustic_grand_piano"` |
| `kit` | `string` | `"MusyngKite"` | `"MusyngKite"` (better, heavier) or `"FluidR3_GM"` (lighter) |
| `destination` | `AudioNode` | `ctx.destination` | **Where the instrument's audio goes.** This is how you route through your own gain node. |
| `volume` | `number` | `100` | 0–127 (MIDI volume scale) |
| `pan` | `number` | `0` | -1 to +1 |
| `storage` | `Storage` | `HttpStorage` | Use `CacheStorage()` to cache decoded samples (see §3.6) |
| `onLoadProgress` | `fn` | — | `{ loaded, total }` for progress bars |
| `loadLoopData` | `boolean` | `false` | Enable sustained-note looping (experimental) |

#### The `destination` option — THE way to route smplr (not `output.connect`)

This is the single most important smplr concept and the source of the most common bug:

> **smplr instruments are configured with a `destination` AudioNode at construction time.** The instrument writes its audio to that node. There is **no** `instrument.output.connect(target)` API.

```ts
// ✅ CORRECT — pass your gain node as `destination`
const melodyGain = ctx.createGain();
melodyGain.connect(masterGain);

const marimba = Soundfont(ctx, {
  instrument: "marimba",
  destination: melodyGain,   // <-- smplr routes audio here
});
```

If you need to **change** the destination later, you generally **recreate the instrument** (or use smplr's `output.addEffect` for insert/send effects). Don't try to reconnect `instrument.output` — see §3.4.

#### `start()` / `stop()` — playing notes

```ts
// start() returns a per-note stop function
const stopNote = piano.start({ note: 60, velocity: 80, time: ctx.currentTime, duration: 1.0 });
// ...later:
stopNote({ time: ctx.currentTime + 0.5 });   // stop early at a scheduled time

// Or stop by id (defaults to the note value):
piano.stop();        // stop ALL notes
piano.stop(60);      // stop all notes started with note: 60
piano.stop("C4");
```

- `note` accepts a MIDI number (`60`) or a note name (`"C4"`).
- `velocity` is 0–127.
- `time` and `duration` are **seconds** against `ctx.currentTime` (sample-accurate scheduling).
- `duration` schedules an automatic stop; omit it (or pass `Infinity`) for a held note you stop manually.

#### `ready` / loading progress

```ts
await piano.ready;                  // resolves when ALL samples loaded
console.log(piano.loadProgress);    // { loaded: 12, total: 48 }
```

You can call `start()` **before** `ready` — it plays as soon as that specific note's sample is decoded. But for a guaranteed-clean experience, `await ready`.

### 3.3 The `output` property — `OutputChannel`, NOT an `AudioNode`

smplr instruments expose an `output` property. **It is not an AudioNode.** It is an `OutputChannel` object that wraps the instrument's internal gain/effect routing:

```ts
piano.output.volume = 80;                              // getter/setter, 0–127 (MIDI volume)
piano.output.addEffect("reverb", Reverb(ctx), 0.2);    // add a send-bus effect, mix 0–1
piano.output.setEffectMix("reverb", 0.5);              // change the wet/dry mix later
```

- **`output.volume`** is the instrument's **global** volume (0–127 MIDI scale, not linear gain). It uses the MIDI volume curve by default.
- **`output.addEffect(name, effectNode, mix)`** creates a **post-fader send bus**: the signal is tapped *after* `output.volume`, so turning volume down reduces the send too.
- ❌ **There is no `output.connect()` method.** `output` is not a node; it manages an internal graph. To route the instrument externally, use the `destination` option (§3.2).

> 🐛 **Found in codebase** (`src/lib/game/soundfont-manager.ts`): the dispose path calls `ch.instrument.output.disconnect()`. This is wrong on two counts: (1) `output` is an `OutputChannel`, not an AudioNode, so it has no `disconnect()`; (2) in smplr 1.0+ the lifecycle method was **renamed `disconnect()` → `dispose()`**. The correct call is `ch.instrument.dispose()`.

### 3.4 Lifecycle: `dispose()`, not `disconnect()`

smplr 1.0 renamed several APIs (see `MIGRATE.md`):

| Old (pre-1.0) | New (1.0+) |
|---|---|
| `new SplendidGrandPiano(ctx)` | `SplendidGrandPiano(ctx)` (drop `new`) |
| `await x.load` | `await x.ready` |
| `output.setVolume(n)` | `output.volume = n` |
| `output.sendEffect(name, mix)` | `output.addEffect(name, effect, mix)` |
| **`disconnect()`** | **`dispose()`** |
| `Soundfont2Sampler` | `Soundfont2` |

`dispose()` stops all voices, tears down the internal audio graph, and stops the scheduler. **The instance must not be used after `dispose()`** — calling `start()` on a disposed instrument silently does nothing or throws.

```ts
// ✅ Correct teardown
function switchInstrument(channel, newId) {
  if (channel.instrument) {
    channel.instrument.dispose();   // NOT .output.disconnect()
    channel.instrument = null;
  }
  channel.instrument = Soundfont(ctx, { instrument: newId, destination: channel.gain });
}
```

### 3.5 Tone.js Sampler — the other common approach

Tone.js provides a `Sampler` that loads individual sample files (one or a few per instrument) and **pitch-shifts** them across the keyboard. The classic web piano is the **Salamander Grand Piano** (Yamaha C5), distributed as ~4 sample files.

```ts
import * as Tone from 'tone';

const piano = new Tone.Sampler({
  urls: {
    "A0": "A0.mp3",
    "C1": "C1.mp3",
    "D#1": "Ds1.mp3",
    // ... a few anchor notes; Tone pitch-shifts the rest
    "A4": "A4.mp3",
    "C8": "C8.mp3",
  },
  baseUrl: "https://tonejs.github.io/audio/salamander/",
  onload: () => console.log("piano ready"),
}).toDestination();

// Trigger a note
piano.triggerAttackRelease("C4", 0.8, undefined, 0.7);  // note, duration, time, velocity(0-1)

// For held (keyboard) notes:
piano.triggerAttack("C4", undefined, 0.7);
// ...later:
piano.triggerRelease("C4");
```

- `urls` maps a **note name** (or MIDI number) to a sample file. Tone pitch-shifts neighboring notes from the nearest sample.
- `baseUrl` is prepended to each url.
- `triggerAttackRelease(note, duration, time, velocity)` — note can be name or MIDI number; velocity is **0–1** (not 0–127 like MIDI/smplr — a common source of off-by-127 bugs).
- `toDestination()` connects to `Tone.getDestination()`. To route through your own chain, use `.chain(filter, gain)` or `.connect(node)`.
- `Tone.start()` **must be called from a user gesture** before any sound (it resumes the internal context).

#### smplr vs Tone.js Sampler — when to use which

| | smplr `Soundfont` | Tone.js `Sampler` |
|---|---|---|
| Sample source | gleitz GM CDN (many instruments) | Your own / Salamander CDN |
| # of files loaded | One per note (~88–226 per instrument) | A few anchor notes (~4–22) |
| Velocity layers | Yes (FluidR3/MusyngKite) | Only if you provide them |
| Instrument variety | 128 GM instruments, switchable | One instrument per Sampler instance |
| Routing | `destination` option at construction | `.connect()` / `.chain()` (it's a Tone node) |
| Best for | User-selectable GM instruments | A single high-quality piano/keys |
| Rate-limiting risk | Higher (many small fetches from GH Pages) | Lower (fewer fetches) |

**Practical pattern:** Use Tone.js `Sampler` for your always-on piano (fewer requests, high quality), and smplr `Soundfont` for user-selectable alternate instruments. This is exactly the hybrid the codebase uses.

### 3.6 gleitz/midi-js-soundfonts CDN

[github.com/gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) hosts pre-rendered General MIDI soundfonts. smplr's `Soundfont` class fetches from here by default.

**URL pattern:**
```
https://gleitz.github.io/midi-js-soundfonts/{KIT}/{instrument}-mp3.js
```

**File format** — each file is a JS file that assigns a global object mapping note names → base64 MP3 data URIs:

```js
// https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/marimba-mp3.js
if (typeof(MIDI) === 'undefined') var MIDI = {};
if (typeof(MIDI.Soundfont) === 'undefined') MIDI.Soundfont = {};
MIDI.Soundfont.marimba = {
  "A0": "data:audio/mp3;base64,//uQZAAAAAAAA...",
  "A#0": "data:audio/mp3;base64,//uQZ...",
  // ... one entry per note across the keyboard
}
```

smplr fetches this JS, extracts the data URIs, and decodes each into an `AudioBuffer`. (You generally don't touch this format directly — smplr does it for you.)

#### Kits: FluidR3_GM vs MusyngKite

| Kit | Source | Size (uncompressed) | Sound | smplr default? |
|---|---|---|---|---|
| `FluidR3_GM` | FluidR3_GM.sf2 | ~148 MB | Good, standard GM | No |
| `MusyngKite` | Musyng Kite.sfpack | ~1.75 GB | **Better** (more velocity layers) | **Yes** |
| `FatBoy` | FatBoy.sf2 | ~320 MB | Alternate, fuller | No |

```ts
// MusyngKite (default) — better, but heavier samples (slower load)
const a = Soundfont(ctx, { instrument: "marimba" });

// FluidR3_GM — lighter, faster to load
const b = Soundfont(ctx, { instrument: "marimba", kit: "FluidR3_GM" });
```

> ⚠️ Because the samples are hosted on **GitHub Pages**, you can hit **per-second rate limits**, especially during dev with hot reload. Use `CacheStorage()` (below) or self-host/mirror the files.

### 3.7 Loading times & caching with `CacheStorage`

smplr offers a `CacheStorage` backend built on the browser **Cache API**:

```ts
import { SplendidGrandPiano, CacheStorage } from "smplr";

const storage = CacheStorage();
const piano = SplendidGrandPiano(ctx, { storage });
// First load: fetches + decodes from network. Subsequent loads: serves from cache.
```

- First load decodes every sample (CPU + network). Subsequent loads (same browser) pull decoded buffers from the Cache API — **much** faster.
- The Cache API **only works over HTTPS** (and `localhost`). In dev with plain HTTP you'll get errors — use `next-dev-https`, `vite-plugin-mkcert`, or run behind a local HTTPS proxy.
- For **cross-instrument** buffer sharing, pass a shared `SampleLoader` to multiple instruments:

```ts
import { SplendidGrandPiano, Soundfont, SampleLoader } from "smplr";
const loader = SampleLoader(ctx);   // shared cache of decoded buffers
const piano = SplendidGrandPiano(ctx, { loader, storage });
const marimba = Soundfont(ctx, { instrument: "marimba", loader, storage });
```

### 3.8 Self-hosting / mirroring samples

If GitHub Pages rate limits bite you, mirror the samples to your own static host and override the base URL:

```ts
// Soundfont: pass a custom instrumentUrl
const marimba = Soundfont(ctx, {
  instrumentUrl: "https://cdn.yoursite.com/soundfonts/FluidR3_GM/marimba-mp3.js",
});

// SplendidGrandPiano: override baseUrl
const piano = SplendidGrandPiano(ctx, { baseUrl: "https://cdn.yoursite.com/piano/" });
```

---

## 4. Audio Routing Best Practices

### 4.1 The canonical mixer topology

For a game with multiple instruments (melody, bass, pad, chord) + master effects, use this graph:

```
melody ─┐
bass   ─┤
pad    ─┼─► [per-channel GainNode] ──► masterGain ──► masterFilter ──► compressor ──► analyser ──► destination
chord  ─┤                                          │
       │                                          ├─► reverbBus ──► convolver ──┐
       └──────────── (sends) ─────────────────────┘                              │
       └──────────── (sends) ──► delayBus ──► delayNode ─► feedback ─┐           │
                                                                    └─► masterGain ◄┘
```

Rules:
- **Every instrument gets its own per-channel GainNode** for independent volume.
- All channel gains sum into **one `masterGain`** (post-fader master volume).
- Master effects (filter, compressor, analyser) sit on the master chain after `masterGain`.
- **Reverb and delay are sends**, not inserts: tap the post-channel signal into `reverbBus`/`delayBus`, process, and return to `masterGain`. This lets one reverb serve all instruments and lets you set per-instrument send levels.

### 4.2 Post-fader volume control — gain at the END

**Put the volume-control gain node at the END of a channel's chain, not the start.** "Post-fader" means the gain sits after the instrument's own output, so it scales the final signal (including any per-instrument processing) and any sends you tap *before* it still reflect the instrument's full level.

```ts
// ✅ instrument → channelGain (post-fader) → master
const channelGain = ctx.createGain();
channelGain.gain.value = 0.7;
const inst = Soundfont(ctx, { instrument: "marimba", destination: channelGain });
channelGain.connect(masterGain);

// Tap a reverb send from the instrument's full-level signal:
// (with smplr, use output.addEffect; with raw nodes, connect inst source → reverbBus)
```

With smplr specifically: since you pass `destination: channelGain`, the instrument's internal volume (`output.volume`, 0–127) is the **pre-fader** per-instrument level, and `channelGain` is the **post-fader** mix level. Both are useful; don't conflate them.

### 4.3 Pre-fader vs post-fader sends

- **Post-fader send**: tapped *after* the channel fader. When you turn the channel down, the send goes down too (the reverb "follows" the instrument). This is what you usually want.
- **Pre-fader send**: tapped *before* the channel fader. Turning the channel down leaves the reverb tail intact. Useful for "send a lot of reverb to a quiet sound" effects.

smplr's `output.addEffect` is explicitly **post-fader** (documented). If you need pre-fader, you must build it with raw nodes and route the instrument to your own pre-gain tap via the `destination` option.

### 4.4 Preserving stereo through gain nodes

**A GainNode preserves stereo by default.** Its defaults are `channelCount: 2`, `channelCountMode: "max"`, `channelInterpretation: "speakers"`. With `"max"` mode, the node adapts its channel count to the **maximum** of all connected inputs — so stereo in → stereo out, and summing multiple stereo sources into one gain keeps stereo.

You only lose stereo (sum to mono) if you **explicitly** misconfigure a node:

```ts
// ❌ This forces the gain to 1 channel → down-mixes stereo to mono!
const bad = ctx.createGain();
bad.channelCount = 1;
bad.channelCountMode = "explicit";

// ✅ Leave defaults — stereo is preserved
const good = ctx.createGain();
```

The real-world bug is usually one of:
1. Someone set `channelCount = 1` / `channelCountMode = "explicit"` on a shared bus thinking it was required for "mono compatibility".
2. A `StereoPannerNode` (which uses `clamped-max`, clamped to 2) is connected into a node that's been pinned to 1 channel — the panner's stereo output gets down-mixed.

> 🐛 **Found in codebase** (`src/lib/game/audio.ts`): comments document that panners were originally connected through `padGain` and summed to mono. The fix applied — connecting the `StereoPannerNode`s **directly to `masterGain`** (which is at default channel settings) — restored stereo. The root cause was a node in the chain forcing mono. **Rule: never set `channelCount`/`channelCountMode` on a gain bus unless you have a specific reason; leave them at default to preserve stereo.**

### 4.5 Mute vs destroy vs suspend — the lifecycle decision

This is the most consequential design choice for a game. There are three ways to "stop" audio, and they have very different costs:

| Approach | What happens | When to use | When NOT to use |
|---|---|---|---|
| **Mute** (`masterGain.gain = 0`) | Graph keeps running; nodes stay alive; samples stay decoded; Tone.js clock keeps ticking. Instant on/off. | Pausing between rounds, muting music, hiding UI. **Default choice.** | Long idle periods (wastes CPU). |
| **Suspend** (`ctx.suspend()`) | Audio thread halted; `currentTime` stops; **breaks Tone.js transport & smplr scheduler**. | Tab hidden for a long time (and you can recover). | Almost never in a game — see §6.1. |
| **Dispose/destroy** (`instrument.dispose()`) | Nodes torn down; samples may be re-fetched; context stays alive. | Permanently removing an instrument. | Temporary stops — you'll pay load cost again. |

> 🐛 **Found in codebase** (`src/lib/game/audio.ts`): the `stop()` method correctly documents **"DON'T suspend the AudioContext — just mute via masterGain=0 (suspending breaks Tone.js piano and soundfonts on resume)"** and **"DON'T dispose soundfontManager — just mark as not running"**. This is the right pattern. Keep it.

```ts
// ✅ Pause = mute (graph stays alive, instruments stay loaded)
function pause() {
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(0, t + 0.3);  // gentle fade
}

// ✅ Resume = unmute
function resume() {
  if (ctx.state === 'suspended') ctx.resume();          // only if browser suspended it
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.linearRampToValueAtTime(0.7, t + 0.5);
}
```

---

## 5. Instrument / Channel Management

### 5.1 One gain node per instrument

Each instrument (melody, bass, pad, chord) needs its **own** GainNode so you can control its volume independently:

```ts
class Channel {
  gain: GainNode;
  instrument: any = null;
  name = '';
  ready = false;
  loading = false;

  constructor(ctx: AudioContext, master: GainNode, initialVolume = 1.0) {
    this.gain = ctx.createGain();
    this.gain.gain.value = initialVolume;
    this.gain.connect(master);   // post-fader into master
  }
}
```

This is what `SoundfontManager` in the codebase models — and it's correct. The per-channel gain is the **mixer fader**; the instrument's internal `output.volume` (0–127) is a secondary trim.

### 5.2 Per-channel soundfont loading & caching

Load instruments **lazily** on first use (or on user selection), and **cache** the loaded instance so you don't re-fetch:

```ts
async function loadInstrument(ch: Channel, instrumentId: string) {
  if (ch.loading) return false;                  // guard against double-load
  if (ch.name === instrumentId && ch.ready) return true;  // already loaded

  ch.loading = true;
  ch.ready = false;

  // Dispose the OLD instrument before creating a new one
  ch.instrument?.dispose();                      // NOT .output.disconnect()
  ch.instrument = null;

  if (instrumentId === '') { ch.name=''; ch.loading=false; return true; }

  try {
    ch.instrument = Soundfont(ctx, {
      instrument: instrumentId,
      destination: ch.gain,                       // route to THIS channel's gain
      kit: 'FluidR3_GM',                          // lighter kit = faster load
    });
    await ch.instrument.ready;
    ch.name = instrumentId;
    ch.ready = true;
    return true;
  } catch (e) {
    console.warn(`load failed: ${instrumentId}`, e);
    ch.loading = false;
    return false;
  } finally {
    ch.loading = false;
  }
}
```

> 🐛 **Found in codebase**: `SoundfontManager.loadInstrument` and `dispose` call `ch.instrument.output.disconnect()`. Replace both with `ch.instrument.dispose()`. The current code silently fails to tear down old instruments (because `output.disconnect` is a no-op on the `OutputChannel`), which can leak schedulers and cause ghost notes / duplicate audio graphs.

### 5.3 Switching instruments live (dispose old, load new)

When the user picks a new instrument for a channel:

1. **Stop** any in-flight notes on the old instrument (`old.stop()`).
2. **Dispose** the old instrument (`old.dispose()`).
3. **Create** the new one with `destination` pointing at the same channel gain (the gain node is reused — only the instrument instance changes).
4. **Await** `ready` before reporting the channel as playable.
5. Guard against rapid re-selection with a `loading` flag and/or a request-id token so a stale load doesn't clobber a newer one.

```ts
let loadToken = 0;
async function switchInstrument(ch: Channel, id: string) {
  const myToken = ++loadToken;
  ch.instrument?.stop();
  ch.instrument?.dispose();
  ch.instrument = null;
  ch.ready = false;
  const inst = Soundfont(ctx, { instrument: id, destination: ch.gain });
  await inst.ready;
  if (myToken !== loadToken) { inst.dispose(); return; }  // superseded
  ch.instrument = inst;
  ch.ready = true;
}
```

### 5.4 Fallback chains (soundfont → piano → synth)

Networks fail, CDNs rate-limit, browsers block. Always have a fallback chain so the game is never silent:

```ts
async function getVoice(ctx: AudioContext, dest: AudioNode): Promise<Voice> {
  // Tier 1: smplr soundfont (real sampled instrument)
  try {
    const sf = Soundfont(ctx, { instrument: 'acoustic_grand_piano', destination: dest });
    await Promise.race([sf.ready, timeout(4000)]);   // don't hang forever
    if (sf.loadProgress.loaded > 0) return { kind: 'soundfont', inst: sf };
    sf.dispose();
  } catch (e) { /* fall through */ }

  // Tier 2: Tone.js Sampler + Salamander (fewer files, very reliable)
  try {
    const sampler = new Tone.Sampler({
      urls: { A4: 'A4.mp3', C4: 'C4.mp3' },
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
    }).connect(dest);
    await Tone.loaded();
    return { kind: 'sampler', inst: sampler };
  } catch (e) { /* fall through */ }

  // Tier 3: pure synth (no network needed — always works)
  return makeSynthVoice(ctx, dest);   // OscillatorNode + GainNode + envelope
}
```

> 🐛 **Found in codebase**: `audio.ts` already layers a Tone.js Salamander piano (tier 2) as the always-on melody voice, with smplr `Soundfont` as an optional user-selected override (tier 1). The synth pad/bass (tier 3) is always present underneath. This three-tier resilience is the right architecture — keep it, but make sure the **synth fallback is actually reachable** if both CDN loads fail.

---

## 6. Common Pitfalls

### 6.1 Suspending the AudioContext breaks Tone.js

`ctx.suspend()` halts the audio thread and **freezes `currentTime`**. Tone.js's `Transport`, `Draw`, and `Clock` all advance time on the audio thread; when you suspend the raw context underneath Tone, its transport desyncs, scheduled events never fire, and on `resume()` you can get a burst of stale events or a dead transport.

**Fix:** Never suspend the context Tone is using. To "pause" music, mute via `masterGain.gain = 0` (or `Tone.Transport.pause()` if you only want to stop sequencing). Only `ctx.suspend()` when the whole tab is being backgrounded *and* you can re-`resume()` from a user gesture.

> 🐛 **Found in codebase**: `audio.ts` documents this exact lesson. Keep `ctx.suspend()` out of the pause path.

### 6.2 Disposing nodes that are still in use

`instrument.dispose()` tears down the internal graph and stops the scheduler. Calling `start()` on a disposed instrument is undefined (usually silent failure). Common ways this bites:

- Disposing an instrument on "pause" then trying to play on "resume".
- Disposing a shared `SampleLoader`/`storage` while other instruments still reference it.
- Calling `dispose()` in a React `useEffect` cleanup that fires on every re-render.

**Fix:** Only dispose when the instrument is being **replaced or permanently removed**. For temporary stops, use `instrument.stop()` (stops all notes) + mute the channel gain.

### 6.3 Not resuming AudioContext after a user gesture

The context starts suspended. If you create it on page load and immediately try to play, you get silence and a console warning: *"The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page."*

**Fix:** Gate first-audio behind the first user interaction (a "Start" / "Tap to play" button, or the first canvas click). Create or resume the context *inside* that handler.

```ts
let audioReady = false;
async function ensureAudio() {
  if (audioReady) return;
  if (ctx.state === 'suspended') await ctx.resume();
  await Tone.start();        // also resume Tone's context
  audioReady = true;
}
canvas.addEventListener('pointerdown', ensureAudio, { once: true });
```

### 6.4 Trying to connect smplr's `output` (it's an `OutputChannel`, not an AudioNode)

```ts
// ❌ output is NOT an AudioNode — no connect(), no disconnect()
instrument.output.connect(myGain);
instrument.output.disconnect();

// ✅ Use the `destination` option at construction
const inst = Soundfont(ctx, { instrument, destination: myGain });
// ✅ For effects, use output.addEffect
inst.output.addEffect('reverb', reverbNode, 0.3);
// ✅ For teardown, use dispose()
inst.dispose();
```

> 🐛 **Found in codebase** (`soundfont-manager.ts`): the dispose path calls `ch.instrument.output.disconnect()`. Fix to `ch.instrument.dispose()`.

### 6.5 Nesting async soundfont loading inside conditionals

```ts
// ❌ Fragile — easy to lose the reference, race with re-entrancy, or skip awaiting
async function maybeLoad(id: string) {
  if (shouldLoad) {
    const inst = Soundfont(ctx, { instrument: id });
    await inst.ready;            // if this throws, state is half-updated
    channel.instrument = inst;   // assignment happens AFTER await — re-entry hazard
  }
}
```

Problems: (a) `channel.instrument` is assigned only after the await, so a second call mid-load sees `null` and double-loads; (b) an error leaves `loading=true` forever; (c) the `if` makes it easy to skip the cleanup of the old instrument.

**Fix:** Flatten the flow, guard with a `loading` flag + a request token, assign the reference optimistically, and use try/finally:

```ts
async function load(ch: Channel, id: string) {
  if (ch.loading || (ch.name === id && ch.ready)) return;
  ch.loading = true;
  const token = ++ch.loadToken;
  ch.instrument?.dispose();
  try {
    const inst = Soundfont(ctx, { instrument: id, destination: ch.gain });
    ch.instrument = inst;                  // assign early so it can pre-play
    await inst.ready;
    if (token !== ch.loadToken) { inst.dispose(); return; }
    ch.name = id; ch.ready = true;
  } catch (e) {
    console.warn('load failed', e);
  } finally {
    ch.loading = false;
  }
}
```

### 6.6 Losing loaded instruments on game restart

If the audio engine is recreated on every game/restart (e.g., a React component remounts and `new MusicEngine()` runs), you re-fetch and re-decode every sample — slow and wasteful.

**Fix:** Lift the audio engine and the soundfont cache **outside** the component/restart lifecycle. Use a module-level singleton, a React context, or a ref that survives remounts:

```ts
// audio-engine.ts — module singleton, survives HMR & remounts
let _engine: MusicEngine | null = null;
export function getEngine() {
  if (!_engine) _engine = new MusicEngine();
  return _engine;
}

// In a component:
const engine = getEngine();   // stable across restarts
useEffect(() => () => engine.stop(), []);  // stop, don't destroy
```

Also use `CacheStorage()` so even if a fresh instrument *is* created, decoded buffers come from the browser cache instantly.

### 6.7 Stereo panners summing to mono through shared gain nodes

See §4.4. The fix is to **leave GainNodes at their default channel settings** and connect `StereoPannerNode`s downstream into nodes that preserve ≥2 channels. Don't route a panner into a gain you've pinned to `channelCount: 1`.

> 🐛 **Found in codebase**: panners were routed through `padGain` and summed to mono; the applied fix routes them straight to `masterGain`. Make sure no future refactor re-introduces a mono-pinned node between any panner and the master.

### 6.8 Other recurring gotchas

- **Velocity scale mismatch:** MIDI & smplr use 0–127; Tone.js `Sampler` uses 0–1. Always convert: `velocity01 = midiVel / 127`.
- **Note-number convention:** confirm 60 = C4 everywhere (smplr/Tone do). Off-by-octave bugs come from mixing C3/C4 conventions.
- **GitHub Pages rate limits:** smplr's default CDN throttles rapid fetches. Use `CacheStorage()` or self-host.
- **HTTPS required for Cache API:** dev on plain HTTP breaks `CacheStorage`. Use a local HTTPS dev server.
- **`triggerAttackRelease` with no duration** hangs a Tone Sampler note. For keyboard input use `triggerAttack` + `triggerRelease`.
- **Forgetting `Tone.start()`** before first sound — must be in a user gesture.
- **Hot-plugged MIDI devices** — re-bind `onmidimessage` in the `statechange` handler, not just at init.
- **`exponentialRampToValueAtTime` to/from 0** — throws/NaN. Use 0.0001, or use `linearRamp`/`setTargetAtTime` for fades to silence.

---

## 7. Code Patterns

### 7.1 Proper async instrument loading pattern

```ts
import { Soundfont, CacheStorage } from 'smplr';

interface Channel {
  gain: GainNode;
  instrument: ReturnType<typeof Soundfont> | null;
  name: string;
  ready: boolean;
  loading: boolean;
  loadToken: number;
}

class AudioGraph {
  private ctx: AudioContext;
  private master: GainNode;
  private channels: Record<string, Channel>;
  private storage = CacheStorage();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    this.channels = {};
    for (const name of ['melody', 'bass', 'pad', 'chord']) {
      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      gain.connect(this.master);
      this.channels[name] = { gain, instrument: null, name: '', ready: false, loading: false, loadToken: 0 };
    }
  }

  async load(channel: string, instrumentId: string): Promise<boolean> {
    const ch = this.channels[channel];
    if (!ch) return false;
    if (ch.loading) return false;
    if (ch.name === instrumentId && ch.ready) return true;

    ch.loading = true; ch.ready = false;
    const token = ++ch.loadToken;

    // Teardown old (correct API!)
    ch.instrument?.dispose();
    ch.instrument = null;

    if (!instrumentId) { ch.name = ''; ch.loading = false; return true; }

    try {
      const inst = Soundfont(this.ctx, {
        instrument: instrumentId,
        destination: ch.gain,           // route into THIS channel's gain
        kit: 'FluidR3_GM',
        storage: this.storage,          // cache decoded buffers
      });
      ch.instrument = inst;
      await inst.ready;
      if (token !== ch.loadToken) { inst.dispose(); return false; }  // superseded
      ch.name = instrumentId;
      ch.ready = true;
      return true;
    } catch (e) {
      console.warn(`[audio] load ${instrumentId} failed:`, e);
      return false;
    } finally {
      ch.loading = false;
    }
  }

  play(channel: string, midi: number, velocity = 0.7, duration = 0.8): boolean {
    const ch = this.channels[channel];
    if (!ch?.ready || !ch.instrument) return false;
    ch.instrument.start({ note: midi, velocity: Math.round(velocity * 127), duration });
    return true;
  }

  setVolume(channel: string, v: number) {
    const ch = this.channels[channel]; if (!ch) return;
    ch.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);  // click-free
  }

  disposeAll() {
    for (const ch of Object.values(this.channels)) {
      ch.instrument?.dispose();
      ch.instrument = null;
      ch.ready = false; ch.name = '';
    }
  }
}
```

### 7.2 Proper stop/start lifecycle (mute, don't destroy)

```ts
class GameAudio {
  private ctx: AudioContext;
  private master: GainNode;
  private running = false;
  private targetMasterVolume = 0.7;

  constructor(ctx: AudioContext, graph: AudioGraph) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;                       // start silent
    this.master.connect(ctx.destination);
  }

  async start() {
    // Must be in a user gesture
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.running = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.targetMasterVolume, t + 1.5);
  }

  stop() {
    // MUTE — keep graph alive, keep instruments loaded, keep Tone ticking
    this.running = false;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.4);
  }

  // Only call this on true teardown (component unmount of the whole app)
  destroy() {
    this.stop();
    // dispose instruments here if needed
  }
}
```

### 7.3 Per-channel volume control pattern

```ts
// Each channel: instrument → channelGain (fader) → master
// channelGain is the USER-facing volume; instrument.output.volume is a trim.

function setChannelVolume(ctx: AudioContext, ch: Channel, v01: number) {
  // Use setTargetAtTime for click-free changes; 0 = silent, 1 = unity
  ch.gain.gain.setTargetAtTime(v01, ctx.currentTime, 0.03);
}

// Master volume (post-fader) — affects everything including reverb returns
function setMasterVolume(ctx: AudioContext, master: GainNode, v01: number) {
  master.gain.setTargetAtTime(v01, ctx.currentTime, 0.03);
}

// Mute a single channel without affecting its loaded instrument
function muteChannel(ctx: AudioContext, ch: Channel, muted: boolean) {
  ch.gain.gain.setTargetAtTime(muted ? 0 : ch.savedVolume, ctx.currentTime, 0.02);
}
```

### 7.4 MIDI keyboard integration pattern

```ts
import { Soundfont } from 'smplr';

class MidiKeyboard {
  private access: MIDIAccess | null = null;
  private held = new Map<number, () => void>();   // note -> stop fn
  private onNoteOn: (note: number, vel: number) => void;
  private onNoteOff: (note: number) => void;

  constructor(onNoteOn: (n: number, v: number) => void, onNoteOff: (n: number) => void) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
  }

  async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.warn('[midi] Web MIDI not supported — provide on-screen keyboard fallback');
      return false;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.bindInputs();
      this.access.onstatechange = () => this.bindInputs();   // hot-plug
      return true;
    } catch (e) {
      console.warn('[midi] access denied', e);
      return false;
    }
  }

  private bindInputs() {
    this.access?.inputs.forEach(input => {
      input.onmidimessage = (e) => this.handle(e);
    });
  }

  private handle(e: MIDIMessageEvent) {
    if (!e.data || e.data.length < 2) return;
    const [status, note, velocity] = e.data;
    const cmd = status & 0xf0;

    if (cmd === 0x90 && velocity > 0) {
      this.onNoteOn(note, velocity / 127);          // convert to 0–1
    } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      this.onNoteOff(note);
    }
    // (extend with 0xB0 CC, 0xE0 pitch bend as needed)
  }

  disconnect() {
    this.access?.inputs.forEach(i => { i.onmidimessage = null; });
    this.access = null;
  }
}

// Wire it to the audio graph (held-note style):
const midi = new MidiKeyboard(
  (note, vel01) => {
    // stop any existing voice for this note (re-trigger)
    midiHeld.get(note)?.();
    const stop = channel.instrument?.start({
      note, velocity: Math.round(vel01 * 127), duration: Infinity,
    });
    if (stop) midiHeld.set(note, stop);
  },
  (note) => {
    midiHeld.get(note)?.();      // begin release
    midiHeld.delete(note);
  },
);
```

### 7.5 Soundfont + synth fallback pattern

```ts
type Voice =
  | { kind: 'soundfont'; inst: ReturnType<typeof Soundfont> }
  | { kind: 'sampler'; inst: any }
  | { kind: 'synth'; play: (note: number, vel: number, dur: number) => void };

async function resolveVoice(ctx: AudioContext, dest: AudioNode): Promise<Voice> {
  // Tier 1: real sampled soundfont
  try {
    const sf = Soundfont(ctx, { instrument: 'acoustic_grand_piano', destination: dest });
    await Promise.race([sf.ready, timeout(4000)]);
    if (sf.loadProgress.loaded > 0) return { kind: 'soundfont', inst: sf };
    sf.dispose();
  } catch { /* fall through */ }

  // Tier 2: Tone.js Sampler (Salamander)
  try {
    const sampler = new Tone.Sampler({
      urls: { A0: 'A0.mp3', C4: 'C4.mp3', A4: 'A4.mp3', C8: 'C8.mp3' },
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
    }).connect(dest);
    await Tone.loaded();
    return { kind: 'sampler', inst: sampler };
  } catch { /* fall through */ }

  // Tier 3: pure synth — always works, no network
  return makeSynth(ctx, dest);
}

function makeSynth(ctx: AudioContext, dest: AudioNode): Voice {
  return {
    kind: 'synth',
    play: (note, vel, dur) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToFreq(note);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * 0.3, t + 0.01);    // 10ms attack
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);   // decay
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
  };
}

function timeout(ms: number) {
  return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
}
```

---

## 8. Appendix: Quick Reference Tables

### 8.1 smplr API quick reference (v1.0+)

| Operation | Code |
|---|---|
| Create | `const inst = Soundfont(ctx, { instrument, destination, kit, volume, pan, storage })` |
| Wait for load | `await inst.ready` |
| Progress | `inst.loadProgress` → `{ loaded, total }` |
| Play note | `const stop = inst.start({ note: 60, velocity: 80, duration: 1.0 })` |
| Stop one note | `stop()` or `inst.stop(60)` |
| Stop all | `inst.stop()` |
| Volume (0–127) | `inst.output.volume = 80` |
| Add effect (post-fader send) | `inst.output.addEffect('reverb', reverbNode, 0.3)` |
| Change effect mix | `inst.output.setEffectMix('reverb', 0.5)` |
| Sustain pedal | `inst.setCC(64, 127)` |
| Detune (cents) | `inst.setDetune(100)` |
| **Teardown** | `inst.dispose()` |

### 8.2 Web Audio node quick reference

| Node | Key params | Default channels | Purpose |
|---|---|---|---|
| `GainNode` | `gain` | 2 / max | Volume, mixing, fades |
| `StereoPannerNode` | `pan` (-1..1) | 2 / clamped-max | L/R pan |
| `BiquadFilterNode` | `type`, `frequency`, `Q` | 2 / max | EQ / tone |
| `ConvolverNode` | `buffer` (IR) | 2 / max | Reverb |
| `DelayNode` | `delayTime`, maxDelay | 2 / max | Echo / delay |
| `DynamicsCompressorNode` | `threshold`, `ratio`, `attack`, `release` | 2 / clamped-max | Limiting / glue |
| `AnalyserNode` | `fftSize`, `smoothingTimeConstant` | 1 / max | Visualization |
| `OscillatorNode` | `type`, `frequency` | 2 / max | Synth source |
| `AudioBufferSourceNode` | `buffer`, `loop`, `playbackRate` | 2 / max | Sample playback |

### 8.3 AudioParam scheduling quick reference

| Method | Signature | Notes |
|---|---|---|
| `setValueAtTime` | `(value, startTime)` | Anchor / hard step |
| `linearRampToValueAtTime` | `(value, endTime)` | Linear fade; safe through 0 |
| `exponentialRampToValueAtTime` | `(value, endTime)` | Natural fade; **value > 0 only** |
| `setTargetAtTime` | `(value, startTime, timeConstant)` | Smooth approach; best for live UI |
| `setValueCurveAtTime` | `(values, startTime, duration)` | Arbitrary curve from a Float32Array |
| `cancelScheduledValues` | `(cancelTime)` | Abort future automation |
| `cancelAndHoldAtTime` | `(cancelTime)` | Abort but hold current value |

### 8.4 Web MIDI message quick reference

| Command | Status range | Data 1 | Data 2 |
|---|---|---|---|
| Note Off | `0x80`–`0x8F` | note | release velocity |
| Note On | `0x90`–`0x9F` | note | velocity (**0 = Note Off**) |
| CC | `0xB0`–`0xBF` | controller | value |
| Program Change | `0xC0`–`0xCF` | program | — |
| Channel Pressure | `0xD0`–`0xDF` | pressure | — |
| Pitch Bend | `0xE0`–`0xEF` | LSB | MSB (14-bit) |

### 8.5 Decision checklist (paste into PR reviews)

- [ ] Is `AudioContext` resumed inside a user gesture before first sound?
- [ ] Is `Tone.start()` called (if using Tone.js)?
- [ ] Does pause **mute** (`masterGain.gain = 0`) rather than `ctx.suspend()`?
- [ ] Are instruments disposed with `.dispose()` (not `.output.disconnect()`)?
- [ ] Are smplr instruments routed via the `destination` option (not `output.connect`)?
- [ ] Does each instrument have its own per-channel GainNode?
- [ ] Are gain nodes left at default channel settings (no `channelCount: 1`)?
- [ ] Is the audio engine a singleton that survives game restarts?
- [ ] Is `CacheStorage()` enabled (over HTTPS)?
- [ ] Is there a fallback chain: soundfont → Tone Sampler → synth?
- [ ] Does MIDI handle both `0x80` and `0x90 velocity=0` Note Off?
- [ ] Are MIDI hot-plug devices re-bound on `statechange`?
- [ ] Is velocity converted correctly (MIDI 0–127 ↔ Tone 0–1)?
- [ ] Are volume changes using `setTargetAtTime` (click-free), not raw `.value =`?
- [ ] Are `exponentialRampToValueAtTime` targets always > 0?

---

### Sources verified during this research

- smplr README & MIGRATE.md — `github.com/danigb/smplr` (destination option, `output` OutputChannel, `dispose()` rename, `CacheStorage`, post-fader sends, kits)
- gleitz/midi-js-soundfonts README & live file inspection — `gleitz.github.io/midi-js-soundfonts` (FluidR3_GM 148 MB, MusyngKite 1.75 GB, JS+base64-MP3 format, URL pattern)
- MDN Web Docs — AudioContext resume/suspend/autoplay, AudioParam scheduling methods, AudioNode channelCountMode, StereoPannerNode, GainNode, connect()
- W3C Web Audio API 1.1 spec — channel handling, down-mix rules
- Chrome Developers blog — Web MIDI permission prompt
- WebAudio GitHub issues — `context.resume()` autoplay behavior, suspended-start semantics
- Tone.js docs — `Sampler`, `triggerAttackRelease`, `baseUrl`, `Tone.start()`

> This document reflects the **smplr 1.0+ API surface** (frozen for 1.x). If you upgrade smplr across a major version, re-check `MIGRATE.md` for renamed APIs before assuming the patterns above still compile.
