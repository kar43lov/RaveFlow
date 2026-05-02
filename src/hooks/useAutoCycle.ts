import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { AudioFeatures } from '../scenes/types'

const HISTORY_FRAMES = 360       // ~6s of history at 60fps
const JUMP_LOOKBACK_FRAMES = 30  // ~0.5s — compares current vs ~half a second ago

const lerp = (low: number, high: number, t: number) => low + (high - low) * t

interface AutoCycleRefs {
  lastSwitch: number
  energyHist: number[]
  bassHist: number[]
}

/**
 * Adaptive thresholds for the music listener. Sensitivity 0 = "only the
 * absolute hardest drops fire it"; sensitivity 1 = "any meaningful change
 * fires it".
 *
 * In addition to peak/avg level checks, drops require a "jump" — the
 * current energy must be substantially higher than it was ~0.5s ago.
 * This kills the false positives on tracks that are just continuously
 * loud (where energy hovers near peak the whole time).
 */
function computeThresholds(s: number, ePeak: number, eAvg: number, bPeak: number) {
  // Drop level must approach the recent peak at low sensitivity, and just
  // exceed the rolling average at high sensitivity.
  const eRange = ePeak - eAvg
  return {
    // Drop in energy: ratio of (peak - avg) above avg
    dropEnergyMin: lerp(eAvg + eRange * 0.95, eAvg + eRange * 0.20, s),
    // Drop in bass: fraction of recent bass peak
    dropBassMin: lerp(bPeak * 0.95, bPeak * 0.35, s),
    // Sudden surge: how big a jump from ~0.5s ago is required
    dropJumpRatio: lerp(2.5, 1.08, s),
    // Silence: how small relative to peak counts as "quiet"
    silenceFrac: lerp(0.05, 0.30, s),
    // Silence: how steep the fall from ~0.5s ago must be (e.g. 4.0 = energy
    // dropped to 1/4 of what it was)
    silenceFallRatio: lerp(4.0, 1.3, s)
  }
}

/**
 * Auto-switch scenes based on user's autoCycle settings.
 *
 * Modes:
 * - 'timed': fires nextScene() every autoCycleInterval seconds.
 * - 'auto' (by music): drop / silence detection, throttled by cooldown.
 * - 'hybrid': both — timer ticks AND music can trigger early.
 *
 * Music thresholds are adaptive (peak/avg/range from recent history) and
 * also demand a jump or fall vs ~0.5s ago, so that they fire on *changes*
 * rather than on sustained loud or sustained quiet music.
 *
 * The cooldown is a separate user-controlled minimum gap (5..60s).
 * Sensitivity controls trigger strictness only, not timing.
 */
export function useAutoCycle(audioFeatures: AudioFeatures): void {
  const enabled = useStore((s) => s.autoCycleEnabled)
  const mode = useStore((s) => s.autoCycleMode)
  const interval = useStore((s) => s.autoCycleInterval)
  const sensitivity = useStore((s) => s.autoCycleSensitivity)
  const cooldown = useStore((s) => s.autoCycleCooldown)
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

    const elapsed = (performance.now() - r.lastSwitch) / 1000
    if (elapsed < cooldown) return

    if (r.energyHist.length < 120) return // ~2s baseline

    // Recent stats
    let ePeak = 0, eFloor = 1, eSum = 0
    for (const v of r.energyHist) {
      if (v > ePeak) ePeak = v
      if (v < eFloor) eFloor = v
      eSum += v
    }
    const eAvg = eSum / r.energyHist.length

    let bPeak = 0
    for (const v of r.bassHist) if (v > bPeak) bPeak = v

    if (ePeak < 0.04) return // mic effectively silent

    const t = computeThresholds(sensitivity, ePeak, eAvg, bPeak)

    // ~0.5s ago for jump/fall comparison
    const lookbackIdx = Math.max(0, r.energyHist.length - JUMP_LOOKBACK_FRAMES)
    const ePrev = r.energyHist[lookbackIdx]

    const isLoudNow = audioFeatures.energy > t.dropEnergyMin
    const isBassHit = audioFeatures.bass > t.dropBassMin
    const isJumping = ePrev > 0.001 && audioFeatures.energy > ePrev * t.dropJumpRatio
    const isDrop = isLoudNow && isBassHit && isJumping

    const isQuietNow = audioFeatures.energy < ePeak * t.silenceFrac
    const wasLoud = ePeak > 0.1
    const isFalling = audioFeatures.energy > 0
      ? ePrev > audioFeatures.energy * t.silenceFallRatio
      : ePrev > 0.05
    const isSilent = isQuietNow && wasLoud && isFalling

    if (isDrop || isSilent) {
      nextScene()
    }
  }, [audioFeatures, enabled, mode, sensitivity, cooldown, isPaused, nextScene])
}

export interface AutoCycleDebug {
  energy: number
  bass: number
  energyAvg: number
  energyPeak: number
  bassPeak: number
  energyPrev: number
  dropEnergyMin: number
  dropBassMin: number
  dropJumpRatio: number
  silenceMax: number
  cooldownLeft: number
  isDropNow: boolean
  isSilentNow: boolean
}

/**
 * Read-only mirror for the debug overlay. Computes the same numbers as
 * useAutoCycle without firing any switches. Updates each render.
 */
export function useAutoCycleDebug(audioFeatures: AudioFeatures): AutoCycleDebug | null {
  const enabled = useStore((s) => s.autoCycleEnabled)
  const mode = useStore((s) => s.autoCycleMode)
  const sensitivity = useStore((s) => s.autoCycleSensitivity)
  const cooldown = useStore((s) => s.autoCycleCooldown)
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

  const t = computeThresholds(sensitivity, ePeak, eAvg, bPeak)
  const silenceMax = ePeak * t.silenceFrac

  const lookbackIdx = Math.max(0, r.energyHist.length - JUMP_LOOKBACK_FRAMES)
  const ePrev = r.energyHist[lookbackIdx] ?? 0

  const elapsed = (performance.now() - r.lastSwitch) / 1000
  const cooldownLeft = Math.max(0, cooldown - elapsed)

  const isLoudNow = audioFeatures.energy > t.dropEnergyMin
  const isBassHit = audioFeatures.bass > t.dropBassMin
  const isJumping = ePrev > 0.001 && audioFeatures.energy > ePrev * t.dropJumpRatio
  const isDropNow = isLoudNow && isBassHit && isJumping && ePeak > 0.04

  const isQuietNow = audioFeatures.energy < silenceMax
  const wasLoud = ePeak > 0.1
  const isFalling = audioFeatures.energy > 0
    ? ePrev > audioFeatures.energy * t.silenceFallRatio
    : ePrev > 0.05
  const isSilentNow = isQuietNow && wasLoud && isFalling

  return {
    energy: audioFeatures.energy,
    bass: audioFeatures.bass,
    energyAvg: eAvg,
    energyPeak: ePeak,
    bassPeak: bPeak,
    energyPrev: ePrev,
    dropEnergyMin: t.dropEnergyMin,
    dropBassMin: t.dropBassMin,
    dropJumpRatio: t.dropJumpRatio,
    silenceMax,
    cooldownLeft,
    isDropNow,
    isSilentNow
  }
}
