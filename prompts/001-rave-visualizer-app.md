<objective>
Build a production-ready, frontend-only web application that generates real-time full-screen rave/club visual effects in the browser.

This is for VJs, club events, and LED screen installations. The app must look impressive on large displays, respond to live music via microphone, and provide smooth 60 FPS performance. There is NO backend — everything runs client-side.

Go beyond the basics to create a fully-featured, professional-grade visualizer with multiple scenes, audio reactivity, and polished UX.
</objective>

<context>
Tech stack (MUST use exactly):
- Vite + React 18 + TypeScript
- Three.js for WebGL rendering (with custom GLSL shaders where needed)
- Zustand for state management
- Minimal CSS (no heavy frameworks)

Project must:
- Run with: `npm install && npm run dev`
- Build with: `npm run build` and work from static hosting
- Work immediately after copy-paste into empty folder

Read CLAUDE.md for any project-specific conventions before starting.
</context>

<requirements>

<fullscreen_visuals>
1. Canvas covers 100% viewport (no margins, no scrollbars)
2. Support true fullscreen via Fullscreen API
3. Show hint overlay: "Press F for fullscreen" (disappears after 3s or on first interaction)
4. High contrast, vivid colors optimized for LED screens
5. NO tiny UI elements visible during performance mode
6. Handle window resize and devicePixelRatio changes properly
</fullscreen_visuals>

<scene_system>
Implement a scene/preset system with AT LEAST 6 scenes across these categories:

A) Neon Tunnel Scenes (implement 2):
- "Vortex Tunnel" — endless neon stripe tunnel with forward motion, seamless loop
- "Grid Corridor" — wireframe grid tunnel with perspective depth

B) Retro-Arcade Inspired (implement 2, ALL ORIGINAL — no copyrighted references):
- "Neon Maze Chase" — abstract top-down maze with energy trails
- "Pixel Symbol Tunnel" — pixelated symbols flying toward camera

C) Club Crowd Scene (implement 1):
- "Crowd Pulse" — abstract silhouettes of dancing crowd, DJ in background with glowing decks, equalizer at bottom

D) Abstract Rave Graphics (implement 1):
- "Laser Storm" — pulsing lines, particles, laser sweeps, liquid light waves

Each scene MUST have:
- `init(renderer, params)` — setup
- `update(time, beat, audioFeatures)` — animation frame
- `resize(width, height)` — handle resize
- `dispose()` — cleanup WebGL resources
- Configurable parameters (speed, intensity, colors)
- Instant switching without page reload
</scene_system>

<controls_ux>
Default state: "Performance mode" — visuals only, no UI

Settings overlay:
- Toggle with `Tab` or `H` key (same key hides it)
- `Escape` also closes overlay
- Semi-transparent dark background, readable but minimal
- When closed, NOTHING blocks visuals

Keyboard shortcuts (must work globally):
- `1-9`: Switch scene presets
- `F`: Toggle fullscreen
- `Space`: Pause/resume animation
- `N`: Next scene
- `P`: Previous scene
- `Tab` or `H`: Toggle settings

Settings panel sections:
1. Scene selector (dropdown or grid)
2. BPM controls (manual mode)
3. Audio controls (mic mode)
4. Visual parameters (quality, intensity, colors)
5. Keyboard shortcuts reference
</controls_ux>

<rhythm_engine>
Two modes: Manual BPM and Auto (microphone)

MANUAL BPM MODE:
- BPM slider: range 120-190, default 140
- Tap-tempo button: user clicks repeatedly to set BPM (average last 4-8 taps)
- Preset buttons: 140 (House), 160 (Fast), 174 (DnB), 180 (Hard)
- Beat clock drives: pulses, flashes, speed bursts, equalizer bounce

AUTO MODE (CRITICAL FEATURE):
Microphone-based audio analysis using Web Audio API

Permission flow:
- NEVER auto-request on page load
- Request ONLY when user clicks "Enable Mic" or toggles Auto mode ON
- If permission already granted, start immediately without prompt
- If blocked/denied, show status and fall back to Manual BPM automatically

Mic status indicator: Off / Requesting... / On / Blocked / No device

Audio analysis (using AnalyserNode):
- FFT analysis for frequency spectrum
- Time-domain analysis for waveform
- Calculate: RMS energy, bass energy (20-150Hz), transient/onset detection
- Auto BPM estimation from onset intervals (robust for 120-190 BPM range)

