import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

interface Building {
  x: number
  z: number
  width: number
  depth: number
  height: number
  hue: number
}

export class CityFlythrough implements Scene {
  name = 'City Flythrough'

  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private buildings: THREE.Group
  private buildingData: Building[] = []
  private gridMesh: THREE.Mesh
  private gridMaterial: THREE.ShaderMaterial
  private skyMesh: THREE.Mesh
  private skyMaterial: THREE.ShaderMaterial

  private width: number = 0
  private height: number = 0

  // Parameters
  private buildingDensity: number = 1.0
  private buildingHeight: number = 1.0
  private colorHue: number = 0.55 // Cyan
  private flySpeed: number = 1.0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private cameraZ: number = 0
  private buildingMaterials: THREE.ShaderMaterial[] = []

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500)
    this.buildings = new THREE.Group()
    this.gridMesh = new THREE.Mesh()
    this.gridMaterial = new THREE.ShaderMaterial()
    this.skyMesh = new THREE.Mesh()
    this.skyMaterial = new THREE.ShaderMaterial()
  }

  private createBuildings(): void {
    // Clear existing buildings
    while (this.buildings.children.length > 0) {
      const child = this.buildings.children[0]
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
      }
      this.buildings.remove(child)
    }
    this.buildingMaterials = []
    this.buildingData = []

    const gridSize = 200
    const cellSize = 10 / this.buildingDensity
    const roadWidth = 3

    for (let x = -gridSize; x < gridSize; x += cellSize) {
      for (let z = -gridSize; z < gridSize; z += cellSize) {
        // Skip some cells for roads
        if (Math.abs(x % (cellSize * 3)) < roadWidth || Math.abs(z % (cellSize * 3)) < roadWidth) {
          continue
        }

        // Random building properties
        const width = (cellSize - roadWidth) * (0.5 + Math.random() * 0.4)
        const depth = (cellSize - roadWidth) * (0.5 + Math.random() * 0.4)
        const height = (5 + Math.random() * 30) * this.buildingHeight
        const hue = this.colorHue + (Math.random() - 0.5) * 0.2

        this.buildingData.push({ x, z, width, depth, height, hue })

        // Create building geometry
        const geometry = new THREE.BoxGeometry(width, height, depth)
        geometry.translate(0, height / 2, 0)

        const material = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uPulse: { value: 0 },
            uColorHue: { value: hue },
            uEnergy: { value: 0 },
            uHeight: { value: height }
          },
          vertexShader: `
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;

            void main() {
              vPosition = position;
              vNormal = normal;
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float uTime;
            uniform float uPulse;
            uniform float uColorHue;
            uniform float uEnergy;
            uniform float uHeight;

            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;

            vec3 hsl2rgb(float h, float s, float l) {
              vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
              return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
            }

            void main() {
              // Base dark color
              vec3 color = vec3(0.02, 0.02, 0.05);

              // Edge glow (neon outline effect)
              float edgeX = abs(vNormal.x);
              float edgeZ = abs(vNormal.z);
              float isEdge = max(edgeX, edgeZ);

              // Window pattern on sides
              float windowX = step(0.1, fract(vPosition.x * 2.0)) * step(fract(vPosition.x * 2.0), 0.9);
              float windowY = step(0.2, fract(vPosition.y * 0.5)) * step(fract(vPosition.y * 0.5), 0.8);
              float windowZ = step(0.1, fract(vPosition.z * 2.0)) * step(fract(vPosition.z * 2.0), 0.9);
              float window = windowY * max(windowX * edgeX, windowZ * edgeZ);

              // Random window lights
              float lightOn = step(0.6, fract(sin(floor(vPosition.x * 2.0) * 12.9898 + floor(vPosition.y * 0.5) * 78.233 + floor(vPosition.z * 2.0) * 45.164) * 43758.5453));
              window *= lightOn;

              // Window color
              vec3 windowColor = hsl2rgb(uColorHue + 0.1, 0.5, 0.4) * window;
              color += windowColor * (0.5 + uEnergy * 0.5);

              // Neon edge lines
              float edgeLine = 0.0;

              // Vertical edges
              float vertEdge = 1.0 - abs(vNormal.y);
              vertEdge *= smoothstep(0.9, 1.0, abs(fract(vPosition.x + 0.5) - 0.5) * 2.0);
              vertEdge *= smoothstep(0.9, 1.0, abs(fract(vPosition.z + 0.5) - 0.5) * 2.0);

              // Horizontal lines
              float horizLine = smoothstep(0.95, 1.0, fract(vPosition.y * 0.2));
              horizLine *= isEdge;

              // Top edge
              float topEdge = smoothstep(uHeight - 0.5, uHeight, vPosition.y);

              edgeLine = max(vertEdge, max(horizLine, topEdge));

              vec3 neonColor = hsl2rgb(uColorHue, 1.0, 0.6);
              color += neonColor * edgeLine * (0.5 + uPulse * 0.5);

              // Pulse glow
              color += neonColor * uPulse * 0.2;

              gl_FragColor = vec4(color, 1.0);
            }
          `
        })

        this.buildingMaterials.push(material)

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, 0, z)
        this.buildings.add(mesh)
      }
    }
  }

  init(renderer: THREE.WebGLRenderer, width: number, height: number): void {
    this.width = width
    this.height = height

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.camera.position.set(0, 5, 0)
    this.camera.lookAt(0, 5, -100)

    // Create ground grid
    const gridGeometry = new THREE.PlaneGeometry(500, 500, 100, 100)
    gridGeometry.rotateX(-Math.PI / 2)

    this.gridMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uColorHue: { value: this.colorHue },
        uEnergy: { value: 0 },
        uCameraZ: { value: 0 }
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
        uniform float uPulse;
        uniform float uColorHue;
        uniform float uEnergy;
        uniform float uCameraZ;

        varying vec2 vUv;
        varying vec3 vPosition;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          vec2 gridPos = vPosition.xz + vec2(0.0, uCameraZ);

          // Grid lines
          float gridX = smoothstep(0.1, 0.0, abs(fract(gridPos.x * 0.1) - 0.5) - 0.48);
          float gridZ = smoothstep(0.1, 0.0, abs(fract(gridPos.y * 0.1) - 0.5) - 0.48);
          float grid = max(gridX, gridZ);

          // Finer grid
          float fineX = smoothstep(0.02, 0.0, abs(fract(gridPos.x * 0.5) - 0.5) - 0.49);
          float fineZ = smoothstep(0.02, 0.0, abs(fract(gridPos.y * 0.5) - 0.5) - 0.49);
          float fineGrid = max(fineX, fineZ) * 0.3;

          grid = max(grid, fineGrid);

          vec3 color = hsl2rgb(uColorHue, 1.0, 0.4) * grid;

          // Pulse waves
          float dist = length(vPosition.xz);
          float wave = sin(dist * 0.2 - uTime * 3.0) * 0.5 + 0.5;
          wave = pow(wave, 4.0) * uPulse;
          color += hsl2rgb(uColorHue + 0.2, 1.0, 0.5) * wave * 0.5;

          // Distance fade
          float fade = exp(-dist * 0.01);
          color *= fade;

          // Energy boost
          color *= 0.5 + uEnergy * 0.5;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    })

    this.gridMesh = new THREE.Mesh(gridGeometry, this.gridMaterial)
    this.scene.add(this.gridMesh)

    // Create sky
    const skyGeometry = new THREE.SphereGeometry(200, 32, 32)
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorHue: { value: this.colorHue },
        uPulse: { value: 0 }
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uColorHue;
        uniform float uPulse;

        varying vec3 vPosition;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main() {
          vec3 dir = normalize(vPosition);

          // Gradient sky
          float horizon = smoothstep(-0.1, 0.5, dir.y);

          vec3 skyBottom = hsl2rgb(uColorHue + 0.5, 0.8, 0.05);
          vec3 skyTop = hsl2rgb(uColorHue + 0.3, 0.5, 0.02);
          vec3 color = mix(skyBottom, skyTop, horizon);

          // Horizon glow
          float horizonGlow = exp(-abs(dir.y) * 10.0);
          color += hsl2rgb(uColorHue, 1.0, 0.3) * horizonGlow * 0.5;

          // Digital rain / data streams
          float rain = fract(sin(floor(dir.x * 50.0) * 12.9898 + floor(dir.z * 50.0) * 78.233) * 43758.5453);
          rain *= step(0.95, rain);
          rain *= smoothstep(0.0, 0.5, dir.y) * smoothstep(1.0, 0.5, dir.y);
          float rainAnim = fract(rain * 10.0 - uTime * 0.5);
          color += hsl2rgb(uColorHue, 1.0, 0.6) * rainAnim * rain * 0.5;

          // Pulse flash
          color += vec3(0.05) * uPulse;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide
    })

    this.skyMesh = new THREE.Mesh(skyGeometry, this.skyMaterial)
    this.scene.add(this.skyMesh)

    // Create buildings
    this.createBuildings()
    this.scene.add(this.buildings)
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
    const speed = 20 * this.flySpeed * (1 + audio.energy * 0.5)
    this.cameraZ -= dt * speed

    // Wrap camera position
    if (this.cameraZ < -200) {
      this.cameraZ += 200
    }

    this.camera.position.z = this.cameraZ
    this.camera.position.y = 5 + Math.sin(time * 0.001) * 2 + audio.bass * 3
    this.camera.position.x = Math.sin(time * 0.0003) * 10

    // Look ahead
    this.camera.lookAt(
      this.camera.position.x + Math.sin(time * 0.0005) * 5,
      5,
      this.camera.position.z - 50
    )

    // Move sky with camera
    this.skyMesh.position.z = this.cameraZ

    // Update grid
    this.gridMaterial.uniforms.uTime.value = time * 0.001
    this.gridMaterial.uniforms.uPulse.value = this.currentPulse
    this.gridMaterial.uniforms.uColorHue.value = this.colorHue
    this.gridMaterial.uniforms.uEnergy.value = audio.energy
    this.gridMaterial.uniforms.uCameraZ.value = this.cameraZ

    // Update sky
    this.skyMaterial.uniforms.uTime.value = time * 0.001
    this.skyMaterial.uniforms.uColorHue.value = this.colorHue
    this.skyMaterial.uniforms.uPulse.value = this.currentPulse

    // Update building materials
    for (const material of this.buildingMaterials) {
      material.uniforms.uTime.value = time * 0.001
      material.uniforms.uPulse.value = this.currentPulse
      material.uniforms.uEnergy.value = audio.energy
    }
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
    // Dispose buildings
    while (this.buildings.children.length > 0) {
      const child = this.buildings.children[0]
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
      }
      this.buildings.remove(child)
    }

    for (const material of this.buildingMaterials) {
      material.dispose()
    }

    this.gridMesh.geometry.dispose()
    this.gridMaterial.dispose()
    this.skyMesh.geometry.dispose()
    this.skyMaterial.dispose()
    this.scene.clear()
  }

  getParameters(): SceneParameter[] {
    return [
      { key: 'buildingDensity', label: 'Density', type: 'number', value: this.buildingDensity, min: 0.5, max: 2, step: 0.1 },
      { key: 'buildingHeight', label: 'Height', type: 'number', value: this.buildingHeight, min: 0.5, max: 2, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'flySpeed', label: 'Speed', type: 'number', value: this.flySpeed, min: 0.5, max: 3, step: 0.1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'buildingDensity':
        this.buildingDensity = value as number
        // Would need to recreate buildings - expensive operation
        break
      case 'buildingHeight':
        this.buildingHeight = value as number
        break
      case 'colorHue':
        this.colorHue = value as number
        for (const material of this.buildingMaterials) {
          material.uniforms.uColorHue.value = this.colorHue + (Math.random() - 0.5) * 0.2
        }
        break
      case 'flySpeed':
        this.flySpeed = value as number
        break
    }
  }
}
