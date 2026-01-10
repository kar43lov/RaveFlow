import { AudioFeatures, MicStatus, defaultAudioFeatures } from '../scenes/types'
import { BeatDetector } from './BeatDetector'
import { clamp } from '../utils/math'

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null

  private frequencyData: Float32Array<ArrayBuffer> = new Float32Array(256)
  private timeDomainData: Float32Array<ArrayBuffer> = new Float32Array(256)

  private beatDetector: BeatDetector
  private micStatus: MicStatus = 'off'

  private smoothedFeatures: AudioFeatures = { ...defaultAudioFeatures }
  private smoothing: number = 0.8
  private sensitivity: number = 0.5

  private isOnset: boolean = false
  private lastOnsetTime: number = 0

  constructor() {
    this.beatDetector = new BeatDetector()
  }

  async init(): Promise<void> {
    // AudioContext will be created when mic is started
  }

  async startMic(): Promise<MicStatus> {
    if (this.micStatus === 'on') {
      return 'on'
    }

    this.micStatus = 'requesting'

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.micStatus = 'no-device'
        return this.micStatus
      }

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      // Create audio context
      this.audioContext = new AudioContext()

      // Create analyser
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.3

      // Initialize data arrays
      this.frequencyData = new Float32Array(this.analyser.frequencyBinCount)
      this.timeDomainData = new Float32Array(this.analyser.fftSize)

      // Connect source to analyser
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.source.connect(this.analyser)

      // Update beat detector sample rate
      this.beatDetector = new BeatDetector(this.audioContext.sampleRate)
      this.beatDetector.setSensitivity(this.sensitivity)
      this.beatDetector.setSmoothing(this.smoothing)

      this.micStatus = 'on'
      return this.micStatus
    } catch (err) {
      console.error('Failed to start microphone:', err)

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          this.micStatus = 'blocked'
        } else if (err.name === 'NotFoundError') {
          this.micStatus = 'no-device'
        } else {
          this.micStatus = 'blocked'
        }
      } else {
        this.micStatus = 'blocked'
      }

      return this.micStatus
    }
  }

  stopMic(): void {
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
    this.micStatus = 'off'
    this.beatDetector.reset()
    this.smoothedFeatures = { ...defaultAudioFeatures }
  }

  dispose(): void {
    this.stopMic()
  }

  getMicStatus(): MicStatus {
    return this.micStatus
  }

  update(): void {
    if (!this.analyser || this.micStatus !== 'on') return

    // Get frequency data (in dB)
    this.analyser.getFloatFrequencyData(this.frequencyData)
    this.analyser.getFloatTimeDomainData(this.timeDomainData)

    // Normalize frequency data from dB (-100 to 0) to 0-1
    const normalizedFreq = new Float32Array(this.frequencyData.length)
    for (let i = 0; i < this.frequencyData.length; i++) {
      // dB range is typically -100 to 0
      normalizedFreq[i] = clamp((this.frequencyData[i] + 100) / 100, 0, 1)
    }

    // Calculate energy bands
    const binCount = normalizedFreq.length
    const bassEnd = Math.floor(binCount * 0.1)    // ~0-500Hz
    const midEnd = Math.floor(binCount * 0.5)     // ~500-5000Hz

    let bassEnergy = 0
    let midEnergy = 0
    let highEnergy = 0
    let totalEnergy = 0

    for (let i = 0; i < binCount; i++) {
      const val = normalizedFreq[i]
      totalEnergy += val

      if (i < bassEnd) {
        bassEnergy += val
      } else if (i < midEnd) {
        midEnergy += val
      } else {
        highEnergy += val
      }
    }

    // Normalize by band size
    bassEnergy = bassEnergy / bassEnd
    midEnergy = midEnergy / (midEnd - bassEnd)
    highEnergy = highEnergy / (binCount - midEnd)
    totalEnergy = totalEnergy / binCount

    // Calculate RMS from time domain
    let rms = 0
    for (let i = 0; i < this.timeDomainData.length; i++) {
      rms += this.timeDomainData[i] * this.timeDomainData[i]
    }
    rms = Math.sqrt(rms / this.timeDomainData.length)

    // Apply sensitivity
    const sensitivityMult = 0.5 + this.sensitivity * 1.5
    bassEnergy = clamp(bassEnergy * sensitivityMult, 0, 1)
    midEnergy = clamp(midEnergy * sensitivityMult, 0, 1)
    highEnergy = clamp(highEnergy * sensitivityMult, 0, 1)
    totalEnergy = clamp(rms * sensitivityMult * 3, 0, 1)

    // Smooth the values
    this.smoothedFeatures.bass = this.smoothedFeatures.bass * this.smoothing + bassEnergy * (1 - this.smoothing)
    this.smoothedFeatures.mid = this.smoothedFeatures.mid * this.smoothing + midEnergy * (1 - this.smoothing)
    this.smoothedFeatures.high = this.smoothedFeatures.high * this.smoothing + highEnergy * (1 - this.smoothing)
    this.smoothedFeatures.energy = this.smoothedFeatures.energy * this.smoothing + totalEnergy * (1 - this.smoothing)

    // Copy spectrum and waveform
    this.smoothedFeatures.spectrum = normalizedFreq.slice() as Float32Array<ArrayBuffer>
    this.smoothedFeatures.waveform = this.timeDomainData.slice() as Float32Array<ArrayBuffer>

    // Detect beats
    const bassData = normalizedFreq.slice(0, bassEnd)
    this.isOnset = this.beatDetector.detectOnset(normalizedFreq, bassData)

    if (this.isOnset) {
      this.lastOnsetTime = performance.now()
    }
  }

  getFeatures(): AudioFeatures {
    return this.smoothedFeatures
  }

  isCurrentlyOnset(): boolean {
    // Return true for a short window after onset
    const now = performance.now()
    return now - this.lastOnsetTime < 50
  }

  getEstimatedBPM(): number {
    return this.beatDetector.getEstimatedBPM()
  }

  isLocked(): boolean {
    return this.beatDetector.isLocked()
  }

  lockBPM(): void {
    this.beatDetector.lockBPM()
  }

  unlockBPM(): void {
    this.beatDetector.unlockBPM()
  }

  setSensitivity(value: number): void {
    this.sensitivity = clamp(value, 0, 1)
    this.beatDetector.setSensitivity(value)
  }

  setSmoothing(value: number): void {
    this.smoothing = clamp(value, 0, 0.99)
    this.beatDetector.setSmoothing(value)
  }
}