When mic mode ON:
- Disable manual BPM slider and tap-tempo (grey them out)
- Show live readouts: Auto BPM, Energy meter, Bass meter, Beat indicator
- Provide "Sensitivity" slider for onset detection
- Provide "Smoothing" slider for stability
- "Lock BPM" toggle: freeze auto BPM once stable
</rhythm_engine>

<parameter_gating>
When mic mode is active:

DISABLED (audio-driven):
- BPM controls → Auto BPM only
- Beat pulse rate → derived from detected beats

USER-CONTROLLED (always):
- Scene selection
- Color palette
- Quality level (Low/Medium/High)
- Master intensity knob (multiplies audio energy)

PER-PARAMETER AUTO/MANUAL TOGGLES for:
- Pulse Strength
- Flash Amount
- Tunnel/Movement Speed
- Glow Intensity
</parameter_gating>

<audio_reactive_visuals>
Visuals MUST respond meaningfully to audio:

Beat/onset triggers:
- Light flashes
- Pulse waves
- Camera/speed bursts
- Color shifts

Bass energy drives:
- Tunnel expansion/contraction
- Glow intensity
- Crowd bounce amplitude
- Equalizer bar heights

Overall energy drives:
- Particle density
- Distortion amount
- Color saturation

On-screen equalizer:
- Optional overlay at bottom edge
- Toggle on/off in settings
- Default ON in mic mode
- 32-64 frequency bands
- Smooth animation

Visuals must also work in BPM-only mode with simulated beat pulses.
</audio_reactive_visuals>

<performance>
Target: 60 FPS on typical modern laptops

Requirements:
- GPU shaders for all heavy effects
- Minimal CPU loops
- Efficient Three.js usage (reuse geometries, materials)
- Proper disposal of WebGL resources on scene switch

Quality setting (Low/Medium/High):
- Low: 0.5x resolution scale, reduced particles, no post-processing
- Medium: 1x resolution, moderate particles, basic bloom
- High: devicePixelRatio resolution, full particles, full post-processing

Handle:
- Window resize
- devicePixelRatio changes
- Tab visibility (pause when hidden)
</performance>

<safety_copyright>
CRITICAL: NO copyrighted content

- NO copyrighted assets, textures, sprites, fonts, logos
- NO recognizable characters from games, movies, brands
- ALL visuals generated procedurally
- Scene names must be generic: "Vortex Tunnel", "Crowd Pulse", "Laser Storm"
- NO references to real game IPs (Pac-Man, Tron, etc.)
</safety_copyright>

</requirements>

<implementation>

<architecture>
src/
├── main.tsx                 # Entry point
├── App.tsx                  # Root component
├── index.css                # Global styles
├── components/
│   ├── Canvas.tsx           # Three.js canvas wrapper
│   ├── SettingsOverlay.tsx  # Settings panel
│   ├── Equalizer.tsx        # Audio visualizer overlay
│   └── FullscreenHint.tsx   # "Press F" hint
├── renderer/
│   ├── Renderer.ts          # Three.js renderer manager
│   ├── SceneManager.ts      # Scene switching logic
│   └── PostProcessing.ts    # Bloom, etc.
├── scenes/
│   ├── types.ts             # Scene interface
│   ├── VortexTunnel.ts
│   ├── GridCorridor.ts
│   ├── NeonMazeChase.ts
│   ├── PixelSymbolTunnel.ts
│   ├── CrowdPulse.ts
│   └── LaserStorm.ts
├── audio/
│   ├── AudioAnalyzer.ts     # Mic input, FFT, features
│   ├── BeatDetector.ts      # Onset detection, BPM estimation
│   └── BeatClock.ts         # Manual BPM clock
├── store/
│   └── useStore.ts          # Zustand store
├── hooks/
│   ├── useKeyboard.ts       # Keyboard shortcuts
│   └── useFullscreen.ts     # Fullscreen API
└── utils/
    ├── math.ts              # Lerp, clamp, etc.
    └── random.ts            # Seedable random (optional)
</architecture>

