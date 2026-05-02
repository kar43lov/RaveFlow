import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { AudioFeatures } from '../scenes/types'

const HISTORY_FRAMES = 240  // ~4s of frames at 60fps for energy avg

// Linear interpolation: at sensitivity=0 returns `low`, at 1 returns `high`.
const lerp = (low: number, high: number, t: number) => low + (high - low) * t

/**
 * Translate the user-facing sensitivity slider (0..1) into concrete trigger
 * thresholds. Higher sensitivity = easier to fire = lower energy ratio,
 * lower bass floor, more permissive silence detection, shorter cooldown.
 */
function thresholds(s: number) {
  return {
    // Drop: current energy must exceed avg by this ratio AND bass spike past floor.
    dropRatio: lerp(2.2, 1.25, s),     // 0 -> 2.2 (very strict), 1 -> 1.25 (loose)
    bassFloor: lerp(0.75, 0.25, s),    // 0 -> 0.75, 1 -> 0.25
    // Silence-after-loud
    silenceEnergy: lerp(0.04, 0.14, s),     // higher = anything quieter than this counts as silent
    silencePriorAvg: lerp(0.45, 0.12, s),   // lower = even moderately loud passages "count"
    // Cooldown between triggers
    cooldownS: lerp(20, 5, s)
  }
}

interface AutoCycleRefs {
  lastSwitch: number
  energyHist: number[]
}

/**
 * Drives automatic scene switching based on the user's autoCycle settings.
 *
 * Modes:
 * - 'timed': fires nextScene() every autoCycleInterval seconds. Timer resets
 *   whenever the current scene changes (manual switches keep the user in
 *   control).
 * - 'auto' (by music): watches the audio stream and switches on either a
 *   drop (current energy >> rolling average + bass spike) or a transition
 *   from loud to silent (track changing, breakdown ending).
 * - 'hybrid': both. Timer ticks as in 'timed', but a music drop / silence
 *   can trigger an early jump. Any switch resets the timer so we never
 *   fire two triggers within the cooldown window.
 *
 * A sensitivity slider (0..1) shifts the music thresholds — same knob is
 * used in both 'auto' and 'hybrid'. 'timed' ignores it.
 */
export function useAutoCycle(audioFeatures: AudioFeatures): void {
  const enabled = useStore((s) => s.autoCycleEnabled)
  const mode = useStore((s) => s.autoCycleMode)
  const interval = useStore((s) => s.autoCycleInterval)
  const sensitivity = useStore((s) => s.autoCycleSensitivity)
  const currentSceneIndex = useStore((s) => s.currentSceneIndex)
  const isPaused = useStore((s) => s.isPaused)
  const nextScene = useStore((s) => s.nextScene)

  const refs = useRef<AutoCycleRefs>({
    lastSwitch: performance.now(),
    energyHist: []
  })

  // Reset cooldown clock + history whenever the scene changes (manual or auto).
  useEffect(() => {
    refs.current.lastSwitch = performance.now()
    refs.current.energyHist = []
  }, [currentSceneIndex])

  // Timer (active in 'timed' and 'hybrid')
  useEffect(() => {
    if (!enabled || isPaused) return
    if (mode !== 'timed' && mode !== 'hybrid') return
    const id = window.setInterval(() => {
      nextScene()
    }, interval * 1000)
    return () => window.clearInterval(id)
  }, [enabled, mode, interval, currentSceneIndex, isPaused, nextScene])

  // Music listener (active in 'auto' and 'hybrid')
  useEffect(() => {
    if (!enabled || isPaused) return
    if (mode !== 'auto' && mode !== 'hybrid') return

    const r = refs.current
    r.energyHist.push(audioFeatures.energy)
    if (r.energyHist.length > HISTORY_FRAMES) r.energyHist.shift()

    const elapsed = (performance.now() - r.lastSwitch) / 1000
    const t = thresholds(sensitivity)
    if (elapsed < t.cooldownS) return
    if (r.energyHist.length < 60) return // need at least ~1s of data

    const avg = r.energyHist.reduce((a, b) => a + b, 0) / r.energyHist.length

    const isDrop =
      audioFeatures.energy > avg * t.dropRatio &&
      audioFeatures.bass > t.bassFloor

    const isSilent =
      audioFeatures.energy < t.silenceEnergy &&
      avg > t.silencePriorAvg

    if (isDrop || isSilent) {
      nextScene()
    }
  }, [audioFeatures, enabled, mode, sensitivity, isPaused, nextScene])
}
