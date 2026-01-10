import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class WaveformOcean implements Scene {
  name = 'Waveform Ocean'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private planeMesh: THREE.Mesh
  private planeMaterial: THREE.ShaderMaterial
  private skyMaterial: THREE.ShaderMaterial
  private skyMesh: THREE.Mesh

  private width: number = 0
  private height: number = 0

  // Parameters
  private waveDensity: number = 1.0
  private waveAmplitude: number = 1.0
  private colorHue: number = 0.6 // Cyan
  private cameraSpeed: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private cameraZ: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    this.planeMesh = new THREE.Mesh()
    this.planeMaterial = new THREE.ShaderMaterial()
    this.skyMaterial = new THREE.ShaderMaterial()
    this.skyMesh = new THREE.Mesh()
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.camera.position.set(0, 2, 5)
    this.camera.lookAt(0, 0, 0)

    // Create wave plane
    const planeGeometry = new THREE.PlaneGeometry(40, 40, 128, 128)
    planeGeometry.rotateX(-Math.PI / 2)

    this.planeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uEnergy: { value: 0 },
        uWaveDensity: { value: this.waveDensity },
        uWaveAmplitude: { value: this.waveAmplitude },
        uCameraZ: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPulse;
        uniform float uBass;
        uniform float uMid;
        uniform float uHigh;
        uniform float uEnergy;
        uniform float uWaveDensity;
        uniform float uWaveAmplitude;
        uniform float uCameraZ;

        varying vec2 vUv;
        varying float vHeight;
        varying float vFog;

        void main() {
          vUv = uv;

          vec3 pos = position;

          // Move with camera
          pos.z -= uCameraZ;
          pos.z = mod(pos.z + 20.0, 40.0) - 20.0;

          // Wave calculations
          float wave = 0.0;

          // Bass waves - large slow waves
          wave += sin(pos.x * 0.5 * uWaveDensity + uTime * 0.5) *
                  cos(pos.z * 0.3 * uWaveDensity + uTime * 0.3) *
                  (1.0 + uBass * 2.0) * uWaveAmplitude;

          // Mid waves - medium frequency
          wave += sin(pos.x * 1.5 * uWaveDensity + uTime * 1.2) *
                  cos(pos.z * 1.2 * uWaveDensity + uTime * 0.8) *
                  0.5 * (0.5 + uMid) * uWaveAmplitude;

          // High waves - small ripples
          wave += sin(pos.x * 4.0 * uWaveDensity + uTime * 3.0) *
                  cos(pos.z * 3.0 * uWaveDensity + uTime * 2.5) *
                  0.2 * (0.3 + uHigh) * uWaveAmplitude;

          // Pulse impact
          float pulseWave = sin(length(pos.xz) * 2.0 - uTime * 5.0) * uPulse;
          wave += pulseWave * uWaveAmplitude;

          pos.y = wave;
          vHeight = wave;

          // Fog based on distance
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vFog = smoothstep(5.0, 30.0, -mvPosition.z);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPulse;
        uniform float uColorHue;
        uniform float uEnergy;

        varying vec2 vUv;
        varying float vHeight;
        varying float vFog;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          // Color based on height
          float heightNorm = vHeight * 0.3 + 0.5;
          heightNorm = clamp(heightNorm, 0.0, 1.0);

          // Gradient from deep to peak
          float hue = uColorHue + heightNorm * 0.2;
          float sat = 0.8 + heightNorm * 0.2;
          float light = 0.2 + heightNorm * 0.5;

          vec3 color = hsl2rgb(hue, sat, light);

          // Grid lines
          float gridX = smoothstep(0.02, 0.0, abs(fract(vUv.x * 20.0) - 0.5) - 0.48);
          float gridY = smoothstep(0.02, 0.0, abs(fract(vUv.y * 20.0) - 0.5) - 0.48);
          float grid = max(gridX, gridY);
          color += hsl2rgb(uColorHue + 0.3, 1.0, 0.7) * grid * 0.5;

          // Peak highlights
          float peak = smoothstep(0.5, 1.0, heightNorm);
          color += vec3(1.0) * peak * 0.5 * (1.0 + uPulse);

          // Energy glow
          color += hsl2rgb(uColorHue, 1.0, 0.5) * uEnergy * 0.3;

          // Fog blend
          vec3 fogColor = hsl2rgb(uColorHue + 0.1, 0.5, 0.1);
          color = mix(color, fogColor, vFog);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      transparent: false
    })

    this.planeMesh = new THREE.Mesh(planeGeometry, this.planeMaterial)
    this.scene.add(this.planeMesh)

    // Create sky dome
    const skyGeometry = new THREE.SphereGeometry(50, 32, 32)
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorHue: { value: this.colorHue },
        uEnergy: { value: 0 },
        uPulse: { value: 0 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uColorHue;
        uniform float uEnergy;
        uniform float uPulse;

        varying vec3 vWorldPosition;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);

          // Gradient sky
          float horizon = smoothstep(-0.2, 0.5, dir.y);

          // Base sky color
          vec3 skyTop = hsl2rgb(uColorHue + 0.5, 0.6, 0.15);
          vec3 skyBottom = hsl2rgb(uColorHue + 0.3, 0.8, 0.05);
          vec3 color = mix(skyBottom, skyTop, horizon);

          // Stars
          vec3 starDir = dir * 100.0;
          float star = fract(sin(dot(floor(starDir), vec3(12.9898, 78.233, 45.543))) * 43758.5453);
          star = step(0.995, star) * (0.5 + 0.5 * sin(uTime + star * 100.0));
          color += vec3(star) * (1.0 - horizon) * 0.5;

          // Aurora effect
          float aurora = sin(dir.x * 5.0 + uTime * 0.5) * sin(dir.z * 3.0 + uTime * 0.3);
          aurora = pow(abs(aurora), 3.0) * smoothstep(0.0, 0.5, dir.y) * smoothstep(0.8, 0.3, dir.y);
          color += hsl2rgb(uColorHue + aurora * 0.2, 1.0, 0.5) * aurora * (0.3 + uEnergy * 0.5);

          // Pulse flash
          color += vec3(0.1) * uPulse;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide
    })

    this.skyMesh = new THREE.Mesh(skyGeometry, this.skyMaterial)
    this.scene.add(this.skyMesh)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    this.time = time
    const dt = deltaTime * 0.001

    // Update pulse
    if (beat.isOnset) {
      this.currentPulse = 1.0
    }
    this.currentPulse *= 0.9

    // Move camera forward
    this.cameraZ += dt * 2.0 * this.cameraSpeed * (1 + audio.energy * 0.5)

    // Camera bob based on audio
    this.camera.position.y = 2 + Math.sin(time * 0.001) * 0.2 + audio.bass * 0.5
    this.camera.position.x = Math.sin(time * 0.0005) * 0.5

    // Update plane uniforms
    this.planeMaterial.uniforms.uTime.value = time * 0.001
    this.planeMaterial.uniforms.uPulse.value = this.currentPulse
    this.planeMaterial.uniforms.uColorHue.value = this.colorHue
    this.planeMaterial.uniforms.uBass.value = audio.bass
    this.planeMaterial.uniforms.uMid.value = audio.mid
    this.planeMaterial.uniforms.uHigh.value = audio.high
    this.planeMaterial.uniforms.uEnergy.value = audio.energy
    this.planeMaterial.uniforms.uWaveDensity.value = this.waveDensity
    this.planeMaterial.uniforms.uWaveAmplitude.value = this.waveAmplitude
    this.planeMaterial.uniforms.uCameraZ.value = this.cameraZ

    // Update sky uniforms
    this.skyMaterial.uniforms.uTime.value = time * 0.001
    this.skyMaterial.uniforms.uColorHue.value = this.colorHue
    this.skyMaterial.uniforms.uEnergy.value = audio.energy
    this.skyMaterial.uniforms.uPulse.value = this.currentPulse
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
    this.planeMesh.geometry.dispose()
    this.planeMaterial.dispose()
    this.skyMesh.geometry.dispose()
    this.skyMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'waveDensity', label: 'Density', type: 'number', value: this.waveDensity, min: 0.5, max: 2, step: 0.1 },
      { key: 'waveAmplitude', label: 'Height', type: 'number', value: this.waveAmplitude, min: 0.5, max: 2, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'cameraSpeed', label: 'Speed', type: 'number', value: this.cameraSpeed, min: 0.5, max: 3, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'waveDensity':
        this.waveDensity = value as number
        break
      case 'waveAmplitude':
        this.waveAmplitude = value as number
        break
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'cameraSpeed':
        this.cameraSpeed = value as number
        break
    }
  }
}
