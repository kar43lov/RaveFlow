# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # Install dependencies
npm run dev      # Start development server (Vite)
npm run build    # Type-check with tsc, then build for production
npm run preview  # Preview production build locally
```

## Architecture

Real-time WebGL visualizer for club/rave events with audio reactivity.

### Core Data Flow

```
AudioAnalyzer/BeatClock → AudioFeatures/BeatInfo → SceneManager → Scenes → Renderer → PostProcessing → Screen
```

### Key Modules

**Audio System** (`src/audio/`)
- `AudioAnalyzer` - Web Audio API microphone input, FFT analysis, feature extraction (energy, bass, mid, high)
- `BeatDetector` - Onset detection and auto-BPM estimation from audio
- `BeatClock` - Manual BPM-driven beat timing with tap tempo support

**Rendering** (`src/renderer/`)
- `Renderer` - Three.js WebGLRenderer wrapper with quality scaling
- `SceneManager` - Scene lifecycle management (init, update, resize, dispose)
- `PostProcessing` - Bloom effect via multi-pass blur

**Scenes** (`src/scenes/`)
Each scene implements the `Scene` interface from `types.ts`:
- `init(renderer, width, height)` - Setup Three.js objects
- `update(time, deltaTime, beat, audio)` - Animation frame, receives beat/audio data
- `render(renderer)` - Draw to WebGL
- `resize(width, height)` - Handle viewport changes
- `dispose()` - Clean up GPU resources

**State** (`src/store/useStore.ts`)
Zustand store managing: current scene, playback state, mic mode, BPM, quality settings, UI visibility.

### Adding a New Scene

1. Create `src/scenes/MyScene.ts` implementing `Scene` interface
2. Register in `src/renderer/SceneManager.ts` init method
3. Scene receives `BeatInfo` (phase, intensity, isOnset, bpm) and `AudioFeatures` (energy, bass, mid, high, spectrum, waveform)

### Audio Reactivity Pattern

```typescript
update(time, deltaTime, beat, audio) {
  // Trigger on beat
  if (beat.isOnset) this.pulse = 1.0
  this.pulse *= 0.9 // decay

  // Continuous audio response
  this.material.uniforms.uBass.value = audio.bass
  this.material.uniforms.uEnergy.value = audio.energy
}
```

### GLSL Shaders

Shaders are inline strings in scene files. Common uniforms:
- `uTime` - elapsed time in seconds
- `uPulse` - beat pulse intensity (0-1, decays after onset)
- `uBass`, `uEnergy` - audio features (0-1)
- `uColorHue` - color control (0-1 for HSL hue)