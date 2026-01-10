import * as THREE from 'three'

export type MicStatus = 'off' | 'requesting' | 'on' | 'blocked' | 'no-device'

export interface BeatInfo {
  phase: number       // 0-1, position within beat
  intensity: number   // 0-1, beat strength
  isOnset: boolean    // true on beat hit
  bpm: number
}

export interface AudioFeatures {
  energy: number       // 0-1, overall RMS
  bass: number         // 0-1, low frequency energy
  mid: number          // 0-1, mid frequency energy
  high: number         // 0-1, high frequency energy
  spectrum: Float32Array // Full FFT data
  waveform: Float32Array // Time domain data
}

export interface SceneParameter {
  key: string
  label: string
  type: 'number' | 'color' | 'select'
  value: number | string
  min?: number
  max?: number
  step?: number
  options?: string[]
}

export interface Scene {
  name: string
  init(renderer: THREE.WebGLRenderer, width: number, height: number): void
  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void
  resize(width: number, height: number): void
  dispose(): void
  getParameters(): SceneParameter[]
  setParameter(key: string, value: number | string): void
  render(renderer: THREE.WebGLRenderer): void
}

export const defaultAudioFeatures: AudioFeatures = {
  energy: 0,
  bass: 0,
  mid: 0,
  high: 0,
  spectrum: new Float32Array(256),
  waveform: new Float32Array(256)
}

export const defaultBeatInfo: BeatInfo = {
  phase: 0,
  intensity: 0,
  isOnset: false,
  bpm: 140
}
