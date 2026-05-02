import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class SpectrumBars3D implements Scene {
  name = 'Spectrum Bars 3D'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private bars!: THREE.InstancedMesh
  private floor!: THREE.Mesh
  private floorMat!: THREE.ShaderMaterial
  private barCount: number = 64

  private barHeights: Float32Array = new Float32Array(64)
  private dummy: THREE.Object3D = new THREE.Object3D()
  private color: THREE.Color = new THREE.Color()
  private camOrbit: number = 0

  private colorHue: number = 0.6
  private orbit: number = 1.0
  private currentPulse: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200)
  }

  init(_renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    // Bars — instanced for perf
    const barGeom = new THREE.BoxGeometry(0.8, 1, 0.8)
    barGeom.translate(0, 0.5, 0) // base at y=0, scale grows up
    const barMat = new THREE.MeshBasicMaterial()
    this.bars = new THREE.InstancedMesh(barGeom, barMat, this.barCount)
    this.bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    // Place bars in a row centered at origin
    const spacing = 1.0
    for (let i = 0; i < this.barCount; i++) {
      const x = (i - this.barCount / 2 + 0.5) * spacing
      this.dummy.position.set(x, 0, 0)
      this.dummy.scale.set(1, 0.1, 1)
      this.dummy.updateMatrix()
      this.bars.setMatrixAt(i, this.dummy.matrix)
      this.color.setHSL((i / this.barCount + this.colorHue) % 1, 1, 0.5)
      this.bars.setColorAt(i, this.color)
    }
    this.bars.instanceMatrix.needsUpdate = true
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true
    this.scene.add(this.bars)

    // Reflective floor with grid shader
    const floorGeom = new THREE.PlaneGeometry(200, 200)
    floorGeom.rotateX(-Math.PI / 2)
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPulse;
        uniform float uColorHue;
        varying vec2 vUv;
        varying vec3 vWorld;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          // Grid lines
          vec2 g = abs(fract(vWorld.xz * 0.25) - 0.5);
          float line = 1.0 - smoothstep(0.0, 0.05, min(g.x, g.y));

          // Distance fade
          float dist = length(vWorld.xz);
          float fade = exp(-dist * 0.02);

          vec3 base = hsl2rgb(uColorHue, 0.9, 0.5);
          vec3 col = base * line * fade * (0.6 + uPulse * 0.4);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
    this.floor = new THREE.Mesh(floorGeom, this.floorMat)
    this.floor.position.y = 0
    this.scene.add(this.floor)

    // Camera position
    this.camera.position.set(0, 8, 30)
    this.camera.lookAt(0, 4, 0)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    if (beat.isOnset) this.currentPulse = 1.0
    this.currentPulse *= 0.85

    const dt = deltaTime * 0.001
    this.camOrbit += dt * this.orbit * 0.3

    // Sample spectrum into bar heights with smoothing.
    // Spectrum is FFT magnitude — concentrate on the lower 2/3 for music-relevant range.
    const spec = audio.spectrum
    const useLen = Math.min(spec.length, this.barCount * 3)
    for (let i = 0; i < this.barCount; i++) {
      // Map bar i to a frequency bin (logish spread to favor lows/mids)
      const t = i / (this.barCount - 1)
      const idx = Math.min(useLen - 1, Math.floor(Math.pow(t, 1.6) * useLen))
      // Spectrum values are 0-1ish (already normalized in AudioAnalyzer typical impl)
      const raw = Math.max(0, spec[idx])
      // Smooth attack/decay
      const target = Math.min(1.5, raw * 4.0 + audio.bass * 0.2)
      const prev = this.barHeights[i]
      this.barHeights[i] = target > prev ? prev + (target - prev) * 0.5 : prev * 0.92
    }

    // Apply to instances
    const spacing = 1.0
    for (let i = 0; i < this.barCount; i++) {
      const x = (i - this.barCount / 2 + 0.5) * spacing
      const h = Math.max(0.1, this.barHeights[i] * 8.0 + this.currentPulse * 0.5)
      this.dummy.position.set(x, 0, 0)
      this.dummy.scale.set(1, h, 1)
      this.dummy.updateMatrix()
      this.bars.setMatrixAt(i, this.dummy.matrix)

      const hue = (i / this.barCount + this.colorHue + time * 0.00005) % 1
      const sat = 1.0
      const light = 0.45 + this.barHeights[i] * 0.3 + this.currentPulse * 0.1
      this.color.setHSL(hue, sat, Math.min(0.85, light))
      this.bars.setColorAt(i, this.color)
    }
    this.bars.instanceMatrix.needsUpdate = true
    if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true

    // Camera orbits and breathes with bass
    const radius = 28 + audio.bass * 6
    this.camera.position.x = Math.sin(this.camOrbit) * radius
    this.camera.position.z = Math.cos(this.camOrbit) * radius
    this.camera.position.y = 7 + audio.energy * 2
    this.camera.lookAt(0, 3, 0)

    this.floorMat.uniforms.uTime.value = time * 0.001
    this.floorMat.uniforms.uPulse.value = this.currentPulse
    this.floorMat.uniforms.uColorHue.value = this.colorHue
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.bars.geometry.dispose()
    ;(this.bars.material as THREE.Material).dispose()
    this.floor.geometry.dispose()
    this.floorMat.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'orbit', label: 'Orbit', type: 'number', value: this.orbit, min: 0, max: 3, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    if (key === 'colorHue') this.colorHue = value as number
    else if (key === 'orbit') this.orbit = value as number
  }
}
