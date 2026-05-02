import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class BlackHole implements Scene {
  name = 'Black Hole'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private aspect: number = 1
  private gravity: number = 1.0
  private colorHue: number = 0.05
  private currentPulse: number = 0
  private burst: number = 0

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
        uBurst: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uGravity: { value: this.gravity }
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
        uniform float uBurst;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uMid;
        uniform float uHigh;
        uniform float uEnergy;
        uniform float uGravity;
        varying vec2 vUv;

        #define PI 3.14159265359

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Procedural starfield in distorted space
        float stars(vec2 uv) {
          vec2 g = floor(uv * 50.0);
          float h = hash(g);
          vec2 f = fract(uv * 50.0) - 0.5;
          float d = length(f);
          float twinkle = 0.5 + 0.5 * sin(uTime * 3.0 + h * 30.0);
          return smoothstep(0.05, 0.0, d) * step(0.97, h) * twinkle;
        }

        void main() {
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 uv = (vUv - 0.5) * 2.0 * aspect;

          float r = length(uv);
          float angle = atan(uv.y, uv.x);

          // Event horizon radius pulsates with bass
          float horizon = 0.18 + uBass * 0.12 + uPulse * 0.06;

          // Gravitational lensing — bend rays toward the hole
          float bend = uGravity * (0.6 + uBass * 0.5) / max(r, 0.05);
          vec2 lensed = uv - normalize(uv) * bend * 0.05;

          // Rotation around the hole (frame dragging)
          float swirl = 1.5 / max(r, 0.1) + uTime * 0.2;
          float c = cos(swirl);
          float s = sin(swirl);
          vec2 swirled = mat2(c, -s, s, c) * lensed;

          // Background starfield through lensed coords
          float bg = stars(swirled * 0.3);
          vec3 starColor = vec3(0.9, 0.95, 1.0) * bg;

          // Accretion disk — hot ring around the horizon
          float diskInner = horizon + 0.02;
          float diskOuter = horizon + 0.55 + uMid * 0.2;
          float diskMask = smoothstep(diskInner, diskInner + 0.04, r) *
                           (1.0 - smoothstep(diskOuter, diskOuter + 0.15, r));

          // Disk turbulence — bands rotating fast
          float band = sin(angle * 3.0 + uTime * 2.0 - 1.0 / max(r, 0.05) * 1.5);
          band = 0.5 + 0.5 * band;
          band *= 0.6 + 0.4 * sin(angle * 7.0 - uTime * 3.5 - 6.0 / max(r, 0.05));

          float diskHeat = mix(0.4, 1.0, band) * (0.7 + uEnergy * 0.5);

          float hue = uColorHue + (1.0 - r) * 0.25 + band * 0.05;
          vec3 diskColor = hsl2rgb(mod(hue, 1.0), 1.0, 0.5 + diskHeat * 0.2);
          diskColor *= diskMask * (1.0 + diskHeat * 1.5);

          // Hot inner edge highlight
          float edge = exp(-abs(r - horizon - 0.04) * 50.0);
          diskColor += hsl2rgb(mod(uColorHue + 0.05, 1.0), 1.0, 0.85) * edge * 1.2;

          // Photon ring — thin bright circle just outside horizon
          float photon = exp(-abs(r - horizon - 0.015) * 200.0);
          diskColor += vec3(1.0, 0.9, 0.7) * photon * 0.8;

          // Burst on hard onset — material being ejected
          if (uBurst > 0.01) {
            float jet = smoothstep(0.0, 0.05, abs(uv.y) - r * 0.6);
            jet = (1.0 - jet) * smoothstep(0.6 + uBurst * 0.4, 0.0, r);
            diskColor += hsl2rgb(mod(uColorHue + 0.5, 1.0), 1.0, 0.7) * jet * uBurst;
          }

          // Inside the horizon — pure black
          float horizonMask = smoothstep(horizon, horizon - 0.005, r);

          vec3 col = (starColor + diskColor) * (1.0 - horizonMask);

          // Subtle red shift glow at horizon edge
          col += hsl2rgb(uColorHue, 0.8, 0.3) * exp(-abs(r - horizon) * 25.0) * 0.4;

          gl_FragColor = vec4(col, 1.0);
        }
      `
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
  }

  update(time: number, _deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    if (beat.isOnset) {
      this.currentPulse = 1.0
      if (beat.intensity > 0.7) this.burst = 1.0
    }
    this.currentPulse *= 0.9
    this.burst *= 0.85

    const u = this.material.uniforms
    u.uTime.value = time * 0.001
    u.uPulse.value = this.currentPulse
    u.uBurst.value = this.burst
    u.uColorHue.value = this.colorHue
    u.uBass.value = audio.bass
    u.uMid.value = audio.mid
    u.uHigh.value = audio.high
    u.uEnergy.value = audio.energy
    u.uGravity.value = this.gravity
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
      { key: 'gravity', label: 'Gravity', type: 'number', value: this.gravity, min: 0.3, max: 2.5, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    if (key === 'gravity') this.gravity = value as number
    else if (key === 'colorHue') this.colorHue = value as number
  }
}
