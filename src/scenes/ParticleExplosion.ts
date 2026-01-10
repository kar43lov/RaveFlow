import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  size: number
  hue: number
}

export class ParticleExplosion implements Scene {
  name = 'Particle Explosion'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private particles: THREE.Points
  private particleMaterial: THREE.ShaderMaterial
  private backgroundMesh: THREE.Mesh
  private backgroundMaterial: THREE.ShaderMaterial

  private width: number = 0
  private height: number = 0

  // Parameters
  private particleCount: number = 2000
  private explosionShape: number = 0 // 0: sphere, 1: disk, 2: spiral
  private colorHue: number = 0.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private particleData: Particle[] = []
  private rotation: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    this.particles = new THREE.Points()
    this.particleMaterial = new THREE.ShaderMaterial()
    this.backgroundMesh = new THREE.Mesh()
    this.backgroundMaterial = new THREE.ShaderMaterial()
  }

  private initParticles(): void {
    this.particleData = []
    for (let i = 0; i < this.particleCount; i++) {
      this.particleData.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 2 + Math.random() * 2,
        size: 2 + Math.random() * 3,
        hue: Math.random()
      })
    }
  }

  private explode(centerX: number, centerY: number, centerZ: number, intensity: number): void {
    let count = Math.floor(this.particleCount * 0.3 * intensity)
    let spawned = 0

    for (let i = 0; i < this.particleData.length && spawned < count; i++) {
      const p = this.particleData[i]
      if (p.life <= 0) {
        p.x = centerX
        p.y = centerY
        p.z = centerZ
        p.life = p.maxLife
        p.hue = (this.colorHue + Math.random() * 0.3) % 1.0

        const speed = 0.05 + Math.random() * 0.1 * intensity

        // Different explosion shapes
        if (this.explosionShape === 0) {
          // Sphere
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          p.vx = Math.sin(phi) * Math.cos(theta) * speed
          p.vy = Math.sin(phi) * Math.sin(theta) * speed
          p.vz = Math.cos(phi) * speed
        } else if (this.explosionShape === 1) {
          // Disk
          const theta = Math.random() * Math.PI * 2
          p.vx = Math.cos(theta) * speed
          p.vy = (Math.random() - 0.5) * speed * 0.2
          p.vz = Math.sin(theta) * speed
        } else {
          // Spiral
          const theta = Math.random() * Math.PI * 2
          const spiralOffset = Math.random() * 2
          p.vx = Math.cos(theta + spiralOffset) * speed
          p.vy = (Math.random() - 0.3) * speed
          p.vz = Math.sin(theta + spiralOffset) * speed
        }

        spawned++
      }
    }
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.camera.position.set(0, 0, 5)
    this.camera.lookAt(0, 0, 0)

    this.initParticles()

    // Create background
    const bgGeometry = new THREE.PlaneGeometry(20, 20)
    this.backgroundMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorHue: { value: this.colorHue },
        uEnergy: { value: 0 },
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
        uniform float uTime;
        uniform float uColorHue;
        uniform float uEnergy;
        uniform float uPulse;
        varying vec2 vUv;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv);

          // Radial gradient background
          vec3 color = hsl2rgb(uColorHue + 0.5, 0.3, 0.05);

          // Subtle animated pattern
          float pattern = sin(uv.x * 20.0 + uTime) * sin(uv.y * 20.0 + uTime * 0.7);
          pattern = pow(abs(pattern), 4.0) * 0.1;
          color += hsl2rgb(uColorHue, 0.5, 0.2) * pattern * uEnergy;

          // Pulse rings
          float ring = sin(dist * 30.0 - uTime * 5.0) * 0.5 + 0.5;
          ring = pow(ring, 8.0) * exp(-dist * 3.0) * uPulse;
          color += hsl2rgb(uColorHue, 1.0, 0.5) * ring;

          // Vignette
          color *= 1.0 - dist * 0.5;

          gl_FragColor = vec4(color, 1.0);
        }
      `
    })

    this.backgroundMesh = new THREE.Mesh(bgGeometry, this.backgroundMaterial)
    this.backgroundMesh.position.z = -5
    this.scene.add(this.backgroundMesh)

    // Create particle system
    const positions = new Float32Array(this.particleCount * 3)
    const colors = new Float32Array(this.particleCount * 3)
    const sizes = new Float32Array(this.particleCount)
    const lifes = new Float32Array(this.particleCount)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(lifes, 1))

    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() }
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aLife;

        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vLife;

        void main() {
          vColor = aColor;
          vLife = aLife;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z) * vLife;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vLife;

        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;

          float glow = exp(-d * 4.0);
          vec3 color = vColor * glow;

          // Hot core
          color += vec3(1.0) * smoothstep(0.3, 0.0, d) * vLife;

          gl_FragColor = vec4(color, glow * vLife);
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
    const dt = deltaTime * 0.001

    // Update pulse and trigger explosion
    if (beat.isOnset) {
      this.currentPulse = 1.0
      // Random position offset for variety
      const offsetX = (Math.random() - 0.5) * 2
      const offsetY = (Math.random() - 0.5) * 2
      this.explode(offsetX, offsetY, 0, beat.intensity)
    }
    this.currentPulse *= 0.9

    // Rotate camera slowly
    this.rotation += dt * 0.1 * (1 + audio.energy * 0.5)
    this.camera.position.x = Math.sin(this.rotation) * 5
    this.camera.position.z = Math.cos(this.rotation) * 5
    this.camera.lookAt(0, 0, 0)

    // Update particles
    const positions = this.particles.geometry.attributes.position.array as Float32Array
    const colors = this.particles.geometry.attributes.aColor.array as Float32Array
    const sizes = this.particles.geometry.attributes.aSize.array as Float32Array
    const lifes = this.particles.geometry.attributes.aLife.array as Float32Array

    for (let i = 0; i < this.particleData.length; i++) {
      const p = this.particleData[i]

      if (p.life > 0) {
        // Update position
        p.x += p.vx * dt * 60
        p.y += p.vy * dt * 60
        p.z += p.vz * dt * 60

        // Gravity
        p.vy -= 0.001 * dt * 60

        // Drag
        p.vx *= 0.99
        p.vy *= 0.99
        p.vz *= 0.99

        // Decay life
        p.life -= dt

        // Audio reactivity - speed boost
        if (audio.energy > 0.5) {
          p.vx *= 1.01
          p.vy *= 1.01
          p.vz *= 1.01
        }
      } else {
        // Idle drift for dead particles
        p.x += Math.sin(time * 0.001 + i) * 0.001
        p.y += Math.cos(time * 0.001 + i * 1.5) * 0.001
      }

      const lifeRatio = Math.max(0, p.life / p.maxLife)

      // Update buffers
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z

      // Color based on hue and life
      const h = (p.hue + (1 - lifeRatio) * 0.2) % 1
      const s = 1.0
      const l = 0.5 + lifeRatio * 0.3

      // HSL to RGB inline
      const c = (1 - Math.abs(2 * l - 1)) * s
      const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
      const m = l - c / 2

      let r = 0, g = 0, b = 0
      if (h < 1/6) { r = c; g = x; b = 0 }
      else if (h < 2/6) { r = x; g = c; b = 0 }
      else if (h < 3/6) { r = 0; g = c; b = x }
      else if (h < 4/6) { r = 0; g = x; b = c }
      else if (h < 5/6) { r = x; g = 0; b = c }
      else { r = c; g = 0; b = x }

      colors[i * 3] = r + m
      colors[i * 3 + 1] = g + m
      colors[i * 3 + 2] = b + m

      sizes[i] = p.size * (1 + this.currentPulse * 0.5)
      lifes[i] = lifeRatio
    }

    this.particles.geometry.attributes.position.needsUpdate = true
    this.particles.geometry.attributes.aColor.needsUpdate = true
    this.particles.geometry.attributes.aSize.needsUpdate = true
    this.particles.geometry.attributes.aLife.needsUpdate = true

    // Update uniforms
    this.particleMaterial.uniforms.uTime.value = time * 0.001
    this.backgroundMaterial.uniforms.uTime.value = time * 0.001
    this.backgroundMaterial.uniforms.uColorHue.value = this.colorHue
    this.backgroundMaterial.uniforms.uEnergy.value = audio.energy
    this.backgroundMaterial.uniforms.uPulse.value = this.currentPulse
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
    this.backgroundMesh.geometry.dispose()
    this.backgroundMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'particleCount', label: 'Particles', type: 'number', value: this.particleCount, min: 500, max: 5000, step: 100 },
      { key: 'explosionShape', label: 'Shape', type: 'number', value: this.explosionShape, min: 0, max: 2, step: 1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'particleCount':
        this.particleCount = value as number
        // Would need to reinitialize particles - simplified for now
        break
      case 'explosionShape':
        this.explosionShape = Math.floor(value as number)
        break
      case 'colorHue':
        this.colorHue = value as number
        break
    }
  }
}
