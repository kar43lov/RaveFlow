import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class GridCorridor implements Scene {
  name = 'Grid Corridor'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private gridGroup: THREE.Group
  private gridMaterial: THREE.ShaderMaterial

  private width: number = 0
  private height: number = 0

  // Parameters
  private speed: number = 1.0
  private gridColor: string = '#00ffff'
  private pulseStrength: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private gridOffset: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000)
    this.gridGroup = new THREE.Group()
    this.gridMaterial = new THREE.ShaderMaterial()
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.camera.position.set(0, 0, 0)
    this.camera.lookAt(0, 0, -100)

    // Create grid corridor using shader
    const corridorGeometry = new THREE.PlaneGeometry(20, 200, 1, 1)

    this.gridMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: this.speed },
        uPulse: { value: 0 },
        uBass: { value: 0 },
        uEnergy: { value: 0 },
        uColor: { value: new THREE.Color(this.gridColor) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uPulse;
        uniform float uBass;
        uniform float uEnergy;
        uniform vec3 uColor;

        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          // Grid pattern
          vec2 gridPos = vWorldPos.xz;
          gridPos.y -= uTime * uSpeed * 20.0;

          float gridSize = 2.0;
          vec2 grid = abs(fract(gridPos / gridSize - 0.5) - 0.5) / fwidth(gridPos / gridSize);
          float line = min(grid.x, grid.y);
          float gridLine = 1.0 - min(line, 1.0);

          // Perspective fade
          float depth = abs(vWorldPos.z);
          float perspectiveFade = 1.0 - smoothstep(0.0, 150.0, depth);

          // Scan lines moving toward camera
          float scanLine = sin(vWorldPos.z * 0.5 - uTime * uSpeed * 10.0) * 0.5 + 0.5;
          scanLine = pow(scanLine, 4.0);

          // Pulse effect
          float pulse = scanLine * uPulse;

          // Combine
          float intensity = gridLine * perspectiveFade * (0.5 + uEnergy * 0.5);
          intensity += pulse * 0.5;
          intensity += scanLine * 0.2 * perspectiveFade;

          // Color with bass influence
          vec3 color = uColor * (1.0 + uBass * 0.5);

          gl_FragColor = vec4(color * intensity, intensity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    // Floor
    const floor = new THREE.Mesh(corridorGeometry, this.gridMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -5
    floor.position.z = -100
    this.gridGroup.add(floor)

    // Ceiling
    const ceiling = new THREE.Mesh(corridorGeometry.clone(), this.gridMaterial)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = 5
    ceiling.position.z = -100
    this.gridGroup.add(ceiling)

    // Left wall
    const leftWall = new THREE.Mesh(corridorGeometry.clone(), this.gridMaterial)
    leftWall.rotation.y = Math.PI / 2
    leftWall.position.x = -10
    leftWall.position.z = -100
    this.gridGroup.add(leftWall)

    // Right wall
    const rightWall = new THREE.Mesh(corridorGeometry.clone(), this.gridMaterial)
    rightWall.rotation.y = -Math.PI / 2
    rightWall.position.x = 10
    rightWall.position.z = -100
    this.gridGroup.add(rightWall)

    this.scene.add(this.gridGroup)

    // Add horizon glow
    const glowGeometry = new THREE.PlaneGeometry(40, 20)
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(this.gridColor) },
        uPulse: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uPulse;
        varying vec2 vUv;

        void main() {
          float dist = length(vUv - vec2(0.5, 0.3));
          float glow = exp(-dist * 2.0) * (0.5 + uPulse * 0.5);
          gl_FragColor = vec4(uColor * glow, glow);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial)
    glowPlane.position.z = -200
    this.scene.add(glowPlane)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    this.time = time

    // Update pulse based on beat
    if (beat.isOnset) {
      this.currentPulse = 1.0
    }
    this.currentPulse *= 0.85

    // Update uniforms
    this.gridMaterial.uniforms.uTime.value = time * 0.001
    this.gridMaterial.uniforms.uSpeed.value = this.speed * (1 + audio.energy * 0.3)
    this.gridMaterial.uniforms.uPulse.value = this.currentPulse * this.pulseStrength
    this.gridMaterial.uniforms.uBass.value = audio.bass
    this.gridMaterial.uniforms.uEnergy.value = audio.energy
    this.gridMaterial.uniforms.uColor.value.set(this.gridColor)

    // Camera shake on beat
    if (beat.isOnset) {
      this.camera.rotation.z = (Math.random() - 0.5) * 0.02
    }
    this.camera.rotation.z *= 0.9

    // Update FOV
    this.camera.fov = 90 + audio.bass * 10
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
    this.gridGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
      }
    })
    this.gridMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'speed', label: 'Speed', type: 'number', value: this.speed, min: 0.1, max: 3, step: 0.1 },
      { key: 'gridColor', label: 'Color', type: 'color', value: this.gridColor },
      { key: 'pulseStrength', label: 'Pulse', type: 'number', value: this.pulseStrength, min: 0, max: 2, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'speed':
        this.speed = value as number
        break
      case 'gridColor':
        this.gridColor = value as string
        break
      case 'pulseStrength':
        this.pulseStrength = value as number
        break
    }
  }
}
