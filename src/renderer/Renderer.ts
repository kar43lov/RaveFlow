import * as THREE from 'three'
import { PostProcessing } from './PostProcessing'
import { Quality } from '../store/useStore'

export class Renderer {
  private renderer: THREE.WebGLRenderer
  private postProcessing: PostProcessing
  private renderTarget: THREE.WebGLRenderTarget

  private width: number = 0
  private height: number = 0
  private pixelRatio: number = 1
  private quality: Quality = 'medium'

  constructor(canvas: HTMLCanvasElement) {
    // Create WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    })

    this.renderer.setClearColor(0x000000, 1)
    this.renderer.autoClear = true

    // Initial size
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.updatePixelRatio()

    // Create render target for scene rendering
    this.renderTarget = new THREE.WebGLRenderTarget(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
      }
    )

    // Create post-processing
    this.postProcessing = new PostProcessing(
      this.renderer,
      this.width * this.pixelRatio,
      this.height * this.pixelRatio
    )

    // Apply initial quality
    this.setQuality(this.quality)
  }

  private updatePixelRatio(): void {
    switch (this.quality) {
      case 'low':
        this.pixelRatio = 0.5
        break
      case 'medium':
        this.pixelRatio = 1
        break
      case 'high':
        this.pixelRatio = Math.min(window.devicePixelRatio, 2)
        break
    }
  }

  setQuality(quality: Quality): void {
    this.quality = quality
    this.updatePixelRatio()

    // Update renderer size
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(this.pixelRatio)

    // Update render target
    this.renderTarget.setSize(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio
    )

    // Update post-processing
    this.postProcessing.resize(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio
    )

    // Enable/disable bloom based on quality
    this.postProcessing.setEnabled(quality !== 'low')
    this.postProcessing.setBloomStrength(quality === 'high' ? 0.7 : 0.5)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.updatePixelRatio()

    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(this.pixelRatio)

    this.renderTarget.setSize(
      width * this.pixelRatio,
      height * this.pixelRatio
    )

    this.postProcessing.resize(
      width * this.pixelRatio,
      height * this.pixelRatio
    )
  }

  getWidth(): number {
    return this.width
  }

  getHeight(): number {
    return this.height
  }

  getPixelRatio(): number {
    return this.pixelRatio
  }

  getWebGLRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  getRenderTarget(): THREE.WebGLRenderTarget {
    return this.renderTarget
  }

  // Render scene to render target
  renderScene(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.setRenderTarget(this.renderTarget)
    this.renderer.render(scene, camera)
  }

  // Apply post-processing and render to screen
  renderToScreen(): void {
    this.postProcessing.render(this.renderTarget.texture)
  }

  // Combined render method
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderScene(scene, camera)
    this.renderToScreen()
  }

  dispose(): void {
    this.renderTarget.dispose()
    this.postProcessing.dispose()
    this.renderer.dispose()
  }
}
