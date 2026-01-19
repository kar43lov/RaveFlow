# RaveFlow Project Overview

## Purpose
Real-time WebGL visualizer for club/rave events with audio reactivity.

## Tech Stack
- **Frontend**: React 18, TypeScript
- **3D Graphics**: Three.js
- **State Management**: Zustand
- **Build Tool**: Vite

## Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm run build` - Type-check and build for production
- `npm run preview` - Preview production build

## Architecture

### Core Data Flow
```
AudioAnalyzer/BeatClock → AudioFeatures/BeatInfo → SceneManager → Scenes → Renderer → PostProcessing → Screen
```

### Key Modules
- `src/audio/` - AudioAnalyzer (mic/FFT), BeatDetector, BeatClock
- `src/renderer/` - Renderer, SceneManager, PostProcessing
- `src/scenes/` - Visual scenes implementing Scene interface
- `src/store/useStore.ts` - Zustand store for app state
- `src/components/` - React UI components

### State Management (Zustand)
Key state includes: currentSceneIndex, micMode, micStatus, bpm, quality settings, UI visibility.

### Scene Interface
Each scene implements: init(), update(), render(), resize(), dispose()
Scenes receive BeatInfo and AudioFeatures for audio reactivity.
