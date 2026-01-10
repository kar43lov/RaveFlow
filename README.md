# Rave Visualizer

Real-time full-screen rave/club visual effects for VJs, club events, and LED screen installations.

## Features

- 6 unique visual scenes with WebGL/GLSL shaders
- Microphone-based audio reactivity with beat detection
- Manual BPM mode with tap tempo
- Auto BPM estimation from live audio
- Full-screen mode optimized for LED screens
- Keyboard shortcuts for live performance
- Post-processing bloom effects
- Quality settings (Low/Medium/High)

## Installation

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deployment

Быстрый деплой на сервер одной командой:

```bash
chmod +x deploy.sh
./deploy.sh user@your-server.com 8080
```

Подробная инструкция: [DEPLOY.md](DEPLOY.md)

**Важно:** Для работы микрофона на production требуется HTTPS.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-6` | Switch to scene 1-6 |
| `N` | Next scene |
| `P` | Previous scene |
| `F` | Toggle fullscreen |
| `Space` | Pause/Resume |
| `Tab` or `H` | Toggle settings overlay |
| `Escape` | Close settings |

## Scenes

1. **Vortex Tunnel** - Endless neon stripe tunnel with forward motion
2. **Grid Corridor** - Wireframe grid tunnel with perspective depth
3. **Neon Maze Chase** - Top-down maze with energy trails
4. **Pixel Symbol Tunnel** - Pixelated symbols flying toward camera
5. **Crowd Pulse** - Dancing crowd silhouettes with DJ booth
6. **Laser Storm** - Pulsing lasers, particles, and liquid light waves

## Audio Modes

### Manual BPM Mode
- Use the BPM slider (120-190 range)
- Tap Tempo button to set BPM by tapping
- Preset buttons: 140 (House), 160 (Fast), 174 (DnB), 180 (Hard)

### Microphone Mode (Auto)
1. Open settings (Tab key)
2. Enable "Microphone Mode" toggle
3. Grant microphone permission when prompted
4. Audio will drive visuals automatically

**Mic Controls:**
- Sensitivity: Adjusts beat detection threshold
- Smoothing: Controls response smoothness
- Lock BPM: Freeze auto BPM once stable
- Equalizer: Toggle on-screen frequency bars

## Microphone Troubleshooting

### Permission Denied
- Check browser permissions for microphone
- In Chrome: Settings > Privacy and Security > Site Settings > Microphone
- Allow the site to access microphone

### No Audio Response
1. Increase Sensitivity slider
2. Decrease Smoothing slider
3. Ensure music is playing near the microphone
4. Check system audio input settings

### No Device Found
- Ensure a microphone is connected
- Check system audio input device settings
- Try refreshing the page

## Adding a New Scene

Create a new file in `src/scenes/` implementing the `Scene` interface:

```typescript
import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class MyNewScene implements Scene {
  name = 'My New Scene'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  // ... your objects

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    // Initialize Three.js objects
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    // Create your geometry, materials, etc.
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    // Update animation
    // Use beat.isOnset for beat triggers
    // Use audio.bass, audio.mid, audio.high, audio.energy for audio reactivity
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    // Clean up Three.js resources
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'speed', label: 'Speed', type: 'number', value: 1, min: 0.1, max: 3, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    // Handle parameter changes
  }
}
```

Then register in `src/renderer/SceneManager.ts`:

```typescript
import { MyNewScene } from '../scenes/MyNewScene'

// In the init() method:
this.scenes = [
  // ... existing scenes
  new MyNewScene()
]
```

## Tech Stack

- **Vite** - Build tool
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Three.js** - WebGL rendering
- **Zustand** - State management
- **Web Audio API** - Audio analysis

## Performance Tips

- Use **Low** quality for older hardware
- Use **Medium** quality for typical laptops
- Use **High** quality for powerful desktops/workstations
- Close other browser tabs when running
- Use fullscreen mode for best performance

## License

MIT
