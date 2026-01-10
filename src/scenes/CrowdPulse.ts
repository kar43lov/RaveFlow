import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class CrowdPulse implements Scene {
  name = 'Crowd Pulse'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private crowdMaterial: THREE.ShaderMaterial
  private crowdPlane: THREE.Mesh

  private width: number = 0
  private height: number = 0

  // Parameters
  private crowdDensity: number = 1.0
  private colorHue: number = 0.0 // Red/orange
  private pulseStrength: number = 1.0
  private djGlow: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.crowdMaterial = new THREE.ShaderMaterial()
    this.crowdPlane = new THREE.Mesh()
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

    this.crowdMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uEnergy: { value: 0 },
        uCrowdDensity: { value: this.crowdDensity },
        uDjGlow: { value: this.djGlow },
        uSpectrum: { value: new Float32Array(64) }
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
        uniform float uCrowdDensity;
        uniform float uDjGlow;
        uniform float uSpectrum[64];

        varying vec2 vUv;

        // Hash functions
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float hash1(float n) {
          return fract(sin(n) * 43758.5453);
        }

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        // Draw a simple person silhouette
        float person(vec2 uv, vec2 pos, float height, float phase) {
          vec2 p = uv - pos;
          p.y /= height;

          // Head
          float head = smoothstep(0.05, 0.03, length(p - vec2(0.0, 0.85)));

          // Body (triangle-ish)
          float body = 0.0;
          if (p.y > 0.0 && p.y < 0.7) {
            float bodyWidth = 0.08 + p.y * 0.15;
            body = smoothstep(bodyWidth, bodyWidth - 0.02, abs(p.x));
          }

          // Arms (move with phase)
          float armAngle = sin(phase) * 0.5;
          vec2 armL = p - vec2(-0.08, 0.5);
          vec2 armR = p - vec2(0.08, 0.5);

          // Rotate arms
          float ca = cos(armAngle);
          float sa = sin(armAngle);
          armL = vec2(armL.x * ca - armL.y * sa, armL.x * sa + armL.y * ca);
          armR = vec2(armR.x * ca + armR.y * sa, -armR.x * sa + armR.y * ca);

          float arms = smoothstep(0.02, 0.01, abs(armL.x)) * step(0.0, armL.y) * step(armL.y, 0.25);
          arms += smoothstep(0.02, 0.01, abs(armR.x)) * step(0.0, armR.y) * step(armR.y, 0.25);

          return max(head, max(body, arms));
        }

        // DJ booth silhouette
        float djBooth(vec2 uv) {
          // Table
          float table = step(abs(uv.x), 0.2) * step(uv.y, 0.15) * step(0.05, uv.y);

          // DJ figure
          vec2 djPos = vec2(0.0, 0.15);
          float dj = person(uv, djPos, 0.25, uTime * 3.0);

          // Decks glow
          float decks = 0.0;
          vec2 deckL = uv - vec2(-0.1, 0.1);
          vec2 deckR = uv - vec2(0.1, 0.1);
          decks += exp(-length(deckL) * 20.0) * 0.5;
          decks += exp(-length(deckR) * 20.0) * 0.5;

          return max(table, dj) + decks;
        }

        void main() {
          vec2 uv = vUv;
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);

          // Background gradient (stage lights)
          vec3 bgColor = vec3(0.02, 0.01, 0.05);
          float bgGlow = exp(-length((uv - vec2(0.5, 0.8)) * vec2(1.5, 2.0)) * 2.0);
          bgColor += hsl2rgb(uColorHue, 0.8, 0.3) * bgGlow * 0.5;

          // Stage lights / lasers
          float lights = 0.0;
          for (int i = 0; i < 5; i++) {
            float angle = (float(i) - 2.0) * 0.3 + sin(uTime * 0.5 + float(i)) * 0.2;
            vec2 lightDir = vec2(sin(angle), -cos(angle));
            vec2 lightPos = vec2(0.5 + float(i - 2) * 0.15, 1.0);
            float d = abs(dot(uv - lightPos, vec2(-lightDir.y, lightDir.x)));
            float beam = exp(-d * 50.0) * 0.3 * (1.0 + uPulse * 0.5);
            float hue = uColorHue + float(i) * 0.1;
            bgColor += hsl2rgb(mod(hue, 1.0), 1.0, 0.5) * beam;
          }

          // DJ booth at back
          vec2 djUv = (uv - vec2(0.5, 0.7)) * 2.0;
          float dj = djBooth(djUv);
          vec3 djColor = hsl2rgb(uColorHue + 0.5, 0.8, 0.6) * dj * uDjGlow;
          bgColor += djColor * (0.5 + uPulse * 0.5);

          // Crowd
          vec3 crowdColor = vec3(0.0);
          float crowdMask = 0.0;

          // Multiple rows of crowd
          for (int row = 0; row < 4; row++) {
            float rowY = 0.1 + float(row) * 0.12;
            float rowScale = 0.15 - float(row) * 0.02; // Smaller toward back

            // People in this row
            int peopleCount = 8 + row * 4;
            for (int i = 0; i < 20; i++) {
              if (i >= peopleCount) break;

              float id = float(row * 20 + i);
              float x = hash1(id * 1.1) * 2.0 - 1.0;
              float height = rowScale * (0.8 + hash1(id * 2.2) * 0.4);

              // Bounce phase based on BPM and individual variation
              float phase = uTime * 10.0 + hash1(id * 3.3) * 6.28;
              float bounce = sin(phase) * 0.02 * (1.0 + uBass * 2.0);

              vec2 personPos = vec2(x * 0.5 + 0.5, rowY + bounce);

              float p = person(uv, personPos, height, phase);
              crowdMask = max(crowdMask, p);

              // Individual color variation
              float hue = uColorHue + hash1(id) * 0.3 - 0.15;
              crowdColor = max(crowdColor, hsl2rgb(mod(hue, 1.0), 0.6, 0.3) * p);
            }
          }

          // Equalizer at bottom
          float eq = 0.0;
          int bands = 32;
          for (int i = 0; i < 32; i++) {
            float x = (float(i) + 0.5) / float(bands);
            float barX = abs(uv.x - x) * float(bands);

            // Get spectrum value (simulated from bass/mid/high)
            float freqVal = 0.0;
            if (i < 8) freqVal = uBass;
            else if (i < 20) freqVal = uEnergy;
            else freqVal = uEnergy * 0.5;

            freqVal *= (0.5 + hash1(float(i)) * 0.5); // Variation
            freqVal *= 1.0 + uPulse * 0.5;

            float barHeight = freqVal * 0.15;
            float bar = step(barX, 0.4) * step(uv.y, barHeight) * step(0.0, uv.y);
            eq = max(eq, bar);

            // Gradient color for EQ
            float hue = uColorHue + float(i) / float(bands) * 0.3;
          }

          vec3 eqColor = hsl2rgb(uColorHue + 0.2, 1.0, 0.6) * eq;

          // Combine everything
          vec3 finalColor = bgColor;
          finalColor = mix(finalColor, crowdColor, step(0.01, crowdMask));
          finalColor += eqColor;

          // Flash on beat
          finalColor += vec3(1.0) * uPulse * 0.15;

          // Vignette
          float vignette = 1.0 - length((uv - 0.5) * 1.2) * 0.5;
          finalColor *= vignette;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    })

    this.crowdPlane = new THREE.Mesh(geometry, this.crowdMaterial)
    this.scene.add(this.crowdPlane)
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    this.time = time

    // Update pulse
    if (beat.isOnset) {
      this.currentPulse = 1.0
    }
    this.currentPulse *= 0.85

    // Update uniforms
    this.crowdMaterial.uniforms.uTime.value = time * 0.001
    this.crowdMaterial.uniforms.uPulse.value = this.currentPulse * this.pulseStrength
    this.crowdMaterial.uniforms.uColorHue.value = this.colorHue
    this.crowdMaterial.uniforms.uBass.value = audio.bass
    this.crowdMaterial.uniforms.uEnergy.value = audio.energy
    this.crowdMaterial.uniforms.uCrowdDensity.value = this.crowdDensity
    this.crowdMaterial.uniforms.uDjGlow.value = this.djGlow
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    const aspect = width / height
    this.camera.left = -aspect
    this.camera.right = aspect
    this.camera.updateProjectionMatrix()

    this.crowdPlane.geometry.dispose()
    this.crowdPlane.geometry = new THREE.PlaneGeometry(2 * aspect, 2)
    this.crowdMaterial.uniforms.uResolution.value.set(width, height)
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.crowdPlane.geometry.dispose()
    this.crowdMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'pulseStrength', label: 'Pulse', type: 'number', value: this.pulseStrength, min: 0, max: 2, step: 0.1 },
      { key: 'crowdDensity', label: 'Crowd', type: 'number', value: this.crowdDensity, min: 0.5, max: 2, step: 0.1 },
      { key: 'djGlow', label: 'DJ Glow', type: 'number', value: this.djGlow, min: 0, max: 2, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'pulseStrength':
        this.pulseStrength = value as number
        break
      case 'crowdDensity':
        this.crowdDensity = value as number
        break
      case 'djGlow':
        this.djGlow = value as number
        break
    }
  }
}
