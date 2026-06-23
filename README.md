# Bouncy Melody

A cute, modern, musical Doodle Jump-inspired game.

## Features
- 12 playable characters (2D, 3D, Lumina energy, cloud-fox)
- 5 music genres (Lofi, Mystic, Synthwave, Pop, Doom)
- Procedural music engine with voice-led melody
- TTS motivational voice with subtitles
- Dynamic backgrounds, particles, platform types
- Mobile-first, APK-ready

## Development

```bash
bun install
bun run dev
```

Open http://localhost:3000

## Build for Web

```bash
bun run build
```

## Build APK (Android)

### Prerequisites
- Node.js 18+
- Android Studio
- JDK 17

### Steps

1. Install Capacitor:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

2. Configure for static export — edit `next.config.ts`:
```ts
output: "export",
trailingSlash: true,
images: { unoptimized: true },
```

3. Build the static export:
```bash
bun run build
```

4. Initialize Capacitor:
```bash
npx cap init "Bouncy Melody" "com.bouncymelody.app" --web-dir=out
```

5. Add Android platform:
```bash
npx cap add android
```

6. Copy web assets:
```bash
npx cap copy android
```

7. Open in Android Studio:
```bash
npx cap open android
```

8. In Android Studio: Build → Build Bundle(s)/APK(s) → Build APK(s)

### Important Notes
- The web version and APK are 1:1 identical — same code, same features
- No native plugins required — everything runs in the WebView
- Audio uses Web Audio API (supported in Android WebView)
- TTS uses Web Speech API (supported in Android WebView)
- Touch controls work natively in WebView
- The game is designed portrait-first for phone screens

## Project Structure
```
src/
  app/                    # Next.js app router
    layout.tsx            # Root layout (fonts, viewport)
    page.tsx              # Main page (game container)
    globals.css           # Global styles
  components/
    game/
      GameCanvas.tsx      # Main game component (canvas + UI overlays)
    ui/                   # shadcn/ui components
  lib/
    game/
      types.ts            # Type definitions
      engine.ts           # Game physics, platform generation, update loop
      audio.ts            # Procedural music engine (Web Audio API)
      music-theory.ts     # Scales, chords, progressions, genres
      character.ts        # 2D character renderer (Pip, Mochi, Yuki, etc.)
      character-lumina.ts # Lumina energy engine (Spark)
      character-mochi2.ts # Cloud-fox renderer (Mochi2)
      character3d.ts      # 3D math engine (Vec3, mesh, projection)
      character3d-render.ts # 3D character renderers (Blob3D, Cat3D)
      particles.ts        # Particle system
      render.ts           # Platform + background rendering
```

## Characters
1. Pip — pink blob with antenna
2. Pixel — mint robot with screen face
3. Mochi — orange cat with headphones
4. Yuki — white snow cat with scarf
5. Kuro — dark night cat with glowing eyes
6. Bongo — Bongo Cat
7. Popcat — Pop Cat
8. Neon — holographic cyber-cat
9. Blob3D — 3D purple sphere
10. Cat3D — 3D orange cat
11. Spark — energy serpent (Lumina engine)
12. Mochi2 — cutest cloud-fox

## Music Genres
1. Lofi — warm rhodes, jazzy progressions
2. Mystic — surreal, ethereal, whole-tone
3. Synthwave — 80s retro, arpeggiated bass
4. Pop — I-V-vi-IV, punchy bass
5. Doom — gothic metal, tritone riffs
