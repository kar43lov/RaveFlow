import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'
import { lerp, hslToRgb } from '../utils/math'

export class VortexTunnel implements Scene {
  name = 'Vortex Tunnel'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private tunnel: THREE.Mesh
  private tunnelMaterial: THREE.ShaderMaterial

  private width: number = 0
  private height: number = 0

  // Parameters
  private speed: number = 1.0
  private colorHue: number = 0.8 // Purple/magenta
  private ringCount: number = 24
  private pulseStrength: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    this.tunnel = new THREE.Mesh()
    this.tunnelMaterial = new THREE.ShaderMaterial()
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.camera.position.z = 0

    // Create tunnel geometry
    const geometry = new THREE.CylinderGeometry(2, 2, 100, 64, 100, true)

    // Rotate to look down the tunnel
    geometry.rotateX(Math.PI / 2)

    // Shader for neon tunnel effect
    this.tunnelMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: this.speed },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uEnergy: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uPulse;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uEnergy;

        varying vec2 vUv;
        varying vec3 vPosition;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          // Create moving rings
          float rings = 24.0;
          float z = vPosition.z + 50.0; // Offset to positive
          float ringPattern = fract(z * 0.1 - uTime * uSpeed);

          // Sharp neon rings
          float ring = smoothstep(0.0, 0.05, ringPattern) * smoothstep(0.15, 0.1, ringPattern);

          // Add glow
          float glow = exp(-ringPattern * 5.0) * 0.5;

          // Radial stripes
          float angle = atan(vPosition.x, vPosition.y);
          float stripes = sin(angle * 8.0 + uTime * 2.0) * 0.5 + 0.5;
          stripes = pow(stripes, 3.0);

          // Color shifts based on position and audio
          float hue = uColorHue + vUv.y * 0.2 + uEnergy * 0.1;
          vec3 color = hsl2rgb(mod(hue, 1.0), 0.9, 0.5);

          // Combine effects
          float intensity = ring + glow * 0.5 + stripes * 0.2;

          // Pulse effect on beat
          intensity += uPulse * (1.0 - ringPattern) * 0.5;

          // Bass expansion
          intensity *= 1.0 + uBass * 0.3;

          // Edge fade
          float edgeFade = 1.0 - smoothstep(0.7, 1.0, abs(vUv.y - 0.5) * 2.0);

          vec3 finalColor = color * intensity * edgeFade;

          // Add some white highlights
          finalColor += vec3(1.0) * ring * 0.3;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      transparent: false
    })

    this.tunnel = new THREE.Mesh(geometry, this.tunnelMaterial)
    this.tunnel.position.z = -50
    this.scene.add(this.tunnel)

    // Add central glow
    const glowGeometry = new THREE.PlaneGeometry(10, 10)
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uPulse;
        uniform float uColorHue;
        varying vec2 vUv;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float glow = exp(-dist * 3.0) * (0.3 + uPulse * 0.5);
          vec3 color = hsl2rgb(uColorHue, 0.8, 0.6);
          gl_FragColor = vec4(color * glow, glow);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial)
    glowPlane.position.z = -100
    this.scene.add(glowPlane)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    this.time = time

    // Update pulse based on beat
    if (beat.isOnset) {
      this.currentPulse = 1.0
    }
    this.currentPulse *= 0.9 // Decay

    // Update shader uniforms
    this.tunnelMaterial.uniforms.uTime.value = time * 0.001
    this.tunnelMaterial.uniforms.uSpeed.value = this.speed * (1 + audio.energy * 0.5)
    this.tunnelMaterial.uniforms.uPulse.value = this.currentPulse * this.pulseStrength
    this.tunnelMaterial.uniforms.uColorHue.value = this.colorHue
    this.tunnelMaterial.uniforms.uBass.value = audio.bass
    this.tunnelMaterial.uniforms.uEnergy.value = audio.energy

    // Rotate tunnel slightly for effect
    this.tunnel.rotation.z = Math.sin(time * 0.0005) * 0.1

    // Update camera FOV based on bass
    this.camera.fov = 75 + audio.bass * 15
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
    this.tunnel.geometry.dispose()
    this.tunnelMaterial.dispose()
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
