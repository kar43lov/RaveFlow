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
Zustand store managing: current scene, playback state, mic mode, BPM, quality settings, UI visibility, **multi-select playlist** (`multiSelectMode` + `selectedScenes`), **auto-cycle** (`autoCycleEnabled` + `autoCycleMode` `'auto'|'timed'|'hybrid'` + `autoCycleInterval` + `autoCycleSensitivity` + `autoCycleCooldown`), and **hover preview** (`previewSceneIndex`). `nextScene`/`prevScene` route through a `stepIndex` helper that respects the active subset when multi-select is on.

**Auto-cycle** (`src/hooks/useAutoCycle.ts`)
- `'timed'` — `setInterval(autoCycleInterval)`. Manual scene change resets the timer.
- `'auto'` — adaptive thresholds against a 6 s rolling window of `audio.energy`/`audio.bass`. A drop fires when current energy is in the upper portion of the recent range, bass is near its recent peak, **and** there's a "jump" — current vs ~0.5 s ago. Silence fires on a corresponding fall. Sensitivity (0..1) widens/narrows the bands; min-gap is a separate user slider (5..60 s).
- `'hybrid'` — both. Timer ticks **and** music drops can fire early. Either kind of switch resets the cooldown.
- Companion `useAutoCycleDebug` mirrors the math without firing — feeds the live debug overlay (`AutoCycleDebugOverlay`) toggled in Settings.

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

### Gotcha: AudioFeatures object is reused

`AudioAnalyzer.getFeatures()` returns the **same** internal `smoothedFeatures` object every frame and mutates it in place (perf — no per-frame allocation). `Canvas.animate` therefore spreads it before forwarding: `onAudioFeaturesUpdate({ ...audioFeatures })`. Without the spread, `setState` sees the same reference, React skips the update, and any `useEffect` listening on `audioFeatures` (e.g. `useAutoCycle`) silently never runs. Equalizer / debug overlays still look fine because they read fields directly during render. Don't remove that spread.

### GLSL Shaders

Shaders are inline strings in scene files. Common uniforms:
- `uTime` - elapsed time in seconds
- `uPulse` - beat pulse intensity (0-1, decays after onset)
- `uBass`, `uEnergy` - audio features (0-1)
- `uColorHue` - color control (0-1 for HSL hue)

## Deployment

Прод: **https://raveflow.ru**, hostname `kolcova-psih-bot`, Ubuntu 22.04 на Cloud.ru.

### Обновить прод (новый билд)

```
/pg.ship-rave
```

Глобальная slash-команда (`~/.claude/commands/pg.ship-rave.md`) делает всё: pre-flight (проект + SSH + git status), `npm run build`, чистит старые ассеты на сервере (`/var/www/rave-visualizer/{index.html,assets/*}`), `scp -r dist/*`, верифицирует через curl что прод отдаёт свежий хэш бандла.

Флаги:
- `--skip-build` — пропустить `npm run build`, использовать готовый `dist/`
- `--no-clean` — не чистить старые файлы на сервере (с подтверждением)

Для коммита/PR сначала `/pg.ship`, потом `/pg.ship-rave` для выкатки.

### Сервер

- SSH: `ssh kolcova-psih-bot` (алиас в `~/.ssh/config`, ключ `~/.ssh/raveflow_ed25519`, юзер `kar43lov`)
- Сайт: `/var/www/rave-visualizer/` (owner `kar43lov`, без sudo)
- nginx: `/etc/nginx/sites-available/rave-visualizer` — SPA + gzip + certbot SSL. **Не редактируется** деплоем (только `index.html` + `assets/`); если нужны правки nginx/certbot — отдельно, руками, с осознанием последствий.
- nginx **не нужно перезапускать** после деплоя — статика отдаётся напрямую с диска.

### Первичная настройка (из нуля)

См. `DEPLOY.md` (на английском, для Windows/Linux руками) и `deploy.sh`/`deploy.ps1`. Эти инструкции рассчитаны на разворачивание чистого сервера: nginx, certbot, права. Для **обновления** уже работающего прода используется `/pg.ship-rave`, не они.