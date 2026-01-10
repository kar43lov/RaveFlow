import * as THREE from 'three'

// Simple bloom effect using multiple render passes
export class PostProcessing {
  private renderer: THREE.WebGLRenderer
  private width: number
  private height: number

  // Render targets for bloom
  private renderTargetA: THREE.WebGLRenderTarget
  private renderTargetB: THREE.WebGLRenderTarget
  private renderTargetBright: THREE.WebGLRenderTarget

  // Full-screen quad
  private quadScene: THREE.Scene
  private quadCamera: THREE.OrthographicCamera
  private quadMesh: THREE.Mesh

  // Shaders
  private brightPassMaterial: THREE.ShaderMaterial
  private blurMaterialH: THREE.ShaderMaterial
  private blurMaterialV: THREE.ShaderMaterial
  private compositeMaterial: THREE.ShaderMaterial

  private enabled: boolean = true
  private bloomStrength: number = 0.5
  private bloomRadius: number = 0.5

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer
    this.width = width
    this.height = height

    // Create render targets at half resolution for performance
    const halfWidth = Math.floor(width / 2)
    const halfHeight = Math.floor(height / 2)

    const rtParams = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    }

    this.renderTargetA = new THREE.WebGLRenderTarget(halfWidth, halfHeight, rtParams)
    this.renderTargetB = new THREE.WebGLRenderTarget(halfWidth, halfHeight, rtParams)
    this.renderTargetBright = new THREE.WebGLRenderTarget(halfWidth, halfHeight, rtParams)

    // Create fullscreen quad
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quadScene = new THREE.Scene()

    const quadGeometry = new THREE.PlaneGeometry(2, 2)

    // Bright pass shader - extract bright areas
    this.brightPassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: 0.5 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float threshold;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          float contribution = max(0.0, brightness - threshold);
          gl_FragColor = vec4(color.rgb * contribution, 1.0);
        }
      `
    })

    // Horizontal blur shader
    this.blurMaterialH = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(halfWidth, halfHeight) },
        direction: { value: new THREE.Vector2(1.0, 0.0) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform vec2 direction;
        varying vec2 vUv;

        void main() {
          vec2 texelSize = 1.0 / resolution;
          vec4 result = vec4(0.0);

          // 9-tap Gaussian blur
          float weights[5];
          weights[0] = 0.227027;
          weights[1] = 0.1945946;
          weights[2] = 0.1216216;
          weights[3] = 0.054054;
          weights[4] = 0.016216;

          result += texture2D(tDiffuse, vUv) * weights[0];

          for (int i = 1; i < 5; i++) {
            vec2 offset = direction * texelSize * float(i) * 2.0;
            result += texture2D(tDiffuse, vUv + offset) * weights[i];
            result += texture2D(tDiffuse, vUv - offset) * weights[i];
          }

          gl_FragColor = result;
        }
      `
    })

    // Vertical blur shader
    this.blurMaterialV = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(halfWidth, halfHeight) },
        direction: { value: new THREE.Vector2(0.0, 1.0) }
      },
      vertexShader: this.blurMaterialH.vertexShader,
      fragmentShader: this.blurMaterialH.fragmentShader
    })

    // Composite shader - combine original with bloom
    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        bloomStrength: { value: this.bloomStrength }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        uniform float bloomStrength;
        varying vec2 vUv;
        void main() {
          vec4 original = texture2D(tDiffuse, vUv);
          vec4 bloom = texture2D(tBloom, vUv);
          gl_FragColor = original + bloom * bloomStrength;
        }
      `
    })

    this.quadMesh = new THREE.Mesh(quadGeometry, this.brightPassMaterial)
    this.quadScene.add(this.quadMesh)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  setBloomStrength(strength: number): void {
    this.bloomStrength = strength
    this.compositeMaterial.uniforms.bloomStrength.value = strength
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height

    const halfWidth = Math.floor(width / 2)
    const halfHeight = Math.floor(height / 2)

    this.renderTargetA.setSize(halfWidth, halfHeight)
    this.renderTargetB.setSize(halfWidth, halfHeight)
    this.renderTargetBright.setSize(halfWidth, halfHeight)

    this.blurMaterialH.uniforms.resolution.value.set(halfWidth, halfHeight)
    this.blurMaterialV.uniforms.resolution.value.set(halfWidth, halfHeight)
  }

  render(inputTexture: THREE.Texture): void {
    if (!this.enabled) {
      // Just copy to screen
      this.quadMesh.material = this.compositeMaterial
      this.compositeMaterial.uniforms.tDiffuse.value = inputTexture
      this.compositeMaterial.uniforms.tBloom.value = null
      this.compositeMaterial.uniforms.bloomStrength.value = 0
      this.renderer.setRenderTarget(null)
      this.renderer.render(this.quadScene, this.quadCamera)
      return
    }

    // 1. Extract bright areas
    this.quadMesh.material = this.brightPassMaterial
    this.brightPassMaterial.uniforms.tDiffuse.value = inputTexture
    this.renderer.setRenderTarget(this.renderTargetBright)
    this.renderer.render(this.quadScene, this.quadCamera)

    // 2. Horizontal blur
    this.quadMesh.material = this.blurMaterialH
    this.blurMaterialH.uniforms.tDiffuse.value = this.renderTargetBright.texture
    this.renderer.setRenderTarget(this.renderTargetA)
    this.renderer.render(this.quadScene, this.quadCamera)

    // 3. Vertical blur
    this.quadMesh.material = this.blurMaterialV
    this.blurMaterialV.uniforms.tDiffuse.value = this.renderTargetA.texture
    this.renderer.setRenderTarget(this.renderTargetB)
    this.renderer.render(this.quadScene, this.quadCamera)

    // Additional blur passes for stronger effect
    this.blurMaterialH.uniforms.tDiffuse.value = this.renderTargetB.texture
    this.renderer.setRenderTarget(this.renderTargetA)
    this.renderer.render(this.quadScene, this.quadCamera)

    this.blurMaterialV.uniforms.tDiffuse.value = this.renderTargetA.texture
    this.renderer.setRenderTarget(this.renderTargetB)
    this.renderer.render(this.quadScene, this.quadCamera)

    // 4. Composite
    this.quadMesh.material = this.compositeMaterial
    this.compositeMaterial.uniforms.tDiffuse.value = inputTexture
    this.compositeMaterial.uniforms.tBloom.value = this.renderTargetB.texture
    this.compositeMaterial.uniforms.bloomStrength.value = this.bloomStrength
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.quadScene, this.quadCamera)
  }

  dispose(): void {
    this.renderTargetA.dispose()
    this.renderTargetB.dispose()
    this.renderTargetBright.dispose()
    this.brightPassMaterial.dispose()
    this.blurMaterialH.dispose()
    this.blurMaterialV.dispose()
    this.compositeMaterial.dispose()
    this.quadMesh.geometry.dispose()
  }
}
