import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class PixelSymbolTunnel implements Scene {
  name = 'Pixel Symbol Tunnel'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private particles: THREE.Points
  private particleMaterial: THREE.ShaderMaterial
  private particleCount: number = 2000

  private width: number = 0
  private height: number = 0

  // Parameters
  private speed: number = 1.0
  private colorHue: number = 0.6 // Blue
  private pulseStrength: number = 1.0
  private symbolDensity: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    this.particles = new THREE.Points()
    this.particleMaterial = new THREE.ShaderMaterial()
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.camera.position.z = 0

    // Create particle geometry
    const positions = new Float32Array(this.particleCount * 3)
    const sizes = new Float32Array(this.particleCount)
    const symbols = new Float32Array(this.particleCount) // Symbol type
    const speeds = new Float32Array(this.particleCount)

    for (let i = 0; i < this.particleCount; i++) {
      // Distribute in a cylinder around the camera
      const angle = Math.random() * Math.PI * 2
      const radius = 5 + Math.random() * 15
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.sin(angle) * radius
      positions[i * 3 + 2] = -Math.random() * 200 // Depth

      sizes[i] = 10 + Math.random() * 30
      symbols[i] = Math.floor(Math.random() * 8) // 8 different symbol types
      speeds[i] = 0.5 + Math.random() * 1.0
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aSymbol', new THREE.BufferAttribute(symbols, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))

    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: this.speed },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uEnergy: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() }
      },
      vertexShader: `
        attribute float aSize;
        attribute float aSymbol;
        attribute float aSpeed;

        uniform float uTime;
        uniform float uSpeed;
        uniform float uPulse;
        uniform float uBass;
        uniform float uPixelRatio;

        varying float vSymbol;
        varying float vAlpha;
        varying float vPulse;

        void main() {
          vSymbol = aSymbol;
          vPulse = uPulse;

          // Animate position - move toward camera
          vec3 pos = position;
          pos.z = mod(pos.z + uTime * uSpeed * aSpeed * 50.0, 200.0) - 200.0;

          // Pulse expansion
          float pulseExpand = 1.0 + uPulse * 0.3 + uBass * 0.2;
          pos.xy *= pulseExpand;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          // Size based on distance and pulse
          float size = aSize * (1.0 + uPulse * 0.5);
          gl_PointSize = size * uPixelRatio * (100.0 / -mvPosition.z);

          // Fade based on distance
          vAlpha = smoothstep(-200.0, -20.0, pos.z) * smoothstep(0.0, -10.0, pos.z);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uColorHue;
        uniform float uEnergy;

        varying float vSymbol;
        varying float vAlpha;
        varying float vPulse;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        // Draw pixel art symbols
        float drawSymbol(vec2 uv, float symbol) {
          // Pixelate UV
          vec2 pixel = floor(uv * 8.0) / 8.0;
          vec2 localUv = pixel + 0.0625; // Center of pixel

          float s = 0.0;
          int sym = int(symbol);

          // Different pixel patterns for each symbol
          if (sym == 0) {
            // Cross
            s = (abs(localUv.x - 0.5) < 0.15 || abs(localUv.y - 0.5) < 0.15) ? 1.0 : 0.0;
          } else if (sym == 1) {
            // Diamond
            s = (abs(localUv.x - 0.5) + abs(localUv.y - 0.5) < 0.4) ? 1.0 : 0.0;
          } else if (sym == 2) {
            // Square outline
            s = (abs(localUv.x - 0.5) > 0.2 || abs(localUv.y - 0.5) > 0.2) &&
                (abs(localUv.x - 0.5) < 0.4 && abs(localUv.y - 0.5) < 0.4) ? 1.0 : 0.0;
          } else if (sym == 3) {
            // Arrow up
            float arrow = step(abs(localUv.x - 0.5), 0.5 - localUv.y * 0.8);
            s = arrow * step(0.1, localUv.y) * step(localUv.y, 0.9);
          } else if (sym == 4) {
            // Circle (pixelated)
            float d = length(localUv - 0.5);
            s = (d > 0.2 && d < 0.4) ? 1.0 : 0.0;
          } else if (sym == 5) {
            // Triangle
            s = (localUv.y > 0.2 && localUv.y < 0.5 - abs(localUv.x - 0.5) * 0.8 + 0.4) ? 1.0 : 0.0;
          } else if (sym == 6) {
            // Plus
            s = ((abs(localUv.x - 0.5) < 0.1 && localUv.y > 0.2 && localUv.y < 0.8) ||
                 (abs(localUv.y - 0.5) < 0.1 && localUv.x > 0.2 && localUv.x < 0.8)) ? 1.0 : 0.0;
          } else {
            // Star (4 points)
            float d = max(abs(localUv.x - 0.5), abs(localUv.y - 0.5));
            float d2 = abs(localUv.x - 0.5) + abs(localUv.y - 0.5);
            s = (d < 0.35 && (d < 0.15 || d2 < 0.35)) ? 1.0 : 0.0;
          }

          return s;
        }

        void main() {
          vec2 uv = gl_PointCoord;

          // Draw symbol
          float symbol = drawSymbol(uv, vSymbol);

          if (symbol < 0.5) discard;

          // Color with hue variation
          float hue = uColorHue + vSymbol * 0.1;
          vec3 color = hsl2rgb(mod(hue, 1.0), 0.9, 0.6);

          // Brighten on pulse
          color += vec3(1.0) * vPulse * 0.5;

          // Energy boost
          color *= 1.0 + uEnergy * 0.5;

          gl_FragColor = vec4(color, vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    this.particles = new THREE.Points(geometry, this.particleMaterial)
    this.scene.add(this.particles)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    this.time = time

    // Update pulse
    if (beat.isOnset) {
      this.currentPulse = 1.0
    }
    this.currentPulse *= 0.85

    // Update uniforms
    this.particleMaterial.uniforms.uTime.value = time * 0.001
    this.particleMaterial.uniforms.uSpeed.value = this.speed * (1 + audio.energy * 0.5)
    this.particleMaterial.uniforms.uPulse.value = this.currentPulse * this.pulseStrength
    this.particleMaterial.uniforms.uColorHue.value = this.colorHue
    this.particleMaterial.uniforms.uBass.value = audio.bass
    this.particleMaterial.uniforms.uEnergy.value = audio.energy

    // Rotate tunnel slightly
    this.particles.rotation.z = Math.sin(time * 0.0003) * 0.1

    // FOV pulse
    this.camera.fov = 75 + audio.bass * 10
    this.camera.updateProjectionMatrix()
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.particles.geometry.dispose()
    this.particleMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'speed', label: 'Speed', type: 'number', value: this.speed, min: 0.1, max: 3, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'pulseStrength', label: 'Pulse', type: 'number', value: this.pulseStrength, min: 0, max: 2, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'speed':
        this.speed = value as number
        break
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'pulseStrength':
        this.pulseStrength = value as number
        break
    }
  }
}
