import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class LaserStorm implements Scene {
  name = 'Laser Storm'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private laserMaterial: THREE.ShaderMaterial
  private laserPlane: THREE.Mesh
  private particles: THREE.Points
  private particleMaterial: THREE.ShaderMaterial

  private width: number = 0
  private height: number = 0

  // Parameters
  private laserCount: number = 8
  private colorHue: number = 0.5 // Cyan
  private pulseStrength: number = 1.0
  private particleIntensity: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.laserMaterial = new THREE.ShaderMaterial()
    this.laserPlane = new THREE.Mesh()
    this.particles = new THREE.Points()
    this.particleMaterial = new THREE.ShaderMaterial()
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

    // Main laser effect plane
    const geometry = new THREE.PlaneGeometry(2 * aspect, 2)

    this.laserMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uEnergy: { value: 0 },
        uLaserCount: { value: this.laserCount }
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
        uniform float uPulse;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uEnergy;
        uniform float uLaserCount;

        varying vec2 vUv;

        #define PI 3.14159265359

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float hash(float n) {
          return fract(sin(n) * 43758.5453);
        }

        // Laser beam
        float laser(vec2 uv, vec2 origin, float angle, float width) {
          vec2 dir = vec2(cos(angle), sin(angle));
          vec2 perp = vec2(-dir.y, dir.x);

          vec2 toPoint = uv - origin;
          float along = dot(toPoint, dir);
          float across = abs(dot(toPoint, perp));

          // Only render beam in positive direction
          float beam = step(0.0, along);

          // Beam falloff
          beam *= exp(-across / width);

          // Distance fade
          beam *= exp(-along * 0.5);

          return beam;
        }

        // Liquid light / wave effect
        float liquidLight(vec2 uv, float time) {
          float wave = 0.0;

          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            vec2 offset = vec2(
              sin(time * 0.5 + fi * 2.0) * 0.3,
              cos(time * 0.3 + fi * 1.5) * 0.3
            );
            float d = length(uv - vec2(0.5) - offset);
            wave += sin(d * 10.0 - time * 2.0 + fi) * 0.5 + 0.5;
          }

          return wave / 3.0;
        }

        void main() {
          vec2 uv = vUv;
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 centeredUv = (uv - 0.5) * aspect;

          vec3 color = vec3(0.0);

          // Pulsing background
          float bgPulse = sin(uTime * 2.0) * 0.5 + 0.5;
          color += hsl2rgb(uColorHue + 0.5, 0.5, 0.05) * bgPulse * uEnergy;

          // Liquid light waves
          float liquid = liquidLight(uv, uTime);
          vec3 liquidColor = hsl2rgb(uColorHue + 0.3, 0.8, 0.3) * liquid * 0.3;
          liquidColor *= 1.0 + uBass * 0.5;
          color += liquidColor;

          // Rotating lasers from center
          float laserSum = 0.0;
          int numLasers = int(uLaserCount);

          for (int i = 0; i < 12; i++) {
            if (i >= numLasers) break;

            float fi = float(i);
            float baseAngle = fi / uLaserCount * PI * 2.0;

            // Animate laser angle
            float angleOffset = sin(uTime * (0.5 + fi * 0.1) + fi) * 0.5;
            float angle = baseAngle + angleOffset + uTime * 0.2;

            // Laser width varies with audio
            float width = 0.02 + uEnergy * 0.02 + uPulse * 0.03;

            float l = laser(centeredUv, vec2(0.0), angle, width);
            laserSum += l;

            // Color per laser
            float hue = uColorHue + fi / uLaserCount * 0.5;
            color += hsl2rgb(mod(hue, 1.0), 1.0, 0.6) * l * 0.3;
          }

          // Strobe effect
          float strobe = step(0.9, fract(uTime * 4.0)) * uPulse;
          color += vec3(1.0) * strobe * 0.5;

          // Radial pulse waves
          float dist = length(centeredUv);
          float wave = sin(dist * 20.0 - uTime * 5.0) * 0.5 + 0.5;
          wave *= exp(-dist * 2.0);
          wave *= uPulse;
          color += hsl2rgb(uColorHue, 1.0, 0.7) * wave * 0.3;

          // Central glow
          float centerGlow = exp(-dist * 3.0) * (0.5 + uPulse * 0.5 + uBass * 0.3);
          color += hsl2rgb(uColorHue, 0.8, 0.6) * centerGlow;

          // Scan lines effect
          float scanline = sin(uv.y * uResolution.y * 0.5) * 0.5 + 0.5;
          scanline = pow(scanline, 0.5);
          color *= 0.9 + scanline * 0.1;

          // Edge vignette
          float vignette = 1.0 - length((uv - 0.5) * 1.5) * 0.5;
          color *= vignette;

          gl_FragColor = vec4(color, 1.0);
        }
      `
    })

    this.laserPlane = new THREE.Mesh(geometry, this.laserMaterial)
    this.scene.add(this.laserPlane)

    // Add particle overlay
    this.createParticles(renderer)
  }

  private createParticles(renderer: THREE.WebGLRenderer): void {
    const particleCount = 500
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4
      positions[i * 3 + 2] = 0

      velocities[i * 3] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 2] = 0

      sizes[i] = 2 + Math.random() * 4
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uEnergy: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() }
      },
      vertexShader: `
        attribute vec3 aVelocity;
        attribute float aSize;

        uniform float uTime;
        uniform float uPulse;
        uniform float uEnergy;
        uniform float uPixelRatio;

        varying float vAlpha;

        void main() {
          vec3 pos = position;

          // Animate based on velocity and time
          pos += aVelocity * uTime * 100.0;

          // Wrap around
          pos.x = mod(pos.x + 2.0, 4.0) - 2.0;
          pos.y = mod(pos.y + 2.0, 4.0) - 2.0;

          // Pulse expansion
          pos.xy *= 1.0 + uPulse * 0.2;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          gl_PointSize = aSize * (1.0 + uEnergy) * uPixelRatio;
          gl_Position = projectionMatrix * mvPosition;

          vAlpha = 0.5 + uEnergy * 0.5;
        }
      `,
      fragmentShader: `
        uniform float uColorHue;
        uniform float uPulse;

        varying float vAlpha;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;

          float glow = exp(-d * 4.0);
          vec3 color = hsl2rgb(uColorHue, 1.0, 0.7);
          color += vec3(1.0) * uPulse * 0.3;

          gl_FragColor = vec4(color * glow, glow * vAlpha);
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

    // Update pulse
    if (beat.isOnset) {
      this.currentPulse = 1.0
    }
    this.currentPulse *= 0.85

    // Update laser uniforms
    this.laserMaterial.uniforms.uTime.value = time * 0.001
    this.laserMaterial.uniforms.uPulse.value = this.currentPulse * this.pulseStrength
    this.laserMaterial.uniforms.uColorHue.value = this.colorHue
    this.laserMaterial.uniforms.uBass.value = audio.bass
    this.laserMaterial.uniforms.uEnergy.value = audio.energy
    this.laserMaterial.uniforms.uLaserCount.value = this.laserCount

    // Update particle uniforms
    this.particleMaterial.uniforms.uTime.value = time * 0.001
    this.particleMaterial.uniforms.uPulse.value = this.currentPulse * this.pulseStrength
    this.particleMaterial.uniforms.uColorHue.value = this.colorHue
    this.particleMaterial.uniforms.uEnergy.value = audio.energy * this.particleIntensity
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    const aspect = width / height
    this.camera.left = -aspect
    this.camera.right = aspect
    this.camera.updateProjectionMatrix()

    this.laserPlane.geometry.dispose()
    this.laserPlane.geometry = new THREE.PlaneGeometry(2 * aspect, 2)
    this.laserMaterial.uniforms.uResolution.value.set(width, height)
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.laserPlane.geometry.dispose()
    this.laserMaterial.dispose()
    this.particles.geometry.dispose()
    this.particleMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'laserCount', label: 'Lasers', type: 'number', value: this.laserCount, min: 2, max: 12, step: 1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'pulseStrength', label: 'Pulse', type: 'number', value: this.pulseStrength, min: 0, max: 2, step: 0.1 },
      { key: 'particleIntensity', label: 'Particles', type: 'number', value: this.particleIntensity, min: 0, max: 2, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'laserCount':
        this.laserCount = value as number
        break
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'pulseStrength':
        this.pulseStrength = value as number
        break
      case 'particleIntensity':
        this.particleIntensity = value as number
        break
    }
  }
}
