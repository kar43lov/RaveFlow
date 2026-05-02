import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { AudioFeatures } from '../scenes/types'

const HISTORY_FRAMES = 360  // ~6s of history at 60fps

// Linear interpolation: at sensitivity=0 returns `low`, at 1 returns `high`.
const lerp = (low: number, high: number, t: number) => low + (high - low) * t

interface AutoCycleRefs {
  lastSwitch: number
  energyHist: number[]
  bassHist: number[]
}

/**
 * Auto-switch scenes based on user's autoCycle settings.
 *
 * Music detection is **adaptive** — thresholds are derived from the actual
 * recent peak/floor of audio.energy and audio.bass, not absolute numbers.
 * This way the same sensitivity setting works whether the music is
 * blasting or quiet, and across different mic gains.
 *
 * Two music triggers:
 * 1. Drop / spike: current energy is high relative to the recent range AND
 *    bass is also high relative to its recent range.
 * 2. Silence after loud: current energy collapses to a small fraction of
 *    the recent peak (and the peak was actually meaningful, i.e. there
 *    *was* music going on).
 *
 * History is NOT cleared on scene change — only the cooldown is reset.
 * Otherwise an auto-switch immediately wipes the silence-detection
 * baseline and the system misses an obvious "track ended" event.
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
    energyHist: [],
    bassHist: []
  })

  // Reset cooldown on any scene change (manual or auto). Keep history.
  useEffect(() => {
    refs.current.lastSwitch = performance.now()
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
    r.bassHist.push(audioFeatures.bass)
    if (r.energyHist.length > HISTORY_FRAMES) r.energyHist.shift()
    if (r.bassHist.length > HISTORY_FRAMES) r.bassHist.shift()

    // Cooldown — sensitivity 0 → 20s, 1 → 5s
    const cooldownS = lerp(20, 5, sensitivity)
    const elapsed = (performance.now() - r.lastSwitch) / 1000
    if (elapsed < cooldownS) return

    // Need at least ~2s of data to compute a stable baseline
    if (r.energyHist.length < 120) return

    // Adaptive stats from history
    let ePeak = 0, eFloor = 1, eSum = 0
    for (const v of r.energyHist) {
      if (v > ePeak) ePeak = v
      if (v < eFloor) eFloor = v
      eSum += v
    }
    const eAvg = eSum / r.energyHist.length

    let bPeak = 0
    for (const v of r.bassHist) if (v > bPeak) bPeak = v

    // If the mic is essentially silent (no music), don't fire on noise floor.
    // ePeak < ~0.04 means there's basically nothing happening.
    if (ePeak < 0.04) return

    // Drop: current energy in the upper portion of recent range AND bass spiked.
    // Sensitivity 0 → must be near the very peak; sensitivity 1 → just above average.
    const dropEnergyMin = lerp(eAvg + (ePeak - eAvg) * 0.85, eAvg + (ePeak - eAvg) * 0.30, sensitivity)
    const dropBassMin = lerp(bPeak * 0.85, bPeak * 0.45, sensitivity)
    const isDrop = audioFeatures.energy > dropEnergyMin && audioFeatures.bass > dropBassMin

    // Silence: current energy is a small fraction of the recent peak.
    // Sensitivity 0 → only "almost dead silent" counts; 1 → even moderate dips count.
    const silenceFrac = lerp(0.10, 0.30, sensitivity)
    const isSilent = audioFeatures.energy < ePeak * silenceFrac && ePeak > 0.08

    if (isDrop || isSilent) {
      nextScene()
    }
  }, [audioFeatures, enabled, mode, sensitivity, isPaused, nextScene])
}

/**
 * Read-only snapshot of the auto-cycle decision state, used by the debug
 * overlay so the user can see why a switch fired (or didn't).
 */
export interface AutoCycleDebug {
  energy: number
  bass: number
  energyAvg: number
  energyPeak: number
  bassPeak: number
  dropEnergyMin: number
  dropBassMin: number
  silenceMax: number
  cooldownLeft: number
  isDropNow: boolean
  isSilentNow: boolean
}

/**
 * Companion hook for an optional debug panel. Computes the same numbers as
 * useAutoCycle but doesn't fire any switches — pure observation.
 *
 * Returns null when auto-cycle isn't watching audio (timed mode or disabled).
 */
export function useAutoCycleDebug(audioFeatures: AudioFeatures): AutoCycleDebug | null {
  const enabled = useStore((s) => s.autoCycleEnabled)
  const mode = useStore((s) => s.autoCycleMode)
  const sensitivity = useStore((s) => s.autoCycleSensitivity)
  const currentSceneIndex = useStore((s) => s.currentSceneIndex)

  const refs = useRef<{ lastSwitch: number; energyHist: number[]; bassHist: number[] }>({
    lastSwitch: performance.now(),
    energyHist: [],
    bassHist: []
  })

  useEffect(() => {
    refs.current.lastSwitch = performance.now()
  }, [currentSceneIndex])

  if (!enabled || (mode !== 'auto' && mode !== 'hybrid')) return null

  const r = refs.current
  r.energyHist.push(audioFeatures.energy)
  r.bassHist.push(audioFeatures.bass)
  if (r.energyHist.length > HISTORY_FRAMES) r.energyHist.shift()
  if (r.bassHist.length > HISTORY_FRAMES) r.bassHist.shift()

  let ePeak = 0, eSum = 0
  for (const v of r.energyHist) {
    if (v > ePeak) ePeak = v
    eSum += v
  }
  const eAvg = r.energyHist.length ? eSum / r.energyHist.length : 0

  let bPeak = 0
  for (const v of r.bassHist) if (v > bPeak) bPeak = v

  const dropEnergyMin = lerp(eAvg + (ePeak - eAvg) * 0.85, eAvg + (ePeak - eAvg) * 0.30, sensitivity)
  const dropBassMin = lerp(bPeak * 0.85, bPeak * 0.45, sensitivity)
  const silenceFrac = lerp(0.10, 0.30, sensitivity)
  const silenceMax = ePeak * silenceFrac

  const cooldownS = lerp(20, 5, sensitivity)
  const elapsed = (performance.now() - r.lastSwitch) / 1000
  const cooldownLeft = Math.max(0, cooldownS - elapsed)

  const isDropNow = audioFeatures.energy > dropEnergyMin && audioFeatures.bass > dropBassMin && ePeak > 0.04
  const isSilentNow = audioFeatures.energy < silenceMax && ePeak > 0.08

  return {
    energy: audioFeatures.energy,
    bass: audioFeatures.bass,
    energyAvg: eAvg,
    energyPeak: ePeak,
    bassPeak: bPeak,
    dropEnergyMin,
    dropBassMin,
    silenceMax,
    cooldownLeft,
    isDropNow,
    isSilentNow
  }
}
