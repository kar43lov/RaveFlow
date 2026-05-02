import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class HyperspaceWarp implements Scene {
  name = 'Hyperspace Warp'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private aspect: number = 1
  private speed: number = 1.0
  private colorHue: number = 0.6

  private currentPulse: number = 0
  private flash: number = 0
  private warpZ: number = 0

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
        uFlash: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uSpeed: { value: this.speed },
        uWarpZ: { value: 0 }
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
        uniform float uFlash;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uMid;
        uniform float uHigh;
        uniform float uEnergy;
        uniform float uSpeed;
        uniform float uWarpZ;
        varying vec2 vUv;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // One streak: a star shooting outward from center
        // Returns intensity in [0,1]
        float streak(vec2 uv, float seed, float warp) {
          // Random angle and lifetime offset
          float ang = hash(vec2(seed, 1.7)) * 6.2831;
          float life = hash(vec2(seed, 9.3));
          float t = fract(warp + life);

          // Star travels from center (t=0) to edge (t=1)
          float r = t * 1.5;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 head = dir * r;

          // Distance from pixel to the line segment from origin along dir, ending at head
          float along = dot(uv, dir);
          along = clamp(along, 0.0, r);
          vec2 closest = dir * along;
          float d = length(uv - closest);

          // Tail length grows with speed (warp)
          float tail = smoothstep(r, max(r - 0.4, 0.0), along);
          float core = smoothstep(0.012, 0.0, d);
          float glow = smoothstep(0.05, 0.0, d) * 0.6;

          return (core + glow) * tail * smoothstep(1.0, 0.6, t) * smoothstep(0.0, 0.05, r);
        }

        void main() {
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 uv = (vUv - 0.5) * 2.0 * aspect;

          float warp = uWarpZ;

          // Sum many streaks
          float total = 0.0;
          float colorMix = 0.0;
          for (int i = 0; i < 80; i++) {
            float s = float(i) * 0.137 + 0.5;
            float intensity = streak(uv, s, warp + float(i) * 0.013);
            total += intensity;
            colorMix += intensity * hash(vec2(s, 4.2));
          }

          // Color of streaks: shifts with high freqs
          float hue = uColorHue + colorMix * 0.4 + uHigh * 0.2;
          vec3 streakColor = hsl2rgb(mod(hue, 1.0), 0.9, 0.65);

          // Background — radial gradient with deep blue/violet
          float r = length(uv);
          vec3 bg = hsl2rgb(mod(uColorHue + 0.7, 1.0), 0.8, 0.04 + (1.0 - r) * 0.03);

          vec3 col = bg + streakColor * total;

          // Bass-driven inner glow
          float coreGlow = exp(-r * 4.0) * (0.3 + uBass * 0.6 + uPulse * 0.4);
          col += hsl2rgb(mod(uColorHue + 0.1, 1.0), 1.0, 0.6) * coreGlow;

          // Tunnel rings rushing outward (chevron flicker)
          float ring = sin(r * 25.0 - warp * 6.0) * 0.5 + 0.5;
          ring = pow(ring, 8.0);
          col += hsl2rgb(mod(uColorHue + 0.5, 1.0), 1.0, 0.5) * ring * 0.15 * (0.5 + uMid * 0.5);

          // Onset flash — full screen
          col += vec3(1.0) * uFlash * 0.6;

          // Subtle vignette so edges fade to deep
          float vig = 1.0 - smoothstep(0.7, 1.4, length(uv));
          col *= mix(0.4, 1.0, vig);

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
      if (beat.intensity > 0.6) this.flash = 0.7
    }
    this.currentPulse *= 0.88
    this.flash *= 0.8

    const dt = deltaTime * 0.001
    // Warp Z grows continuously — base speed scales with speed param + audio
    const warpRate = this.speed * (0.4 + audio.bass * 0.9 + audio.energy * 0.3 + this.currentPulse * 0.5)
    this.warpZ = (this.warpZ + dt * warpRate) % 1000

    const u = this.material.uniforms
    u.uTime.value = time * 0.001
    u.uPulse.value = this.currentPulse
    u.uFlash.value = this.flash
    u.uColorHue.value = this.colorHue
    u.uBass.value = audio.bass
    u.uMid.value = audio.mid
    u.uHigh.value = audio.high
    u.uEnergy.value = audio.energy
    u.uSpeed.value = this.speed
    u.uWarpZ.value = this.warpZ
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
      { key: 'speed', label: 'Speed', type: 'number', value: this.speed, min: 0.3, max: 3, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    if (key === 'speed') this.speed = value as number
    else if (key === 'colorHue') this.colorHue = value as number
  }
}
