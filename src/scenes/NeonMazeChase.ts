import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class NeonMazeChase implements Scene {
  name = 'Neon Maze Chase'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private mazeMaterial: THREE.ShaderMaterial
  private mazePlane: THREE.Mesh

  private width: number = 0
  private height: number = 0

  // Parameters
  private speed: number = 1.0
  private colorHue: number = 0.3 // Green
  private pulseStrength: number = 1.0
  private mazeScale: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private chaserPosition: THREE.Vector2 = new THREE.Vector2(0, 0)

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.mazeMaterial = new THREE.ShaderMaterial()
    this.mazePlane = new THREE.Mesh()
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height

    const aspect = width / height
    this.camera.left = -aspect
    this.camera.right = aspect
    this.camera.top = 1
    this.camera.bottom = -1
    this.camera.updateProjectionMatrix()
    this.camera.position.z = 1

    const geometry = new THREE.PlaneGeometry(2 * aspect, 2)

    this.mazeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uSpeed: { value: this.speed },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uEnergy: { value: 0 },
        uMazeScale: { value: this.mazeScale },
        uChaser: { value: this.chaserPosition }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uSpeed;
        uniform float uPulse;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uEnergy;
        uniform float uMazeScale;
        uniform vec2 uChaser;

        varying vec2 vUv;

        // Hash function for randomness
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        // Simple maze pattern using hash
        float maze(vec2 p) {
          vec2 cell = floor(p);
          vec2 local = fract(p);

          float h = hash(cell);

          // Create walls based on hash
          float wall = 0.0;

          // Vertical wall
          if (h > 0.5 && local.x < 0.1) wall = 1.0;
          // Horizontal wall
          if (h < 0.5 && local.y < 0.1) wall = 1.0;

          // Border walls
          if (local.x < 0.05 || local.y < 0.05) wall = 1.0;

          return wall;
        }

        void main() {
          vec2 uv = vUv;
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);

          // Scale and animate maze
          vec2 mazeUv = (uv - 0.5) * aspect * 10.0 * uMazeScale;
          mazeUv += vec2(uTime * uSpeed * 0.5, uTime * uSpeed * 0.3);

          // Get maze pattern
          float wall = maze(mazeUv);

          // Create glowing walls
          vec2 local = fract(mazeUv);
          float wallDist = min(local.x, local.y);
          wallDist = min(wallDist, min(1.0 - local.x, 1.0 - local.y));
          float glow = exp(-wallDist * 10.0) * 0.5;

          // Energy orbs moving through maze
          vec2 orbPos = mazeUv + vec2(sin(uTime * 2.0), cos(uTime * 1.5)) * 2.0;
          float orb = 0.0;
          for (int i = 0; i < 5; i++) {
            vec2 offset = vec2(
              sin(uTime * (1.0 + float(i) * 0.3) + float(i)),
              cos(uTime * (0.8 + float(i) * 0.2) + float(i) * 2.0)
            ) * 3.0;
            float d = length(mazeUv - offset);
            orb += exp(-d * 2.0) * 0.3;
          }

          // Chaser (player) glow
          vec2 chaserMazePos = uChaser * 10.0 * uMazeScale;
          float chaserDist = length(mazeUv - chaserMazePos);
          float chaserGlow = exp(-chaserDist * 1.5) * (0.8 + uPulse * 0.5);

          // Trail behind chaser
          float trail = 0.0;
          for (int i = 0; i < 8; i++) {
            vec2 trailPos = chaserMazePos - vec2(float(i) * 0.3, float(i) * 0.2);
            float td = length(mazeUv - trailPos);
            trail += exp(-td * 3.0) * (0.3 - float(i) * 0.03);
          }

          // Color based on elements
          vec3 wallColor = hsl2rgb(uColorHue, 0.8, 0.4);
          vec3 orbColor = hsl2rgb(mod(uColorHue + 0.5, 1.0), 1.0, 0.6);
          vec3 chaserColor = hsl2rgb(mod(uColorHue + 0.3, 1.0), 1.0, 0.7);

          // Combine
          vec3 color = vec3(0.0);
          color += wallColor * (wall * 0.3 + glow * (1.0 + uBass * 0.5));
          color += orbColor * orb * (1.0 + uEnergy);
          color += chaserColor * (chaserGlow + trail);

          // Pulse flash
          color += vec3(1.0) * uPulse * 0.2;

          // Vignette
          float vignette = 1.0 - length((uv - 0.5) * 1.5);
          color *= vignette;

          gl_FragColor = vec4(color, 1.0);
        }
      `
    })

    this.mazePlane = new THREE.Mesh(geometry, this.mazeMaterial)
    this.scene.add(this.mazePlane)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    this.time = time

    // Update pulse
    if (beat.isOnset) {
      this.currentPulse = 1.0
    }
    this.currentPulse *= 0.85

    // Animate chaser position
    const t = time * 0.001 * this.speed
    this.chaserPosition.x = Math.sin(t * 0.7) * 0.3 + Math.sin(t * 1.3) * 0.2
    this.chaserPosition.y = Math.cos(t * 0.5) * 0.3 + Math.cos(t * 1.1) * 0.2

    // Update uniforms
    this.mazeMaterial.uniforms.uTime.value = time * 0.001
    this.mazeMaterial.uniforms.uSpeed.value = this.speed * (1 + audio.energy * 0.3)
    this.mazeMaterial.uniforms.uPulse.value = this.currentPulse * this.pulseStrength
    this.mazeMaterial.uniforms.uColorHue.value = this.colorHue
    this.mazeMaterial.uniforms.uBass.value = audio.bass
    this.mazeMaterial.uniforms.uEnergy.value = audio.energy
    this.mazeMaterial.uniforms.uMazeScale.value = this.mazeScale * (1 + audio.bass * 0.2)
    this.mazeMaterial.uniforms.uChaser.value = this.chaserPosition
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    const aspect = width / height
    this.camera.left = -aspect
    this.camera.right = aspect
    this.camera.updateProjectionMatrix()

    this.mazePlane.geometry.dispose()
    this.mazePlane.geometry = new THREE.PlaneGeometry(2 * aspect, 2)
    this.mazeMaterial.uniforms.uResolution.value.set(width, height)
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.mazePlane.geometry.dispose()
    this.mazeMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'speed', label: 'Speed', type: 'number', value: this.speed, min: 0.1, max: 3, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'pulseStrength', label: 'Pulse', type: 'number', value: this.pulseStrength, min: 0, max: 2, step: 0.1 },
      { key: 'mazeScale', label: 'Scale', type: 'number', value: this.mazeScale, min: 0.5, max: 2, step: 0.1 }
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
      case 'mazeScale':
        this.mazeScale = value as number
        break
    }
  }
}