<scene_interface>
interface Scene {
  name: string;
  init(renderer: THREE.WebGLRenderer, params: SceneParams): void;
  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void;
  resize(width: number, height: number): void;
  dispose(): void;
  getParameters(): SceneParameter[];
  setParameter(key: string, value: number | string): void;
}

interface BeatInfo {
  phase: number;        // 0-1, position within beat
  intensity: number;    // 0-1, beat strength
  isOnset: boolean;     // true on beat hit
  bpm: number;
}

interface AudioFeatures {
  energy: number;       // 0-1, overall RMS
  bass: number;         // 0-1, low frequency energy
  mid: number;          // 0-1, mid frequency energy
  high: number;         // 0-1, high frequency energy
  spectrum: Float32Array; // Full FFT data
  waveform: Float32Array; // Time domain data
}
</scene_interface>

<audio_analyzer_interface>
class AudioAnalyzer {
  // Lifecycle
  async init(): Promise<void>;
  async startMic(): Promise<MicStatus>;
  stopMic(): void;
  dispose(): void;

  // Status
  getMicStatus(): MicStatus; // 'off' | 'requesting' | 'on' | 'blocked' | 'no-device'

  // Analysis (call every frame when mic is on)
  update(): void;
  getFeatures(): AudioFeatures;

  // BPM
  getEstimatedBPM(): number;
  isLocked(): boolean;
  lockBPM(): void;
  unlockBPM(): void;

  // Settings
  setSensitivity(value: number): void;  // 0-1
  setSmoothing(value: number): void;    // 0-1
}
</audio_analyzer_interface>

<animation_loop>
The main loop must:
1. Check if paused → skip update
2. Calculate deltaTime
3. If mic mode: update AudioAnalyzer, get features
4. If manual mode: update BeatClock
5. Get current beat info (phase, onset, intensity)
6. Update current scene with time, beat, audio
7. Render via Three.js
8. Request next frame
</animation_loop>

<state_management>
Zustand store should manage:
- currentSceneIndex: number
- isPaused: boolean
- isFullscreen: boolean
- showSettings: boolean
- showEqualizer: boolean
- micMode: boolean
- micStatus: MicStatus
- bpm: number (manual)
- autoBPM: number (detected)
- isLocked: boolean
- quality: 'low' | 'medium' | 'high'
- masterIntensity: number
- sensitivity: number
- smoothing: number
- autoParams: Record<string, boolean> (which params are audio-driven)
- sceneParams: Record<string, Record<string, number | string>>
</state_management>

<shaders>
Use custom GLSL shaders for:
- Neon glow effects (bloom post-processing)
- Tunnel geometry distortion
- Particle systems
- Color grading

Keep shaders as string literals in scene files or separate .glsl files with raw imports.
</shaders>

</implementation>

<output>
Create the complete project with these files:

Configuration:
- `./package.json` — dependencies: react, react-dom, three, @types/three, zustand, vite, typescript, @vitejs/plugin-react
- `./vite.config.ts` — standard React config
- `./tsconfig.json` — strict TypeScript config
- `./index.html` — entry HTML

Source files:
- All files in the architecture above
- Each scene fully implemented with shaders
- AudioAnalyzer with Web Audio API integration
- Complete UI components

Documentation:
- `./README.md` with:
  - Install/run/build steps
  - Full keybindings list
  - Microphone permissions troubleshooting
  - How to add a new scene (template code)
</output>

<verification>
Before declaring complete, verify:

1. Run `npm install` — no errors
2. Run `npm run dev` — app starts, shows visuals
3. Test all keyboard shortcuts (1-9, F, Space, N, P, Tab)
4. Toggle settings overlay — appears/disappears correctly
5. Switch between scenes — smooth transitions
6. Test Manual BPM mode — visuals sync to beat
7. Test Mic mode — permission flow works, visuals react to audio
8. Test fullscreen — F key works, visuals scale properly
9. Run `npm run build` — builds successfully
10. All 6+ scenes render without errors
</verification>

<success_criteria>
- App runs immediately after `npm install && npm run dev`
- All 6 scenes render with distinct visuals
- Keyboard shortcuts work correctly
- Settings overlay is functional and minimal
- Manual BPM mode syncs visuals to beat
- Mic mode captures audio and drives visuals
- Auto BPM detection works for club music
- 60 FPS on medium quality
- No copyrighted content
- Code is clean, typed, and organized
</success_criteria>
