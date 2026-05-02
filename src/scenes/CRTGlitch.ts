import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class CRTGlitch implements Scene {
  name = 'CRT Glitch'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private aspect: number = 1
  private glitchAmount: number = 1.0
  private colorHue: number = 0.55

  private currentPulse: number = 0
  private glitchSpike: number = 0
  private rollOffset: number = 0

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
        uGlitch: { value: 0 },
        uRoll: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uGlitchAmount: { value: this.glitchAmount }
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
        uniform float uGlitch;
        uniform float uRoll;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uMid;
        uniform float uHigh;
        uniform float uEnergy;
        uniform float uGlitchAmount;
        varying vec2 vUv;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Source pattern — a moving neon "broadcast" so the glitch has something to chew on.
        vec3 source(vec2 uv) {
          // Neon grid + diagonal stripes synced to beat
          vec2 g = fract(uv * vec2(8.0, 5.0)) - 0.5;
          float grid = smoothstep(0.5, 0.45, max(abs(g.x), abs(g.y)));

          float diag = sin((uv.x + uv.y) * 30.0 - uTime * 4.0);
          diag = smoothstep(0.6, 1.0, diag);

          float bigBars = step(0.5, fract(uv.y * 3.0 + uTime * 0.4 + uBass * 1.5));
          float circle = 1.0 - smoothstep(0.18 + uBass * 0.05, 0.2, length(uv - 0.5));

          float hue = uColorHue + uv.y * 0.15 + uTime * 0.05;
          vec3 base = hsl2rgb(mod(hue, 1.0), 0.95, 0.55);
          vec3 alt = hsl2rgb(mod(hue + 0.5, 1.0), 0.95, 0.55);
          return mix(base * bigBars, alt, grid) * (0.6 + diag * 0.5) + alt * circle * 0.7;
        }

        void main() {
          vec2 uv = vUv;

          // Vertical roll (lost vertical hold)
          uv.y = fract(uv.y + uRoll);

          // Horizontal scanline tear — random rows shift on glitch
          float row = floor(uv.y * uResolution.y / 4.0);
          float rowHash = hash(vec2(row, floor(uTime * 12.0)));
          float tear = step(0.92 - uGlitch * 0.4, rowHash);
          uv.x += (rowHash - 0.5) * tear * (0.15 + uGlitch * 0.4);

          // Block displacement on hard glitch
          float block = step(0.97 - uGlitch * 0.2, hash(vec2(floor(uv.y * 20.0), floor(uTime * 6.0))));
          uv.x += block * (hash(vec2(floor(uv.y * 20.0), 0.0)) - 0.5) * 0.3 * uGlitch;

          // Chromatic aberration scaled by mid + glitch
          float ca = (0.005 + uMid * 0.015 + uGlitch * 0.025) * uGlitchAmount;
          vec3 col;
          col.r = source(vec2(uv.x + ca, uv.y)).r;
          col.g = source(uv).g;
          col.b = source(vec2(uv.x - ca, uv.y)).b;

          // Scanlines
          float scan = 0.85 + 0.15 * sin(vUv.y * uResolution.y * 1.5);
          col *= scan;

          // High-frequency noise (snow), driven by high band
          float n = hash(vUv * uResolution + uTime * 60.0);
          col += (n - 0.5) * (0.05 + uHigh * 0.4);

          // CRT vignette + curvature darkening
          vec2 cv = vUv - 0.5;
          float curve = pow(1.0 - dot(cv, cv) * 0.7, 2.0);
          col *= curve;

          // RGB split flash on hard onset
          col += vec3(uPulse * 0.15);

          // Occasional inverted scanband
          float invBand = step(0.985, hash(vec2(floor(uTime * 4.0), 0.0)));
          float bandY = step(uv.y, fract(uTime * 0.5)) - step(uv.y, fract(uTime * 0.5) - 0.05);
          col = mix(col, 1.0 - col, invBand * bandY);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    if (beat.isOnset) {
      this.currentPulse = 1.0
      this.glitchSpike = Math.max(this.glitchSpike, 0.6 + beat.intensity * 0.4)
    }
    this.currentPulse *= 0.85
    this.glitchSpike *= 0.88

    // Continuous baseline glitch from energy + spikes
    const liveGlitch = Math.min(1, audio.energy * 0.4 + audio.high * 0.3 + this.glitchSpike)

    // Vertical hold: rolls when bass is high
    const dt = deltaTime * 0.001
    this.rollOffset = (this.rollOffset + dt * (audio.bass * 0.6 + 0.05)) % 1

    const u = this.material.uniforms
    u.uTime.value = time * 0.001
    u.uPulse.value = this.currentPulse
    u.uGlitch.value = liveGlitch
    u.uRoll.value = this.rollOffset
    u.uColorHue.value = this.colorHue
    u.uBass.value = audio.bass
    u.uMid.value = audio.mid
    u.uHigh.value = audio.high
    u.uEnergy.value = audio.energy
    u.uGlitchAmount.value = this.glitchAmount
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
      { key: 'glitchAmount', label: 'Glitch', type: 'number', value: this.glitchAmount, min: 0, max: 2, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    if (key === 'glitchAmount') this.glitchAmount = value as number
    else if (key === 'colorHue') this.colorHue = value as number
  }
}
