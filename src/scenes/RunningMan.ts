import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class RunningMan implements Scene {
  name = 'Running Man'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private width: number = 0
  private height: number = 0
  private aspect: number = 1

  // Parameters
  private runSpeed: number = 1.0
  private colorHue: number = 0.85 // Pink/magenta
  private pixelated: boolean = true

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private runPhase: number = 0
  private jumpHeight: number = 0
  private parallaxOffset: number = 0

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
        uEnergy: { value: 0 },
        uRunPhase: { value: 0 },
        uJumpHeight: { value: 0 },
        uParallaxOffset: { value: 0 },
        uPixelated: { value: 1.0 }
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
        uniform float uRunPhase;
        uniform float uJumpHeight;
        uniform float uParallaxOffset;
        uniform float uPixelated;

        varying vec2 vUv;

        #define PI 3.14159265359

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        // Simple running man shape with pose based on phase
        float runningMan(vec2 uv, float phase) {
          float shape = 0.0;

          // Body center
          vec2 bodyCenter = vec2(0.0, 0.1);

          // Head
          float head = length(uv - bodyCenter - vec2(0.0, 0.25)) - 0.08;
          shape = max(shape, smoothstep(0.01, 0.0, head));

          // Torso (slightly tilted forward)
          vec2 torsoUv = uv - bodyCenter;
          torsoUv.x += torsoUv.y * 0.1; // Tilt
          float torso = max(abs(torsoUv.x) - 0.05, abs(torsoUv.y - 0.08) - 0.15);
          shape = max(shape, smoothstep(0.01, 0.0, torso));

          // Legs animation based on phase
          float legPhase = phase * PI * 2.0;

          // Left leg
          float leftLegAngle = sin(legPhase) * 0.5;
          vec2 leftLegStart = bodyCenter + vec2(-0.02, -0.05);
          vec2 leftLegDir = vec2(sin(leftLegAngle), -cos(leftLegAngle));
          vec2 leftLegEnd = leftLegStart + leftLegDir * 0.2;

          // Leg as capsule
          vec2 leftLegUv = uv - leftLegStart;
          float leftLegProj = clamp(dot(leftLegUv, leftLegDir), 0.0, 0.2);
          float leftLegDist = length(leftLegUv - leftLegDir * leftLegProj) - 0.03;
          shape = max(shape, smoothstep(0.01, 0.0, leftLegDist));

          // Left lower leg
          vec2 leftKnee = leftLegStart + leftLegDir * 0.2;
          float leftLowerAngle = leftLegAngle + 0.3 + sin(legPhase + 0.5) * 0.3;
          vec2 leftLowerDir = vec2(sin(leftLowerAngle), -cos(leftLowerAngle));
          vec2 leftLowerUv = uv - leftKnee;
          float leftLowerProj = clamp(dot(leftLowerUv, leftLowerDir), 0.0, 0.15);
          float leftLowerDist = length(leftLowerUv - leftLowerDir * leftLowerProj) - 0.025;
          shape = max(shape, smoothstep(0.01, 0.0, leftLowerDist));

          // Right leg (opposite phase)
          float rightLegAngle = sin(legPhase + PI) * 0.5;
          vec2 rightLegStart = bodyCenter + vec2(0.02, -0.05);
          vec2 rightLegDir = vec2(sin(rightLegAngle), -cos(rightLegAngle));

          vec2 rightLegUv = uv - rightLegStart;
          float rightLegProj = clamp(dot(rightLegUv, rightLegDir), 0.0, 0.2);
          float rightLegDist = length(rightLegUv - rightLegDir * rightLegProj) - 0.03;
          shape = max(shape, smoothstep(0.01, 0.0, rightLegDist));

          // Right lower leg
          vec2 rightKnee = rightLegStart + rightLegDir * 0.2;
          float rightLowerAngle = rightLegAngle + 0.3 + sin(legPhase + PI + 0.5) * 0.3;
          vec2 rightLowerDir = vec2(sin(rightLowerAngle), -cos(rightLowerAngle));
          vec2 rightLowerUv = uv - rightKnee;
          float rightLowerProj = clamp(dot(rightLowerUv, rightLowerDir), 0.0, 0.15);
          float rightLowerDist = length(rightLowerUv - rightLowerDir * rightLowerProj) - 0.025;
          shape = max(shape, smoothstep(0.01, 0.0, rightLowerDist));

          // Arms animation
          float armPhase = phase * PI * 2.0;

          // Left arm (opposite to left leg)
          float leftArmAngle = sin(armPhase + PI) * 0.6 - 0.3;
          vec2 leftArmStart = bodyCenter + vec2(-0.06, 0.15);
          vec2 leftArmDir = vec2(sin(leftArmAngle), -cos(leftArmAngle));
          vec2 leftArmUv = uv - leftArmStart;
          float leftArmProj = clamp(dot(leftArmUv, leftArmDir), 0.0, 0.15);
          float leftArmDist = length(leftArmUv - leftArmDir * leftArmProj) - 0.02;
          shape = max(shape, smoothstep(0.01, 0.0, leftArmDist));

          // Right arm
          float rightArmAngle = sin(armPhase) * 0.6 - 0.3;
          vec2 rightArmStart = bodyCenter + vec2(0.06, 0.15);
          vec2 rightArmDir = vec2(sin(rightArmAngle), -cos(rightArmAngle));
          vec2 rightArmUv = uv - rightArmStart;
          float rightArmProj = clamp(dot(rightArmUv, rightArmDir), 0.0, 0.15);
          float rightArmDist = length(rightArmUv - rightArmDir * rightArmProj) - 0.02;
          shape = max(shape, smoothstep(0.01, 0.0, rightArmDist));

          return shape;
        }

        // Parallax background elements
        float building(vec2 uv, float x, float height, float width) {
          vec2 buildingUv = uv - vec2(x, -0.5 + height * 0.5);
          float b = max(abs(buildingUv.x) - width * 0.5, abs(buildingUv.y) - height * 0.5);
          return smoothstep(0.01, 0.0, b);
        }

        float ground(vec2 uv, float offset) {
          float y = -0.4;
          // Ground line
          float line = smoothstep(0.02, 0.0, abs(uv.y - y));

          // Moving grid lines on ground
          float gridX = sin((uv.x + offset) * 30.0);
          gridX = pow(abs(gridX), 10.0);

          return line + gridX * 0.5 * smoothstep(y, y - 0.3, uv.y);
        }

        void main() {
          vec2 uv = vUv;

          // Pixelation effect
          if (uPixelated > 0.5) {
            float pixelSize = 4.0;
            uv = floor(uv * uResolution / pixelSize) * pixelSize / uResolution;
          }

          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 centeredUv = (uv - 0.5) * 2.0;
          centeredUv.x *= aspect.x;

          vec3 color = vec3(0.05, 0.02, 0.1); // Dark purple background

          // Stars
          vec2 starUv = centeredUv * 50.0 + uParallaxOffset * 0.1;
          float star = fract(sin(dot(floor(starUv), vec2(12.9898, 78.233))) * 43758.5453);
          star = step(0.97, star);
          color += vec3(star) * 0.5;

          // Far buildings (slowest parallax)
          float farOffset = uParallaxOffset * 0.1;
          for (float i = 0.0; i < 8.0; i++) {
            float x = mod(i * 0.4 - farOffset, 3.2) - 1.6;
            float h = 0.3 + fract(sin(i * 123.456) * 789.0) * 0.4;
            float w = 0.1 + fract(sin(i * 456.789) * 123.0) * 0.1;
            float b = building(centeredUv, x, h, w);
            color += hsl2rgb(uColorHue + 0.3, 0.5, 0.15) * b;
          }

          // Near buildings (faster parallax)
          float nearOffset = uParallaxOffset * 0.3;
          for (float i = 0.0; i < 6.0; i++) {
            float x = mod(i * 0.5 - nearOffset, 3.0) - 1.5;
            float h = 0.5 + fract(sin(i * 789.123) * 456.0) * 0.6;
            float w = 0.12 + fract(sin(i * 321.654) * 987.0) * 0.08;
            float b = building(centeredUv, x, h, w);
            color += hsl2rgb(uColorHue + 0.1, 0.6, 0.2) * b;
          }

          // Ground with moving grid
          float g = ground(centeredUv, uParallaxOffset);
          color += hsl2rgb(uColorHue, 0.8, 0.4) * g * 0.5;

          // Running man with jump offset
          vec2 manUv = centeredUv;
          manUv.y -= uJumpHeight;

          float man = runningMan(manUv, uRunPhase);

          // Man silhouette with neon glow
          vec3 manColor = hsl2rgb(uColorHue, 1.0, 0.6);

          // Inner glow
          color += manColor * man;

          // Outer glow
          float glowSize = 0.02 + uPulse * 0.01;
          float glow = 0.0;
          for (float dx = -1.0; dx <= 1.0; dx += 0.5) {
            for (float dy = -1.0; dy <= 1.0; dy += 0.5) {
              vec2 offset = vec2(dx, dy) * glowSize;
              glow += runningMan(manUv + offset, uRunPhase);
            }
          }
          color += manColor * glow * 0.1 * (1.0 + uPulse);

          // Beat flash
          color += vec3(1.0) * uPulse * 0.3;

          // Energy color shift
          color = mix(color, hsl2rgb(uColorHue + uEnergy * 0.2, 1.0, 0.6), uEnergy * 0.2);

          // Scanlines
          float scanline = sin(vUv.y * uResolution.y * 0.5) * 0.5 + 0.5;
          color *= 0.95 + scanline * 0.05;

          // Vignette
          float vignette = 1.0 - length(vUv - 0.5) * 0.8;
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

    // Update pulse on beat
    if (beat.isOnset) {
      this.currentPulse = 1.0
      this.jumpHeight = 0.15 + audio.bass * 0.1 // Jump on beat
    }
    this.currentPulse *= 0.9
    this.jumpHeight *= 0.9 // Fall back down

    // Update run animation
    const runMultiplier = this.runSpeed * (1.0 + audio.energy * 0.5)
    this.runPhase += dt * 3.0 * runMultiplier
    if (this.runPhase > 1.0) this.runPhase -= 1.0

    // Update parallax
    this.parallaxOffset += dt * 2.0 * runMultiplier

    // Update uniforms
    this.material.uniforms.uTime.value = time * 0.001
    this.material.uniforms.uPulse.value = this.currentPulse
    this.material.uniforms.uColorHue.value = this.colorHue
    this.material.uniforms.uBass.value = audio.bass
    this.material.uniforms.uEnergy.value = audio.energy
    this.material.uniforms.uRunPhase.value = this.runPhase
    this.material.uniforms.uJumpHeight.value = this.jumpHeight
    this.material.uniforms.uParallaxOffset.value = this.parallaxOffset
    this.material.uniforms.uPixelated.value = this.pixelated ? 1.0 : 0.0
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
      { key: 'runSpeed', label: 'Speed', type: 'number', value: this.runSpeed, min: 0.5, max: 3, step: 0.1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'pixelated', label: 'Pixels', type: 'number', value: this.pixelated ? 1 : 0, min: 0, max: 1, step: 1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'runSpeed':
        this.runSpeed = value as number
        break
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'pixelated':
        this.pixelated = (value as number) > 0.5
        break
    }
  }
}
