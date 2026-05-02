import { create } from 'zustand'
import { MicStatus } from '../scenes/types'

export type Quality = 'low' | 'medium' | 'high'
export type AutoCycleMode = 'auto' | 'timed' | 'hybrid'

interface AppState {
  // Scene
  currentSceneIndex: number
  setCurrentSceneIndex: (index: number) => void
  nextScene: () => void
  prevScene: () => void
  sceneCount: number
  setSceneCount: (count: number) => void

  // Multi-select playlist
  multiSelectMode: boolean
  setMultiSelectMode: (v: boolean) => void
  selectedScenes: number[]
  toggleSceneSelected: (idx: number) => void
  setSelectedScenes: (indices: number[]) => void

  // Auto-cycle
  autoCycleEnabled: boolean
  setAutoCycleEnabled: (v: boolean) => void
  autoCycleMode: AutoCycleMode
  setAutoCycleMode: (m: AutoCycleMode) => void
  autoCycleInterval: number  // seconds
  setAutoCycleInterval: (s: number) => void
  autoCycleSensitivity: number  // 0..1, higher = triggers more often
  setAutoCycleSensitivity: (v: number) => void
  autoCycleCooldown: number     // seconds, minimum gap between music-triggered switches
  setAutoCycleCooldown: (s: number) => void
  showAutoCycleDebug: boolean
  toggleAutoCycleDebug: () => void

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

// Pick the next index inside the active subset (or full list if no subset).
function stepIndex(
  current: number,
  count: number,
  multi: boolean,
  selected: number[],
  delta: 1 | -1
): number {
  if (multi && selected.length > 0) {
    const sorted = [...selected].sort((a, b) => a - b)
    const pos = sorted.indexOf(current)
    if (pos === -1) return sorted[0]
    const nextPos = (pos + delta + sorted.length) % sorted.length
    return sorted[nextPos]
  }
  return (current + delta + count) % count
}

export const useStore = create<AppState>((set) => ({
  // Scene
  currentSceneIndex: 0,
  setCurrentSceneIndex: (index) => set({ currentSceneIndex: index }),
  nextScene: () => set((state) => ({
    currentSceneIndex: stepIndex(
      state.currentSceneIndex,
      state.sceneCount,
      state.multiSelectMode,
      state.selectedScenes,
      1
    )
  })),
  prevScene: () => set((state) => ({
    currentSceneIndex: stepIndex(
      state.currentSceneIndex,
      state.sceneCount,
      state.multiSelectMode,
      state.selectedScenes,
      -1
    )
  })),
  sceneCount: 6,
  setSceneCount: (count) => set({ sceneCount: count }),

  // Multi-select playlist
  multiSelectMode: false,
  setMultiSelectMode: (v) => set({ multiSelectMode: v }),
  selectedScenes: [],
  toggleSceneSelected: (idx) => set((state) => {
    const has = state.selectedScenes.includes(idx)
    return {
      selectedScenes: has
        ? state.selectedScenes.filter((i) => i !== idx)
        : [...state.selectedScenes, idx]
    }
  }),
  setSelectedScenes: (indices) => set({ selectedScenes: [...indices] }),

  // Auto-cycle
  autoCycleEnabled: false,
  setAutoCycleEnabled: (v) => set({ autoCycleEnabled: v }),
  autoCycleMode: 'auto',
  setAutoCycleMode: (m) => set({ autoCycleMode: m }),
  autoCycleInterval: 60,
  setAutoCycleInterval: (s) => set({ autoCycleInterval: Math.max(30, Math.min(600, s)) }),
  autoCycleSensitivity: 0.5,
  setAutoCycleSensitivity: (v) => set({ autoCycleSensitivity: Math.max(0, Math.min(1, v)) }),
  autoCycleCooldown: 10,
  setAutoCycleCooldown: (s) => set({ autoCycleCooldown: Math.max(5, Math.min(60, s)) }),
  showAutoCycleDebug: false,
  toggleAutoCycleDebug: () => set((state) => ({ showAutoCycleDebug: !state.showAutoCycleDebug })),

  // Playback
  isPaused: false,
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  // Fullscreen
  isFullscreen: false,
  setFullscreen: (value) => set({ isFullscreen: value }),

  // UI
  showSettings: false,
  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),
  closeSettings: () => set((state) => {
    // If multi-select is on and current scene was deselected, jump to the
    // smallest selected index when closing settings.
    if (
      state.multiSelectMode &&
      state.selectedScenes.length > 0 &&
      !state.selectedScenes.includes(state.currentSceneIndex)
    ) {
      const first = [...state.selectedScenes].sort((a, b) => a - b)[0]
      return { showSettings: false, currentSceneIndex: first }
    }
    return { showSettings: false }
  }),
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
