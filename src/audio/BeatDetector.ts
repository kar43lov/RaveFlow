import { clamp } from '../utils/math'

export class BeatDetector {
  private sampleRate: number
  private sensitivity: number = 0.5
  private smoothing: number = 0.8

  // Onset detection
  private energyHistory: number[] = []
  private historySize: number = 43 // ~1 second at 43 fps
  private lastEnergy: number = 0
  private threshold: number = 0

  // BPM estimation
  private onsetTimes: number[] = []
  private maxOnsets: number = 32
  private estimatedBPM: number = 140
  private bpmLocked: boolean = false
  private lockedBPM: number = 140

  // Detection state
  private lastOnsetTime: number = 0
  private minOnsetInterval: number = 200 // ms - minimum time between onsets

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate
  }

  setSensitivity(value: number): void {
    this.sensitivity = clamp(value, 0, 1)
  }

  setSmoothing(value: number): void {
    this.smoothing = clamp(value, 0, 0.99)
  }

  // Detect onset from frequency data
  detectOnset(frequencyData: Float32Array, bassData: Float32Array): boolean {
    const now = performance.now()

    // Calculate current energy (weighted toward bass)
    let energy = 0
    const bassWeight = 0.7
    const fullWeight = 0.3

    // Bass energy (first ~20 bins, roughly 0-500Hz depending on FFT size)
    for (let i = 0; i < Math.min(20, bassData.length); i++) {
      energy += bassData[i] * bassData[i] * bassWeight
    }

    // Full spectrum energy
    for (let i = 0; i < frequencyData.length; i++) {
      energy += frequencyData[i] * frequencyData[i] * fullWeight
    }

    energy = Math.sqrt(energy / frequencyData.length)

    // Smooth energy
    energy = this.lastEnergy * this.smoothing + energy * (1 - this.smoothing)
    this.lastEnergy = energy

    // Add to history
    this.energyHistory.push(energy)
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift()
    }

    // Need enough history
    if (this.energyHistory.length < 10) {
      return false
    }

    // Calculate adaptive threshold
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    const variance = this.energyHistory.reduce((a, b) => a + Math.pow(b - avgEnergy, 2), 0) / this.energyHistory.length
    const stdDev = Math.sqrt(variance)

    // Threshold based on sensitivity
    const sensitivityFactor = 1.5 - this.sensitivity // Lower sensitivity = higher threshold
    this.threshold = avgEnergy + stdDev * sensitivityFactor

    // Detect onset
    const isOnset = energy > this.threshold && (now - this.lastOnsetTime) > this.minOnsetInterval

    if (isOnset) {
      this.lastOnsetTime = now
      this.recordOnset(now)
    }

    return isOnset
  }

  private recordOnset(time: number): void {
    this.onsetTimes.push(time)
    if (this.onsetTimes.length > this.maxOnsets) {
      this.onsetTimes.shift()
    }

    if (!this.bpmLocked) {
      this.estimateBPM()
    }
  }

  private estimateBPM(): void {
    if (this.onsetTimes.length < 4) return

    // Calculate intervals between consecutive onsets
    const intervals: number[] = []
    for (let i = 1; i < this.onsetTimes.length; i++) {
      const interval = this.onsetTimes[i] - this.onsetTimes[i - 1]
      // Filter out unreasonable intervals (expecting 120-190 BPM)
      if (interval > 315 && interval < 500) { // ~120-190 BPM range
        intervals.push(interval)
      }
    }

    if (intervals.length < 2) return

    // Use histogram approach to find most common interval
    const bucketSize = 10 // ms
    const buckets: Map<number, number> = new Map()

    for (const interval of intervals) {
      const bucket = Math.round(interval / bucketSize) * bucketSize
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1)
    }

    // Find the most common bucket
    let maxCount = 0
    let bestInterval = 428 // Default to 140 BPM

    for (const [interval, count] of buckets) {
      if (count > maxCount) {
        maxCount = count
        bestInterval = interval
      }
    }

    // Convert to BPM
    const bpm = Math.round(60000 / bestInterval)

    // Smooth the estimate
    if (bpm >= 120 && bpm <= 190) {
      this.estimatedBPM = Math.round(this.estimatedBPM * 0.7 + bpm * 0.3)
    }
  }

  getEstimatedBPM(): number {
    return this.bpmLocked ? this.lockedBPM : this.estimatedBPM
  }

  lockBPM(): void {
    this.bpmLocked = true
    this.lockedBPM = this.estimatedBPM
  }

  unlockBPM(): void {
    this.bpmLocked = false
  }

  isLocked(): boolean {
    return this.bpmLocked
  }

  reset(): void {
    this.energyHistory = []
    this.onsetTimes = []
    this.lastEnergy = 0
    this.lastOnsetTime = 0
    this.estimatedBPM = 140
    this.bpmLocked = false
  }
}
