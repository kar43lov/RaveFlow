import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class Kaleidoscope implements Scene {
  name = 'Kaleidoscope'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private width: number = 0
  private height: number = 0
  private aspect: number = 1

  // Parameters
  private segments: number = 6
  private rotationSpeed: number = 1.0
  private colorHue: number = 0.0
  private complexity: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private rotation: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.material = new THREE.ShaderMaterial()
    this.mesh = new THREE.Mesh()
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height
    this.aspect = width / height

    this.camera.left = -this.aspect
    this.camera.right = this.aspect
    this.camera.top = 1
    this.camera.bottom = -1
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
        uSegments: { value: this.segments },
        uRotation: { value: 0 },
        uComplexity: { value: this.complexity }
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
        uniform float uMid;
        uniform float uHigh;
        uniform float uEnergy;
        uniform float uSegments;
        uniform float uRotation;
        uniform float uComplexity;

        varying vec2 vUv;

        #define PI 3.14159265359
        #define TAU 6.28318530718

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Noise function for organic patterns
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);

          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));

          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;

          for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
          }

          return value;
        }

        // Create kaleidoscope symmetry
        vec2 kaleidoscope(vec2 uv, float segments) {
          float angle = atan(uv.y, uv.x);
          float radius = length(uv);

          // Create segments
          float segmentAngle = TAU / segments;
          angle = mod(angle, segmentAngle);

          // Mirror within segment
          if (angle > segmentAngle * 0.5) {
            angle = segmentAngle - angle;
          }

          return vec2(cos(angle), sin(angle)) * radius;
        }

        // Pattern generators
        float pattern1(vec2 uv, float time) {
          // Flowing organic shapes
          float n = fbm(uv * 3.0 + time * 0.3);
          n += fbm(uv * 6.0 - time * 0.2) * 0.5;
          return n;
        }

        float pattern2(vec2 uv, float time) {
          // Geometric circles
          float d = length(uv);
          float waves = sin(d * 20.0 - time * 3.0) * 0.5 + 0.5;
          waves *= sin(atan(uv.y, uv.x) * 8.0 + time) * 0.5 + 0.5;
          return waves;
        }

        float pattern3(vec2 uv, float time) {
          // Spiraling tendrils
          float angle = atan(uv.y, uv.x);
          float radius = length(uv);
          float spiral = sin(angle * 5.0 + radius * 10.0 - time * 2.0);
          spiral *= exp(-radius * 2.0);
          return spiral * 0.5 + 0.5;
        }

        void main() {
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 uv = (vUv - 0.5) * 2.0 * aspect;

          // Apply rotation
          float c = cos(uRotation);
          float s = sin(uRotation);
          uv = mat2(c, -s, s, c) * uv;

          // Apply kaleidoscope effect
          vec2 kUv = kaleidoscope(uv, uSegments);

          // Zoom based on audio
          float zoom = 1.0 + uBass * 0.3 + uPulse * 0.2;
          kUv /= zoom;

          // Time with audio influence
          float time = uTime + uEnergy * 0.5;

          // Generate patterns
          float p1 = pattern1(kUv, time) * uComplexity;
          float p2 = pattern2(kUv, time * 0.7);
          float p3 = pattern3(kUv, time * 1.3) * uComplexity;

          // Mix patterns based on audio
          float pattern = p1 * (0.5 + uBass * 0.5);
          pattern += p2 * (0.3 + uMid * 0.7);
          pattern += p3 * (0.2 + uHigh * 0.8);
          pattern /= 1.0 + uBass * 0.5 + uMid * 0.7 + uHigh * 0.8;

          // Color mapping
          float hue = uColorHue + pattern * 0.5 + uTime * 0.05;
          hue += length(kUv) * 0.1;

          float saturation = 0.8 + pattern * 0.2;
          float lightness = 0.3 + pattern * 0.5;

          // Boost on pulse
          lightness += uPulse * 0.3;
          saturation = min(1.0, saturation + uPulse * 0.2);

          vec3 color = hsl2rgb(mod(hue, 1.0), saturation, lightness);

          // Add glow at center
          float centerGlow = exp(-length(uv) * 2.0);
          color += hsl2rgb(uColorHue + 0.5, 1.0, 0.5) * centerGlow * (0.3 + uPulse * 0.7);

          // Edge highlights
          float edge = abs(fract(pattern * 5.0) - 0.5);
          edge = smoothstep(0.4, 0.5, edge);
          color += vec3(1.0) * edge * 0.2 * uEnergy;

          // Strobe on pulse
          color += vec3(1.0) * uPulse * 0.2 * step(0.9, fract(uTime * 10.0));

          // Vignette
          float vignette = 1.0 - length(vUv - 0.5) * 0.5;
          color *= vignette;

          gl_FragColor = vec4(color, 1.0);
        }
      `
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    this.time = time
    const dt = deltaTime * 0.001

    // Update pulse
    if (beat.isOnset) {
      this.currentPulse = 1.0
      // Change rotation direction or speed on beat
      this.rotationSpeed *= Math.random() > 0.5 ? 1 : -1
    }
    this.currentPulse *= 0.9

    // Update rotation
    this.rotation += dt * this.rotationSpeed * (1 + audio.energy * 0.5)

    // Update uniforms
    this.material.uniforms.uTime.value = time * 0.001
    this.material.uniforms.uPulse.value = this.currentPulse
    this.material.uniforms.uColorHue.value = this.colorHue
    this.material.uniforms.uBass.value = audio.bass
    this.material.uniforms.uMid.value = audio.mid
    this.material.uniforms.uHigh.value = audio.high
    this.material.uniforms.uEnergy.value = audio.energy
    this.material.uniforms.uSegments.value = this.segments
    this.material.uniforms.uRotation.value = this.rotation
    this.material.uniforms.uComplexity.value = this.complexity
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
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
      { key: 'segments', label: 'Segments', type: 'number', value: this.segments, min: 3, max: 12, step: 1 },
      { key: 'rotationSpeed', label: 'Speed', type: 'number', value: Math.abs(this.rotationSpeed), min: 0.5, max: 3, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'complexity', label: 'Detail', type: 'number', value: this.complexity, min: 0.5, max: 2, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'segments':
        this.segments = Math.floor(value as number)
        break
      case 'rotationSpeed':
        this.rotationSpeed = (value as number) * Math.sign(this.rotationSpeed || 1)
        break
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'complexity':
        this.complexity = value as number
        break
    }
  }
}
