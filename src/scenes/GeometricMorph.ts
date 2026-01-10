import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class GeometricMorph implements Scene {
  name = 'Geometric Morph'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private mesh: THREE.Mesh
  private wireMesh: THREE.LineSegments
  private material: THREE.ShaderMaterial
  private wireMaterial: THREE.ShaderMaterial
  private backgroundMesh: THREE.Mesh
  private backgroundMaterial: THREE.ShaderMaterial

  private width: number = 0
  private height: number = 0

  // Geometries for morphing
  private cubePositions: Float32Array = new Float32Array(0)
  private spherePositions: Float32Array = new Float32Array(0)
  private pyramidPositions: Float32Array = new Float32Array(0)
  private torusPositions: Float32Array = new Float32Array(0)

  // Parameters
  private morphSpeed: number = 1.0
  private colorHue: number = 0.8 // Purple
  private wireframeOpacity: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private currentShape: number = 0
  private targetShape: number = 0
  private morphProgress: number = 1.0
  private rotation: THREE.Vector3 = new THREE.Vector3()

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    this.mesh = new THREE.Mesh()
    this.wireMesh = new THREE.LineSegments()
    this.material = new THREE.ShaderMaterial()
    this.wireMaterial = new THREE.ShaderMaterial()
    this.backgroundMesh = new THREE.Mesh()
    this.backgroundMaterial = new THREE.ShaderMaterial()
  }

  private createShapePositions(geometry: THREE.BufferGeometry, targetCount: number): Float32Array {
    const positions = geometry.attributes.position.array as Float32Array
    const result = new Float32Array(targetCount * 3)

    // Fill with geometry positions, repeating if needed
    for (let i = 0; i < targetCount; i++) {
      const srcIndex = (i % (positions.length / 3)) * 3
      result[i * 3] = positions[srcIndex]
      result[i * 3 + 1] = positions[srcIndex + 1]
      result[i * 3 + 2] = positions[srcIndex + 2]
    }

    return result
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.camera.position.set(0, 0, 4)
    this.camera.lookAt(0, 0, 0)

    // Create base geometries and extract positions
    const vertexCount = 1000
    const detail = 32

    const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5, detail, detail, detail)
    const sphereGeo = new THREE.SphereGeometry(1, detail, detail)
    const pyramidGeo = new THREE.ConeGeometry(1, 1.5, detail, detail)
    const torusGeo = new THREE.TorusGeometry(0.8, 0.3, detail, detail)

    this.cubePositions = this.createShapePositions(cubeGeo, vertexCount)
    this.spherePositions = this.createShapePositions(sphereGeo, vertexCount)
    this.pyramidPositions = this.createShapePositions(pyramidGeo, vertexCount)
    this.torusPositions = this.createShapePositions(torusGeo, vertexCount)

    cubeGeo.dispose()
    sphereGeo.dispose()
    pyramidGeo.dispose()
    torusGeo.dispose()

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

          // Dark gradient background
          vec3 color = hsl2rgb(uColorHue + 0.5, 0.3, 0.02 + (1.0 - dist) * 0.03);

          // Grid
          float gridX = smoothstep(0.02, 0.0, abs(fract(uv.x * 10.0 + 0.5) - 0.5) - 0.48);
          float gridY = smoothstep(0.02, 0.0, abs(fract(uv.y * 10.0 + 0.5) - 0.5) - 0.48);
          float grid = max(gridX, gridY) * (0.1 + uEnergy * 0.2);
          color += hsl2rgb(uColorHue, 0.5, 0.3) * grid;

          // Radial pulse
          float ring = sin(dist * 20.0 - uTime * 3.0) * 0.5 + 0.5;
          ring = pow(ring, 8.0) * exp(-dist * 2.0) * uPulse;
          color += hsl2rgb(uColorHue, 1.0, 0.5) * ring;

          gl_FragColor = vec4(color, 1.0);
        }
      `
    })

    this.backgroundMesh = new THREE.Mesh(bgGeometry, this.backgroundMaterial)
    this.backgroundMesh.position.z = -5
    this.scene.add(this.backgroundMesh)

    // Create morphing mesh
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.cubePositions.slice(), 3))
    geometry.setAttribute('aTargetPos', new THREE.BufferAttribute(this.spherePositions.slice(), 3))

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMorphProgress: { value: 0 },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uEnergy: { value: 0 }
      },
      vertexShader: `
        attribute vec3 aTargetPos;

        uniform float uTime;
        uniform float uMorphProgress;
        uniform float uPulse;
        uniform float uEnergy;

        varying vec3 vPosition;
        varying float vNoise;

        // Simplex noise function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;

          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
        }

        void main() {
          // Morph between shapes
          vec3 pos = mix(position, aTargetPos, uMorphProgress);

          // Add noise displacement
          float noise = snoise(pos * 2.0 + uTime * 0.5);
          vNoise = noise;

          // Pulse expansion
          float pulse = 1.0 + uPulse * 0.2;
          pos *= pulse;

          // Audio reactive distortion
          pos += normalize(pos) * noise * 0.1 * uEnergy;

          vPosition = pos;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 3.0;
        }
      `,
      fragmentShader: `
        uniform float uColorHue;
        uniform float uPulse;
        uniform float uEnergy;

        varying vec3 vPosition;
        varying float vNoise;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          // Color based on position and noise
          float hue = uColorHue + vNoise * 0.1 + length(vPosition) * 0.1;
          vec3 color = hsl2rgb(hue, 0.8, 0.5 + vNoise * 0.2);

          // Brighten on pulse
          color += vec3(1.0) * uPulse * 0.3;

          // Energy glow
          color += hsl2rgb(uColorHue, 1.0, 0.5) * uEnergy * 0.3;

          gl_FragColor = vec4(color, 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)

    // Create wireframe overlay
    const wireGeometry = new THREE.BufferGeometry()
    wireGeometry.setAttribute('position', new THREE.BufferAttribute(this.cubePositions.slice(), 3))
    wireGeometry.setAttribute('aTargetPos', new THREE.BufferAttribute(this.spherePositions.slice(), 3))

    // Create edges for wireframe
    const indices: number[] = []
    for (let i = 0; i < vertexCount - 1; i++) {
      if (i % 10 === 0) { // Only some edges for performance
        indices.push(i, i + 1)
      }
    }
    wireGeometry.setIndex(indices)

    this.wireMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMorphProgress: { value: 0 },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uEnergy: { value: 0 },
        uOpacity: { value: this.wireframeOpacity }
      },
      vertexShader: `
        attribute vec3 aTargetPos;

        uniform float uTime;
        uniform float uMorphProgress;
        uniform float uPulse;
        uniform float uEnergy;

        varying vec3 vPosition;

        void main() {
          vec3 pos = mix(position, aTargetPos, uMorphProgress);
          float pulse = 1.0 + uPulse * 0.2;
          pos *= pulse * 1.01; // Slightly larger than solid

          vPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uColorHue;
        uniform float uPulse;
        uniform float uOpacity;

        varying vec3 vPosition;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          vec3 color = hsl2rgb(uColorHue + 0.2, 1.0, 0.7);
          color += vec3(1.0) * uPulse * 0.5;
          gl_FragColor = vec4(color, uOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    this.wireMesh = new THREE.LineSegments(wireGeometry, this.wireMaterial)
    this.scene.add(this.wireMesh)
  }

  private getShapePositions(shapeIndex: number): Float32Array {
    switch (shapeIndex % 4) {
      case 0: return this.cubePositions
      case 1: return this.spherePositions
      case 2: return this.pyramidPositions
      case 3: return this.torusPositions
      default: return this.cubePositions
    }
  }

  update(time: number, deltaTime: number, beat: BeatInfo, audio: AudioFeatures): void {
    this.time = time
    const dt = deltaTime * 0.001

    // Update pulse and trigger morph
    if (beat.isOnset) {
      this.currentPulse = 1.0
      // Advance to next shape
      this.currentShape = this.targetShape
      this.targetShape = (this.targetShape + 1) % 4
      this.morphProgress = 0

      // Update geometry attributes
      const currentPositions = this.getShapePositions(this.currentShape)
      const targetPositions = this.getShapePositions(this.targetShape)

      const meshPositions = this.mesh.geometry.attributes.position.array as Float32Array
      const meshTargets = this.mesh.geometry.attributes.aTargetPos.array as Float32Array
      const wirePositions = this.wireMesh.geometry.attributes.position.array as Float32Array
      const wireTargets = this.wireMesh.geometry.attributes.aTargetPos.array as Float32Array

      for (let i = 0; i < currentPositions.length; i++) {
        meshPositions[i] = currentPositions[i]
        meshTargets[i] = targetPositions[i]
        wirePositions[i] = currentPositions[i]
        wireTargets[i] = targetPositions[i]
      }

      this.mesh.geometry.attributes.position.needsUpdate = true
      this.mesh.geometry.attributes.aTargetPos.needsUpdate = true
      this.wireMesh.geometry.attributes.position.needsUpdate = true
      this.wireMesh.geometry.attributes.aTargetPos.needsUpdate = true
    }
    this.currentPulse *= 0.9

    // Animate morph progress
    if (this.morphProgress < 1.0) {
      this.morphProgress += dt * this.morphSpeed
      this.morphProgress = Math.min(1.0, this.morphProgress)
    }

    // Rotate mesh
    this.rotation.x += dt * 0.3 * (1 + audio.energy * 0.5)
    this.rotation.y += dt * 0.5 * (1 + audio.energy * 0.5)

    this.mesh.rotation.x = this.rotation.x
    this.mesh.rotation.y = this.rotation.y
    this.wireMesh.rotation.x = this.rotation.x
    this.wireMesh.rotation.y = this.rotation.y

    // Update uniforms
    this.material.uniforms.uTime.value = time * 0.001
    this.material.uniforms.uMorphProgress.value = this.morphProgress
    this.material.uniforms.uPulse.value = this.currentPulse
    this.material.uniforms.uColorHue.value = this.colorHue
    this.material.uniforms.uEnergy.value = audio.energy

    this.wireMaterial.uniforms.uTime.value = time * 0.001
    this.wireMaterial.uniforms.uMorphProgress.value = this.morphProgress
    this.wireMaterial.uniforms.uPulse.value = this.currentPulse
    this.wireMaterial.uniforms.uColorHue.value = this.colorHue
    this.wireMaterial.uniforms.uEnergy.value = audio.energy
    this.wireMaterial.uniforms.uOpacity.value = this.wireframeOpacity

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
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.wireMesh.geometry.dispose()
    this.wireMaterial.dispose()
    this.backgroundMesh.geometry.dispose()
    this.backgroundMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'morphSpeed', label: 'Speed', type: 'number', value: this.morphSpeed, min: 0.5, max: 3, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'wireframeOpacity', label: 'Wire', type: 'number', value: this.wireframeOpacity, min: 0, max: 1, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'morphSpeed':
        this.morphSpeed = value as number
        break
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'wireframeOpacity':
        this.wireframeOpacity = value as number
        break
    }
  }
}
