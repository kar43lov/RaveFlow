import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  hue: number
  trail: { x: number; y: number; alpha: number }[]
}

export class BouncingBall implements Scene {
  name = 'Bouncing Ball'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private width: number = 0
  private height: number = 0
  private aspect: number = 1

  // Parameters
  private ballCount: number = 3
  private colorHue: number = 0.0
  private speed: number = 1.0
  private trailLength: number = 20

  // Animation state
  private balls: Ball[] = []
  private time: number = 0
  private currentPulse: number = 0
  private flashIntensity: number = 0

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.material = new THREE.ShaderMaterial()
    this.mesh = new THREE.Mesh()
  }

  private createBalls(): void {
    this.balls = []
    for (let i = 0; i < this.ballCount; i++) {
      this.balls.push({
        x: (Math.random() - 0.5) * 1.5 * this.aspect,
        y: (Math.random() - 0.5) * 1.5,
        vx: (Math.random() - 0.5) * 0.02 * this.speed,
        vy: (Math.random() - 0.5) * 0.02 * this.speed,
        radius: 0.05 + Math.random() * 0.03,
        hue: (this.colorHue + i / this.ballCount) % 1.0,
        trail: []
      })
    }
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

    this.createBalls()

    const geometry = new THREE.PlaneGeometry(2 * this.aspect, 2)

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uPulse: { value: 0 },
        uFlash: { value: 0 },
        uColorHue: { value: this.colorHue },
        uBass: { value: 0 },
        uEnergy: { value: 0 },
        uBallCount: { value: this.ballCount },
        uBallData: { value: new Float32Array(60) }, // Max 10 balls * 6 floats (x, y, radius, hue, vx, vy)
        uTrailData: { value: new Float32Array(600) } // Max 10 balls * 20 trail points * 3 floats (x, y, alpha)
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
        uniform float uFlash;
        uniform float uColorHue;
        uniform float uBass;
        uniform float uEnergy;
        uniform int uBallCount;
        uniform float uBallData[60];
        uniform float uTrailData[600];

        varying vec2 vUv;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float drawBall(vec2 uv, vec2 pos, float radius) {
          float d = length(uv - pos);
          float glow = exp(-d / (radius * 2.0));
          float core = smoothstep(radius, radius * 0.8, d);
          return core + glow * 0.5;
        }

        void main() {
          vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
          vec2 uv = (vUv - 0.5) * 2.0 * aspect;

          vec3 color = vec3(0.02, 0.02, 0.05); // Dark background

          // Draw grid
          float gridX = abs(sin(uv.x * 20.0));
          float gridY = abs(sin(uv.y * 20.0));
          float grid = max(gridX, gridY);
          grid = pow(grid, 20.0) * 0.1 * uEnergy;
          color += vec3(0.1, 0.1, 0.2) * grid;

          // Draw trails
          for (int b = 0; b < 10; b++) {
            if (b >= uBallCount) break;
            float ballHue = uBallData[b * 6 + 3];

            for (int t = 0; t < 20; t++) {
              int idx = b * 60 + t * 3;
              vec2 trailPos = vec2(uTrailData[idx], uTrailData[idx + 1]);
              float trailAlpha = uTrailData[idx + 2];

              if (trailAlpha > 0.01) {
                float d = length(uv - trailPos);
                float trailGlow = exp(-d * 30.0) * trailAlpha;
                color += hsl2rgb(ballHue, 1.0, 0.5) * trailGlow * 0.5;
              }
            }
          }

          // Draw balls
          for (int i = 0; i < 10; i++) {
            if (i >= uBallCount) break;

            int idx = i * 6;
            vec2 ballPos = vec2(uBallData[idx], uBallData[idx + 1]);
            float radius = uBallData[idx + 2];
            float hue = uBallData[idx + 3];

            float ball = drawBall(uv, ballPos, radius * (1.0 + uPulse * 0.3));
            vec3 ballColor = hsl2rgb(hue, 1.0, 0.6);
            color += ballColor * ball;
          }

          // Flash effect on collision
          color += vec3(1.0) * uFlash * 0.5;

          // Edge glow
          float edgeDist = min(min(abs(uv.x) - aspect.x + 0.1, abs(uv.y) - 1.0 + 0.1), 0.0);
          color += hsl2rgb(uColorHue, 1.0, 0.5) * (-edgeDist * 10.0) * (0.3 + uFlash * 0.7);

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
    const dt = deltaTime * 0.001 * 60 // Normalize to 60fps

    // Update pulse
    if (beat.isOnset) {
      this.currentPulse = 1.0
      // Add new ball on beat if under limit
      if (this.balls.length < 10 && Math.random() > 0.7) {
        this.balls.push({
          x: 0,
          y: 0,
          vx: (Math.random() - 0.5) * 0.03 * this.speed,
          vy: (Math.random() - 0.5) * 0.03 * this.speed,
          radius: 0.04 + Math.random() * 0.03,
          hue: Math.random(),
          trail: []
        })
      }
      // Speed boost on beat
      for (const ball of this.balls) {
        ball.vx *= 1.3
        ball.vy *= 1.3
      }
    }
    this.currentPulse *= 0.9
    this.flashIntensity *= 0.85

    // Update balls
    const speedMult = 1.0 + audio.energy * 0.5
    const ballData = new Float32Array(60)
    const trailData = new Float32Array(600)

    for (let i = 0; i < this.balls.length && i < 10; i++) {
      const ball = this.balls[i]

      // Add to trail
      ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 1.0 })
      if (ball.trail.length > this.trailLength) {
        ball.trail.pop()
      }

      // Fade trail
      for (let t = 0; t < ball.trail.length; t++) {
        ball.trail[t].alpha *= 0.9
      }

      // Move ball
      ball.x += ball.vx * dt * speedMult
      ball.y += ball.vy * dt * speedMult

      // Bounce off walls
      if (ball.x + ball.radius > this.aspect || ball.x - ball.radius < -this.aspect) {
        ball.vx *= -0.95
        ball.x = Math.max(-this.aspect + ball.radius, Math.min(this.aspect - ball.radius, ball.x))
        this.flashIntensity = 1.0
        ball.hue = (ball.hue + 0.1) % 1.0
      }
      if (ball.y + ball.radius > 1 || ball.y - ball.radius < -1) {
        ball.vy *= -0.95
        ball.y = Math.max(-1 + ball.radius, Math.min(1 - ball.radius, ball.y))
        this.flashIntensity = 1.0
        ball.hue = (ball.hue + 0.1) % 1.0
      }

      // Speed limit
      const maxSpeed = 0.05 * this.speed
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
      if (speed > maxSpeed) {
        ball.vx = (ball.vx / speed) * maxSpeed
        ball.vy = (ball.vy / speed) * maxSpeed
      }

      // Store ball data
      ballData[i * 6] = ball.x
      ballData[i * 6 + 1] = ball.y
      ballData[i * 6 + 2] = ball.radius
      ballData[i * 6 + 3] = ball.hue
      ballData[i * 6 + 4] = ball.vx
      ballData[i * 6 + 5] = ball.vy

      // Store trail data
      for (let t = 0; t < ball.trail.length && t < 20; t++) {
        const idx = i * 60 + t * 3
        trailData[idx] = ball.trail[t].x
        trailData[idx + 1] = ball.trail[t].y
        trailData[idx + 2] = ball.trail[t].alpha
      }
    }

    // Update uniforms
    this.material.uniforms.uTime.value = time * 0.001
    this.material.uniforms.uPulse.value = this.currentPulse
    this.material.uniforms.uFlash.value = this.flashIntensity
    this.material.uniforms.uColorHue.value = this.colorHue
    this.material.uniforms.uBass.value = audio.bass
    this.material.uniforms.uEnergy.value = audio.energy
    this.material.uniforms.uBallCount.value = Math.min(this.balls.length, 10)
    this.material.uniforms.uBallData.value = ballData
    this.material.uniforms.uTrailData.value = trailData
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
      { key: 'ballCount', label: 'Balls', type: 'number', value: this.ballCount, min: 1, max: 10, step: 1 },
      { key: 'colorHue', label: 'Color', type: 'number', value: this.colorHue, min: 0, max: 1, step: 0.05 },
      { key: 'speed', label: 'Speed', type: 'number', value: this.speed, min: 0.5, max: 2, step: 0.1 },
      { key: 'trailLength', label: 'Trail', type: 'number', value: this.trailLength, min: 5, max: 30, step: 1 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'ballCount':
        this.ballCount = value as number
        this.createBalls()
        break
      case 'colorHue':
        this.colorHue = value as number
        break
      case 'speed':
        this.speed = value as number
        break
      case 'trailLength':
        this.trailLength = value as number
        break
    }
  }
}
