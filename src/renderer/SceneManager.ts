import * as THREE from 'three'
import { Scene, BeatInfo, AudioFeatures, defaultAudioFeatures, defaultBeatInfo } from '../scenes/types'
import { Renderer } from './Renderer'

// Import all scenes
import { VortexTunnel } from '../scenes/VortexTunnel'
import { GridCorridor } from '../scenes/GridCorridor'
import { NeonMazeChase } from '../scenes/NeonMazeChase'
import { PixelSymbolTunnel } from '../scenes/PixelSymbolTunnel'
import { CrowdPulse } from '../scenes/CrowdPulse'
import { LaserStorm } from '../scenes/LaserStorm'
// New scenes
import { BouncingBall } from '../scenes/BouncingBall'
import { RunningMan } from '../scenes/RunningMan'
import { DJBoothStrobe } from '../scenes/DJBoothStrobe'
import { PongBattle } from '../scenes/PongBattle'
import { WaveformOcean } from '../scenes/WaveformOcean'
import { ParticleExplosion } from '../scenes/ParticleExplosion'
import { GeometricMorph } from '../scenes/GeometricMorph'
import { Kaleidoscope } from '../scenes/Kaleidoscope'
import { CityFlythrough } from '../scenes/CityFlythrough'

export class SceneManager {
  private renderer: Renderer
  private scenes: Scene[] = []
  private currentSceneIndex: number = 0
  private initialized: boolean = false

  constructor(renderer: Renderer) {
    this.renderer = renderer
  }

  init(): void {
    if (this.initialized) return

    const webglRenderer = this.renderer.getWebGLRenderer()
    const width = this.renderer.getWidth()
    const height = this.renderer.getHeight()

    // Create all scenes
    this.scenes = [
      new VortexTunnel(),
      new GridCorridor(),
      new NeonMazeChase(),
      new PixelSymbolTunnel(),
      new CrowdPulse(),
      new LaserStorm(),
      // New scenes
      new BouncingBall(),
      new RunningMan(),
      new DJBoothStrobe(),
      new PongBattle(),
      new WaveformOcean(),
      new ParticleExplosion(),
      new GeometricMorph(),
      new Kaleidoscope(),
      new CityFlythrough()
    ]

    // Initialize all scenes
    for (const scene of this.scenes) {
      scene.init(webglRenderer, width, height)
    }

    this.initialized = true
  }

  getSceneCount(): number {
    return this.scenes.length
  }

  getSceneNames(): string[] {
    return this.scenes.map(s => s.name)
  }

  getCurrentScene(): Scene | null {
    return this.scenes[this.currentSceneIndex] || null
  }

  getCurrentSceneIndex(): number {
    return this.currentSceneIndex
  }

  setCurrentSceneIndex(index: number): void {
    if (index >= 0 && index < this.scenes.length) {
      this.currentSceneIndex = index
    }
  }

  nextScene(): void {
    this.currentSceneIndex = (this.currentSceneIndex + 1) % this.scenes.length
  }

  prevScene(): void {
    this.currentSceneIndex = (this.currentSceneIndex - 1 + this.scenes.length) % this.scenes.length
  }

  update(
    time: number,
    deltaTime: number,
    beat: BeatInfo = defaultBeatInfo,
    audio: AudioFeatures = defaultAudioFeatures
  ): void {
    const scene = this.getCurrentScene()
    if (scene) {
      scene.update(time, deltaTime, beat, audio)
    }
  }

  render(): void {
    const scene = this.getCurrentScene()
    if (scene) {
      const webglRenderer = this.renderer.getWebGLRenderer()
      const renderTarget = this.renderer.getRenderTarget()

      // Render scene to render target for post-processing
      webglRenderer.setRenderTarget(renderTarget)
      scene.render(webglRenderer)

      // Apply post-processing and render to screen
      this.renderer.renderToScreen()
    }
  }

  resize(width: number, height: number): void {
    for (const scene of this.scenes) {
      scene.resize(width, height)
    }
  }

  dispose(): void {
    for (const scene of this.scenes) {
      scene.dispose()
    }
    this.scenes = []
    this.initialized = false
  }
}
