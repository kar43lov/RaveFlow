import { BeatInfo } from '../scenes/types'

export class BeatClock {
  private bpm: number = 140
  private startTime: number = 0
  private lastBeatTime: number = 0
  private beatCount: number = 0
  private isRunning: boolean = false

  constructor(bpm: number = 140) {
    this.bpm = bpm
  }

  start(): void {
    this.startTime = performance.now()
    this.lastBeatTime = this.startTime
    this.beatCount = 0
    this.isRunning = true
  }

  stop(): void {
    this.isRunning = false
  }

  setBPM(bpm: number): void {
    if (bpm !== this.bpm) {
      // Adjust start time to maintain phase continuity
      const currentPhase = this.getPhase()
      this.bpm = bpm
      const beatDuration = 60000 / this.bpm
      this.startTime = performance.now() - currentPhase * beatDuration
    }
  }

  getBPM(): number {
    return this.bpm
  }

  private getPhase(): number {
    if (!this.isRunning) return 0
    const now = performance.now()
    const beatDuration = 60000 / this.bpm
    const elapsed = now - this.startTime
    return (elapsed % beatDuration) / beatDuration
  }

  update(): BeatInfo {
    if (!this.isRunning) {
      return {
        phase: 0,
        intensity: 0,
        isOnset: false,
        bpm: this.bpm
      }
    }

    const now = performance.now()
    const beatDuration = 60000 / this.bpm
    const elapsed = now - this.startTime
    const phase = (elapsed % beatDuration) / beatDuration

    // Detect beat onset (phase crossed 0)
    const currentBeat = Math.floor(elapsed / beatDuration)
    const isOnset = currentBeat > this.beatCount
    if (isOnset) {
      this.beatCount = currentBeat
      this.lastBeatTime = now
    }

    // Calculate intensity based on phase (peak at onset, decay over time)
    const timeSinceLastBeat = now - this.lastBeatTime
    const decayTime = beatDuration * 0.3 // 30% of beat duration
    const intensity = Math.max(0, 1 - timeSinceLastBeat / decayTime)

    return {
      phase,
      intensity,
      isOnset,
      bpm: this.bpm
    }
  }
}

// Tap tempo helper
export class TapTempo {
  private taps: number[] = []
  private maxTaps: number = 8
  private maxInterval: number = 2000 // ms - reset if gap is too large

  tap(): number | null {
    const now = performance.now()

    // Reset if too long since last tap
    if (this.taps.length > 0 && now - this.taps[this.taps.length - 1] > this.maxInterval) {
      this.taps = []
    }

    this.taps.push(now)

    // Keep only recent taps
    if (this.taps.length > this.maxTaps) {
      this.taps.shift()
    }

    // Need at least 2 taps to calculate BPM
    if (this.taps.length < 2) {
      return null
    }

    // Calculate average interval
    let totalInterval = 0
    for (let i = 1; i < this.taps.length; i++) {
      totalInterval += this.taps[i] - this.taps[i - 1]
    }
    const avgInterval = totalInterval / (this.taps.length - 1)

    // Convert to BPM
    const bpm = 60000 / avgInterval

    // Clamp to reasonable range
    return Math.max(60, Math.min(200, Math.round(bpm)))
  }

  reset(): void {
    this.taps = []
  }
}
