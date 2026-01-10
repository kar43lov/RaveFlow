import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class DJBoothStrobe implements Scene {
  name = 'DJ Booth'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private width: number = 0
  private height: number = 0
  private aspect: number = 1

  // Parameters
  private strobeIntensity: number = 1.0
  private spotlightAngle: number = 0.5
  private colorHue: number = 0.6 // Cyan/blue
  private fogDensity: number = 0.5

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private strobeActive: boolean = false
  private spotlightRotation: number = 0

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
        uStrobe: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uEnergy: { value: 0 },
        uSpotlightRotation: { value: 0 },
        uStrobeIntensity: { value: this.strobeIntensity },
        uFogDensity: { value: this.fogDensity }
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
        uniform float uStrobe;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uEnergy;
        uniform float uSpotlightRotation;
        uniform float uStrobeIntensity;
        uniform float uFogDensity;

        varying vec2 vUv;

        #define PI 3.14159265359

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // DJ silhouette
        float djSilhouette(vec2 uv) {
          float shape = 0.0;

          // DJ Table/Booth
          vec2 tableUv = uv - vec2(0.0, -0.25);
          float table = max(abs(tableUv.x) - 0.35, abs(tableUv.y) - 0.1);
          shape = max(shape, smoothstep(0.01, 0.0, table));

          // DJ Equipment on table
          for (float i = -1.0; i <= 1.0; i += 1.0) {
            vec2 eqUv = uv - vec2(i * 0.2, -0.12);
            float eq = max(abs(eqUv.x) - 0.08, abs(eqUv.y) - 0.05);
            shape = max(shape, smoothstep(0.01, 0.0, eq));
          }

          // DJ Body (torso)
          vec2 bodyUv = uv - vec2(0.0, 0.1);
          float body = length(bodyUv * vec2(1.0, 0.7)) - 0.15;
          shape = max(shape, smoothstep(0.01, 0.0, body));

          // DJ Head
          vec2 headUv = uv - vec2(0.0, 0.32);
          float head = length(headUv) - 0.1;
          shape = max(shape, smoothstep(0.01, 0.0, head));

          // Headphones
          vec2 hpLeft = uv - vec2(-0.11, 0.32);
          vec2 hpRight = uv - vec2(0.11, 0.32);
          float hp = min(length(hpLeft) - 0.04, length(hpRight) - 0.04);
          shape = max(shape, smoothstep(0.01, 0.0, hp));

          // Arms reaching to equipment
          for (float side = -1.0; side <= 1.0; side += 2.0) {
            vec2 armStart = vec2(side * 0.12, 0.05);
            vec2 armEnd = vec2(side * 0.2, -0.1);
            vec2 armDir = normalize(armEnd - armStart);
            float armLen = length(armEnd - armStart);

            vec2 armUv = uv - armStart;
            float proj = clamp(dot(armUv, armDir), 0.0, armLen);
            float armDist = length(armUv - armDir * proj) - 0.03;
            shape = max(shape, smoothstep(0.01, 0.0, armDist));
          }

          return shape;
        }

        // Spotlight cone
        float spotlight(vec2 uv, vec2 origin, float angle, float spread) {
          vec2 dir = vec2(cos(angle), sin(angle));
          vec2 toPoint = uv - origin;

          float dist = length(toPoint);
          float dotP = dot(normalize(toPoint), dir);

          // Cone angle check
          float cone = smoothstep(cos(spread), cos(spread * 0.5), dotP);

          // Distance falloff
          float falloff = exp(-dist * 1.5);

          // Volumetric light rays
          float rays = sin(atan(toPoint.y, toPoint.x) * 20.0 + uTime * 2.0) * 0.5 + 0.5;
          rays = pow(rays, 4.0);

          return cone * falloff * (0.7 + rays * 0.3);
        }

        // Fog/haze effect
        float fog(vec2 uv, float time, float density) {
          float f = 0.0;
          vec2 p = uv * 3.0;

          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            vec2 offset = vec2(
              sin(time * 0.3 + fi) * 0.5,
              cos(time * 0.2 + fi * 1.5) * 0.3
            );
            f += sin(p.x * (1.0 + fi * 0.5) + time + offset.x) *
                 sin(p.y * (0.8 + fi * 0.3) + time * 0.7 + offset.y);
          }

          return (f * 0.25 + 0.5) * density;
        }

        void main() {
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 uv = (vUv - 0.5) * 2.0;
          uv.x *= aspect.x;

          vec3 color = vec3(0.02, 0.02, 0.05); // Dark background

          // Floor
          float floorY = -0.5;
          if (uv.y < floorY) {
            // Reflective floor with grid
            vec2 floorUv = vec2(uv.x, floorY - uv.y);
            float grid = max(
              smoothstep(0.02, 0.0, abs(fract(floorUv.x * 5.0) - 0.5) - 0.48),
              smoothstep(0.02, 0.0, abs(fract(floorUv.y * 10.0) - 0.5) - 0.48)
            );
            color += hsl2rgb(uColorHue, 0.5, 0.1) * grid;

            // Reflection fade
            float reflectFade = exp((uv.y - floorY) * 3.0);
            color *= reflectFade;
          }

          // Multiple rotating spotlights
          float spotlightSum = 0.0;
          int spotCount = 4;
          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float baseAngle = fi / float(spotCount) * PI * 2.0;
            float rotAngle = baseAngle + uSpotlightRotation;

            // Spotlight origin (above DJ)
            vec2 spotOrigin = vec2(
              sin(baseAngle * 2.0 + uTime * 0.5) * 0.5,
              0.9
            );

            // Point downward with rotation
            float spotAngle = -PI * 0.5 + sin(rotAngle) * 0.5;

            float spot = spotlight(uv, spotOrigin, spotAngle, 0.3 + uBass * 0.2);
            vec3 spotColor = hsl2rgb(uColorHue + fi * 0.15, 1.0, 0.6);

            color += spotColor * spot * 0.4 * (0.5 + uEnergy * 0.5);
            spotlightSum += spot;
          }

          // Fog/haze in light beams
          float fogEffect = fog(uv, uTime, uFogDensity);
          color += vec3(0.1, 0.1, 0.15) * fogEffect * spotlightSum;

          // Laser beams from ceiling
          for (float i = 0.0; i < 6.0; i++) {
            float laserX = sin(uTime * 0.7 + i * 1.5) * aspect.x;
            float laserAngle = sin(uTime * 0.5 + i) * 0.5;

            vec2 laserOrigin = vec2(laserX, 1.0);
            vec2 laserDir = vec2(sin(laserAngle), -cos(laserAngle));

            vec2 toLaser = uv - laserOrigin;
            float proj = dot(toLaser, laserDir);
            if (proj > 0.0) {
              float dist = abs(toLaser.x * laserDir.y - toLaser.y * laserDir.x);
              float laser = exp(-dist * 100.0) * exp(-proj * 0.5);
              color += hsl2rgb(uColorHue + i * 0.1, 1.0, 0.7) * laser * uEnergy;
            }
          }

          // DJ Silhouette
          float dj = djSilhouette(uv);
          // DJ is a dark silhouette
          color = mix(color, vec3(0.0), dj * 0.9);

          // DJ edge glow
          float djGlow = 0.0;
          for (float dx = -1.0; dx <= 1.0; dx += 0.5) {
            for (float dy = -1.0; dy <= 1.0; dy += 0.5) {
              djGlow += djSilhouette(uv + vec2(dx, dy) * 0.02);
            }
          }
          djGlow = djGlow / 9.0 - dj;
          color += hsl2rgb(uColorHue, 1.0, 0.5) * max(djGlow, 0.0) * 2.0;

          // Strobe effect
          color += vec3(1.0) * uStrobe * uStrobeIntensity;

          // Beat pulse - color intensification
          color *= 1.0 + uPulse * 0.5;

          // Particles / dust in light
          float particles = 0.0;
          for (float i = 0.0; i < 30.0; i++) {
            vec2 particlePos = vec2(
              sin(i * 123.456 + uTime * 0.1) * aspect.x,
              mod(i * 0.1 + uTime * 0.05, 2.0) - 1.0
            );
            float p = exp(-length(uv - particlePos) * 50.0);
            particles += p * spotlightSum;
          }
          color += vec3(1.0) * particles * 0.3;

          // Vignette
          float vignette = 1.0 - length(vUv - 0.5) * 0.7;
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

    // Update pulse and strobe on beat
    if (beat.isOnset) {
      this.currentPulse = 1.0
      this.strobeActive = true
    }
    this.currentPulse *= 0.85

    // Strobe timing
    const strobeFreq = 15 + audio.energy * 20
    const strobe = this.strobeActive ? Math.sin(time * 0.001 * strobeFreq * Math.PI * 2) : 0
    if (strobe < 0) this.strobeActive = false

    // Rotate spotlights
    this.spotlightRotation += dt * (1.0 + audio.energy) * this.spotlightAngle

    // Update uniforms
    this.material.uniforms.uTime.value = time * 0.001
    this.material.uniforms.uPulse.value = this.currentPulse
    this.material.uniforms.uStrobe.value = Math.max(0, strobe) * this.currentPulse
    this.material.uniforms.uColorHue.value = this.colorHue
    this.material.uniforms.uBass.value = audio.bass
    this.material.uniforms.uEnergy.value = audio.energy
    this.material.uniforms.uSpotlightRotation.value = this.spotlightRotation
    this.material.uniforms.uStrobeIntensity.value = this.strobeIntensity
    this.material.uniforms.uFogDensity.value = this.fogDensity
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
      { key: 'strobeIntensity', label: 'Strobe', type: 'number', value: this.strobeIntensity, min: 0, max: 2, step: 0.1 },
      { key: 'spotlightAngle', label: 'Spots', type: 'number', value: this.spotlightAngle, min: 0.1, max: 2, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'fogDensity', label: 'Fog', type: 'number', value: this.fogDensity, min: 0, max: 1, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'strobeIntensity':
        this.strobeIntensity = value as number
        break
      case 'spotlightAngle':
        this.spotlightAngle = value as number
        break
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'fogDensity':
        this.fogDensity = value as number
        break
    }
  }
}
