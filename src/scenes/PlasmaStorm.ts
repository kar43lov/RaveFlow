import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class PlasmaStorm implements Scene {
  name = 'Plasma Storm'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private aspect: number = 1

  private blobCount: number = 6
  private colorHue: number = 0.55
  private speed: number = 1.0

  private currentPulse: number = 0
  private hueDrift: number = 0

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
        uBlobs: { value: this.blobCount },
        uSpeed: { value: this.speed }
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
        uniform float uBlobs;
        uniform float uSpeed;
        varying vec2 vUv;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 uv = (vUv - 0.5) * 2.0 * aspect;

          float t = uTime * uSpeed;
          float field = 0.0;

          // Sum metaballs with audio-driven motion
          for (int i = 0; i < 8; i++) {
            if (float(i) >= uBlobs) break;
            float fi = float(i);
            float a = fi * 1.7 + t * 0.4;
            vec2 p = vec2(
              sin(a) * (0.7 + 0.3 * sin(t * 0.8 + fi)),
              cos(a * 1.13) * (0.6 + 0.3 * cos(t * 0.7 + fi))
            );
            // Drift centers with mid energy
            p *= 1.0 + uMid * 0.3;
            float d = length(uv - p);
            float r = 0.25 + uBass * 0.35 + 0.05 * sin(t * 2.0 + fi);
            field += r / max(d * d, 0.001);
          }

          // Smooth threshold for plasma look
          float core = smoothstep(2.5, 6.0 + uPulse * 4.0, field);
          float halo = smoothstep(0.8, 3.0, field) * 0.4;

          // Color sweeps with energy and field intensity
          float hue = uColorHue + field * 0.05 + uTime * 0.04 + uHigh * 0.2;
          vec3 baseColor = hsl2rgb(mod(hue, 1.0), 0.95, 0.55);
          vec3 hotColor = hsl2rgb(mod(hue + 0.15, 1.0), 1.0, 0.7);

          vec3 col = mix(baseColor * halo, hotColor, core);

          // Edge highlight where field crosses iso-line
          float edge = 1.0 - smoothstep(0.0, 0.04, abs(field - 3.0 - uBass * 2.0));
          col += edge * vec3(1.0) * (0.4 + uPulse * 0.6);

          // Crackle (high freq sparkle)
          float crackle = step(0.985 - uHigh * 0.05, fract(sin(dot(uv * 50.0, vec2(12.9, 78.2)) + t * 5.0) * 43758.5));
          col += crackle * hsl2rgb(mod(hue + 0.3, 1.0), 1.0, 0.7) * uHigh;

          // Strobe invert on hard onset
          col = mix(col, 1.0 - col, uPulse * 0.15);

          // Vignette
          float vig = 1.0 - length(vUv - 0.5) * 0.6;
          col *= vig;

          gl_FragColor = vec4(col, 1.0);
        }
      `
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
  }

  update(time: number, _deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    if (beat.isOnset) this.currentPulse = 1.0
    this.currentPulse *= 0.88

    // Auto color drift so it doesn't sit on one hue
    this.hueDrift += 0.0001 + audio.energy * 0.0006

    const u = this.material.uniforms
    u.uTime.value = time * 0.001
    u.uPulse.value = this.currentPulse
    u.uColorHue.value = (this.colorHue + this.hueDrift) % 1
    u.uBass.value = audio.bass
    u.uMid.value = audio.mid
    u.uHigh.value = audio.high
    u.uEnergy.value = audio.energy
    u.uBlobs.value = this.blobCount
    u.uSpeed.value = this.speed
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
      { key: 'blobCount', label: 'Blobs', type: 'number', value: this.blobCount, min: 2, max: 8, step: 1 },
      { key: 'speed', label: 'Speed', type: 'number', value: this.speed, min: 0.2, max: 3, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    if (key === 'blobCount') this.blobCount = Math.floor(value as number)
    else if (key === 'speed') this.speed = value as number
    else if (key === 'colorHue') this.colorHue = value as number
  }
}
