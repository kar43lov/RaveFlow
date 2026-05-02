import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

const MAX_RINGS = 8

interface Ring {
  age: number      // 0 = freshly born, grows with time
  hue: number      // ring color
  amp: number      // initial amplitude (intensity)
  alive: boolean
}

export class BeatShockwaves implements Scene {
  name = 'Beat Shockwaves'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private aspect: number = 1
  private colorHue: number = 0.85
  private waveSpeed: number = 1.0

  private rings: Ring[] = Array.from({ length: MAX_RINGS }, () => ({ age: 99, hue: 0, amp: 0, alive: false }))
  private ringRadii: Float32Array = new Float32Array(MAX_RINGS)
  private ringHues: Float32Array = new Float32Array(MAX_RINGS)
  private ringAmps: Float32Array = new Float32Array(MAX_RINGS)
  private hueShift: number = 0

  private currentPulse: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.material = new THREE.ShaderMaterial()
    this.mesh = new THREE.Mesh()
  }

  init(_renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.aspect = width / height
    this.camera.left = -this.aspect
    this.camera.right = this.aspect
    this.camera.updateProjectionMatrix()
    this.camera.position.z = 1

    const geometry = new THREE.PlaneGeometry(2 * this.aspect, 2)

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uRingRadii: { value: this.ringRadii },
        uRingHues: { value: this.ringHues },
        uRingAmps: { value: this.ringAmps }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uPulse;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uMid;
        uniform float uHigh;
        uniform float uEnergy;
        uniform float uRingRadii[${MAX_RINGS}];
        uniform float uRingHues[${MAX_RINGS}];
        uniform float uRingAmps[${MAX_RINGS}];
        varying vec2 vUv;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 uv = (vUv - 0.5) * 2.0 * aspect;
          float r = length(uv);
          float angle = atan(uv.y, uv.x);

          // --- Background grid floor ---
          // Distort grid coords by sum of waves so the grid "ripples" with each ring
          vec2 distort = vec2(0.0);
          float waveField = 0.0;

          for (int i = 0; i < ${MAX_RINGS}; i++) {
            float radius = uRingRadii[i];
            float amp = uRingAmps[i];
            if (amp < 0.001) continue;

            float dr = r - radius;
            // Ring profile: thin bright crest with soft falloff
            float w = exp(-dr * dr * 60.0) * amp;
            waveField += w;

            // Distortion: push uv outward at the wavefront
            distort += normalize(uv + 0.0001) * w * 0.05;
          }

          vec2 distortedUv = uv + distort;
          vec2 g = abs(fract(distortedUv * 4.0) - 0.5);
          float grid = 1.0 - smoothstep(0.0, 0.04, min(g.x, g.y));
          float gridFade = exp(-r * 0.3);
          vec3 gridColor = hsl2rgb(mod(uColorHue + 0.5, 1.0), 0.7, 0.4) * grid * gridFade * 0.5;

          // --- Rings on top ---
          vec3 ringColor = vec3(0.0);
          for (int i = 0; i < ${MAX_RINGS}; i++) {
            float radius = uRingRadii[i];
            float amp = uRingAmps[i];
            float hue = uRingHues[i];
            if (amp < 0.001) continue;

            float dr = r - radius;
            // Bright thin ring + softer halo
            float core = exp(-dr * dr * 200.0) * amp;
            float halo = exp(-dr * dr * 25.0) * amp * 0.3;

            // Angular sparkle along the ring
            float sparkle = 0.5 + 0.5 * sin(angle * 24.0 + uTime * 4.0 + float(i) * 7.0);
            sparkle = pow(sparkle, 3.0);

            vec3 c = hsl2rgb(mod(hue, 1.0), 1.0, 0.55);
            ringColor += c * (core * (1.0 + sparkle * 0.5) + halo);
          }

          // --- Core pulse (sun in the middle) ---
          float core = exp(-r * 6.0);
          vec3 coreColor = hsl2rgb(uColorHue, 1.0, 0.6) *
                           core * (0.6 + uBass * 0.6 + uPulse * 0.4);

          // High-frequency dust
          float dust = step(0.985 - uHigh * 0.05, hash(vUv * uResolution + uTime * 30.0));
          vec3 dustColor = hsl2rgb(mod(uColorHue + 0.3, 1.0), 1.0, 0.7) * dust * uHigh;

          vec3 col = gridColor + ringColor + coreColor + dustColor;

          // Wave field also boosts brightness of whatever's underneath
          col *= 1.0 + waveField * 0.4;

          // Pulse color invert flash
          col = mix(col, 1.0 - col, uPulse * 0.08);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
  }

  private spawnRing(intensity: number): void {
    // Find a slot — either dead, or oldest
    let slot = -1
    let oldestAge = -1
    for (let i = 0; i < MAX_RINGS; i++) {
      if (!this.rings[i].alive) {
        slot = i
        break
      }
      if (this.rings[i].age > oldestAge) {
        oldestAge = this.rings[i].age
        slot = i
      }
    }
    if (slot < 0) return
    this.rings[slot] = {
      age: 0,
      hue: (this.colorHue + this.hueShift + Math.random() * 0.15) % 1,
      amp: 0.6 + intensity * 0.5,
      alive: true
    }
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    const dt = deltaTime * 0.001

    if (beat.isOnset) {
      this.currentPulse = 1.0
      this.spawnRing(beat.intensity)
      this.hueShift = (this.hueShift + 0.13 + audio.high * 0.2) % 1
    }
    this.currentPulse *= 0.88

    // Update rings
    for (let i = 0; i < MAX_RINGS; i++) {
      const ring = this.rings[i]
      if (!ring.alive) {
        this.ringRadii[i] = 0
        this.ringHues[i] = 0
        this.ringAmps[i] = 0
        continue
      }
      ring.age += dt * this.waveSpeed * (1 + audio.energy * 0.3)
      const radius = ring.age * 1.2
      // Amplitude decays with age
      const amp = Math.max(0, ring.amp - ring.age * 0.5)
      if (radius > 2.5 || amp <= 0.01) {
        ring.alive = false
        this.ringRadii[i] = 0
        this.ringHues[i] = 0
        this.ringAmps[i] = 0
      } else {
        this.ringRadii[i] = radius
        this.ringHues[i] = ring.hue
        this.ringAmps[i] = amp
      }
    }

    const u = this.material.uniforms
    u.uTime.value = time * 0.001
    u.uPulse.value = this.currentPulse
    u.uColorHue.value = this.colorHue
    u.uBass.value = audio.bass
    u.uMid.value = audio.mid
    u.uHigh.value = audio.high
    u.uEnergy.value = audio.energy
    // Float arrays are already referenced by uniforms — Three picks them up automatically
  }

  resize(width: number, height: number): void {
    this.aspect = width / height
    this.camera.left = -this.aspect
    this.camera.right = this.aspect
    this.camera.updateProjectionMatrix()
    this.mesh.geometry.dispose()
    this.mesh.geometry = new THREE.PlaneGeometry(2 * this.aspect, 2)
    this.material.uniforms.uResolution.value.set(width, height)
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'waveSpeed', label: 'Speed', type: 'number', value: this.waveSpeed, min: 0.3, max: 3, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    if (key === 'waveSpeed') this.waveSpeed = value as number
    else if (key === 'colorHue') this.colorHue = value as number
  }
}
