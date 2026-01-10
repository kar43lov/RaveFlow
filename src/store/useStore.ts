import { create } from 'zustand'
import { MicStatus } from '../scenes/types'

export type Quality = 'low' | 'medium' | 'high'

interface AppState {
  // Scene
  currentSceneIndex: number
  setCurrentSceneIndex: (index: number) => void
  nextScene: () => void
  prevScene: () => void
  sceneCount: number
  setSceneCount: (count: number) => void

  // Playback
  isPaused: boolean
  togglePause: () => void

  // Fullscreen
  isFullscreen: boolean
  setFullscreen: (value: boolean) => void

  // UI
  showSettings: boolean
  toggleSettings: () => void
  closeSettings: () => void
  showEqualizer: boolean
  toggleEqualizer: () => void
  showHint: boolean
  hideHint: () => void

  // Audio mode
  micMode: boolean
  setMicMode: (value: boolean) => void
  micStatus: MicStatus
  setMicStatus: (status: MicStatus) => void

  // BPM
  bpm: number
  setBpm: (bpm: number) => void
  autoBPM: number
  setAutoBPM: (bpm: number) => void
  isBpmLocked: boolean
  toggleBpmLock: () => void

  // Quality & Effects
  quality: Quality
  setQuality: (quality: Quality) => void
  masterIntensity: number
  setMasterIntensity: (value: number) => void

  // Audio settings
  sensitivity: number
  setSensitivity: (value: number) => void
  smoothing: number
  setSmoothing: (value: number) => void

  // Auto params
  autoParams: Record<string, boolean>
  setAutoParam: (key: string, value: boolean) => void

  // Scene params
  sceneParams: Record<string, Record<string, number | string>>
  setSceneParam: (sceneKey: string, paramKey: string, value: number | string) => void
}

export const useStore = create<AppState>((set, get) => ({
  // Scene
  currentSceneIndex: 0,
  setCurrentSceneIndex: (index) => set({ currentSceneIndex: index }),
  nextScene: () => set((state) => ({
    currentSceneIndex: (state.currentSceneIndex + 1) % state.sceneCount
  })),
  prevScene: () => set((state) => ({
    currentSceneIndex: (state.currentSceneIndex - 1 + state.sceneCount) % state.sceneCount
  })),
  sceneCount: 6,
  setSceneCount: (count) => set({ sceneCount: count }),

  // Playback
  isPaused: false,
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  // Fullscreen
  isFullscreen: false,
  setFullscreen: (value) => set({ isFullscreen: value }),

  // UI
  showSettings: false,
  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),
  closeSettings: () => set({ showSettings: false }),
  showEqualizer: true,
  toggleEqualizer: () => set((state) => ({ showEqualizer: !state.showEqualizer })),
  showHint: true,
  hideHint: () => set({ showHint: false }),

  // Audio mode
  micMode: false,
  setMicMode: (value) => set({ micMode: value }),
  micStatus: 'off',
  setMicStatus: (status) => set({ micStatus: status }),

  // BPM
  bpm: 140,
  setBpm: (bpm) => set({ bpm: Math.max(120, Math.min(190, bpm)) }),
  autoBPM: 140,
  setAutoBPM: (bpm) => set({ autoBPM: bpm }),
  isBpmLocked: false,
  toggleBpmLock: () => set((state) => ({ isBpmLocked: !state.isBpmLocked })),

  // Quality & Effects
  quality: 'medium',
  setQuality: (quality) => set({ quality }),
  masterIntensity: 1.0,
  setMasterIntensity: (value) => set({ masterIntensity: Math.max(0, Math.min(2, value)) }),

  // Audio settings
  sensitivity: 0.5,
  setSensitivity: (value) => set({ sensitivity: value }),
  smoothing: 0.8,
  setSmoothing: (value) => set({ smoothing: value }),

  // Auto params
  autoParams: {
    pulseStrength: true,
    flashAmount: true,
    tunnelSpeed: true,
    glowIntensity: true
  },
  setAutoParam: (key, value) => set((state) => ({
    autoParams: { ...state.autoParams, [key]: value }
  })),

  // Scene params
  sceneParams: {},
  setSceneParam: (sceneKey, paramKey, value) => set((state) => ({
    sceneParams: {
      ...state.sceneParams,
      [sceneKey]: {
        ...(state.sceneParams[sceneKey] || {}),
        [paramKey]: value
      }
    }
  }))
}))
