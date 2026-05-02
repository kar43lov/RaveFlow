import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { AudioFeatures } from '../scenes/types'

const HISTORY_FRAMES = 240        // ~4s of frames at 60fps for energy avg
const MIN_COOLDOWN_S = 12         // minimum gap between auto switches
const DROP_AVG_RATIO = 1.7        // current energy must exceed avg * this
const DROP_BASS_FLOOR = 0.55      // and bass must spike past this
const SILENCE_ENERGY = 0.07       // sustained quiet
const SILENCE_PRIOR_AVG = 0.25    // requires that we were loud before going silent

/**
 * Drives automatic scene switching based on the user's autoCycle settings.
 *
 * Modes:
 * - 'timed': fires nextScene() every autoCycleInterval seconds. Timer resets
 *   whenever the current scene changes (manual switches keep the user in
 *   control).
 * - 'auto': watches the audio stream and switches on either a hard drop
 *   (current energy >> rolling average + bass spike) or a transition from
 *   loud to silent (track changing, breakdown ending).
 *
 * A cooldown (MIN_COOLDOWN_S) prevents the auto mode from rapid-firing.
 */
export function useAutoCycle(audioFeatures: AudioFeatures): void {
  const enabled = useStore((s) => s.autoCycleEnabled)
  const mode = useStore((s) => s.autoCycleMode)
  const interval = useStore((s) => s.autoCycleInterval)
  const currentSceneIndex = useStore((s) => s.currentSceneIndex)
  const isPaused = useStore((s) => s.isPaused)
  const nextScene = useStore((s) => s.nextScene)

  const lastSwitchRef = useRef<number>(performance.now())
  const energyHistRef = useRef<number[]>([])

  // Reset cooldown clock whenever the scene changes (manual or auto). This
  // means a user N-press resets the timed timer; both modes get a fresh window.
  useEffect(() => {
    lastSwitchRef.current = performance.now()
    energyHistRef.current = []
  }, [currentSceneIndex])

  // Timed mode — straightforward setInterval, restarted whenever inputs change.
  useEffect(() => {
    if (!enabled || mode !== 'timed' || isPaused) return
    const id = window.setInterval(() => {
      nextScene()
    }, interval * 1000)
    return () => window.clearInterval(id)
  }, [enabled, mode, interval, currentSceneIndex, isPaused, nextScene])

  // Auto-by-music mode — runs on every audioFeatures update.
  useEffect(() => {
    if (!enabled || mode !== 'auto' || isPaused) return

    const hist = energyHistRef.current
    hist.push(audioFeatures.energy)
    if (hist.length > HISTORY_FRAMES) hist.shift()

    const elapsed = (performance.now() - lastSwitchRef.current) / 1000
    if (elapsed < MIN_COOLDOWN_S) return
    if (hist.length < 60) return // need at least ~1s of data

    const avg = hist.reduce((a, b) => a + b, 0) / hist.length

    const isDrop =
      audioFeatures.energy > avg * DROP_AVG_RATIO &&
      audioFeatures.bass > DROP_BASS_FLOOR

    const isSilent =
      audioFeatures.energy < SILENCE_ENERGY &&
      avg > SILENCE_PRIOR_AVG

    if (isDrop || isSilent) {
      nextScene()
    }
  }, [audioFeatures, enabled, mode, isPaused, nextScene])
}
