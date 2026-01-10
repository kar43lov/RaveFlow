import * as THREE from 'three'
import { Scene, SceneParameter, BeatInfo, AudioFeatures } from './types'

export class PongBattle implements Scene {
  name = 'Pong Battle'

  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  private width: number = 0
  private height: number = 0
  private aspect: number = 1

  // Parameters
  private gameSpeed: number = 1.0
  private leftColor: number = 0.0 // Red
  private rightColor: number = 0.55 // Cyan

  // Game state
  private ballX: number = 0
  private ballY: number = 0
  private ballVX: number = 0.015
  private ballVY: number = 0.01
  private leftPaddleY: number = 0
  private rightPaddleY: number = 0
  private leftScore: number = 0
  private rightScore: number = 0

  // Animation state
  private time: number = 0
  private currentPulse: number = 0
  private hitFlash: number = 0
  private ballTrail: { x: number; y: number; alpha: number }[] = []

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.material = new THREE.ShaderMaterial()
    this.mesh = new THREE.Mesh()
  }

  private resetBall(): void {
    this.ballX = 0
    this.ballY = 0
    this.ballVX = (Math.random() > 0.5 ? 1 : -1) * 0.015
    this.ballVY = (Math.random() - 0.5) * 0.02
    this.ballTrail = []
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

    this.resetBall()

    const geometry = new THREE.PlaneGeometry(2 * this.aspect, 2)

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uPulse: { value: 0 },
        uHitFlash: { value: 0 },
        uBass: { value: 0 },
        uEnergy: { value: 0 },
        uBallX: { value: 0 },
        uBallY: { value: 0 },
        uLeftPaddleY: { value: 0 },
        uRightPaddleY: { value: 0 },
        uLeftScore: { value: 0 },
        uRightScore: { value: 0 },
        uLeftColor: { value: this.leftColor },
        uRightColor: { value: this.rightColor },
        uAspect: { value: this.aspect },
        uTrailData: { value: new Float32Array(60) } // 20 trail points * 3
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
        uniform float uHitFlash;
        uniform float uBass;
        uniform float uEnergy;
        uniform float uBallX;
        uniform float uBallY;
        uniform float uLeftPaddleY;
        uniform float uRightPaddleY;
        uniform float uLeftScore;
        uniform float uRightScore;
        uniform float uLeftColor;
        uniform float uRightColor;
        uniform float uAspect;
        uniform float uTrailData[60];

        varying vec2 vUv;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float box(vec2 uv, vec2 pos, vec2 size) {
          vec2 d = abs(uv - pos) - size;
          return smoothstep(0.01, 0.0, max(d.x, d.y));
        }

        float circle(vec2 uv, vec2 pos, float radius) {
          return smoothstep(radius, radius * 0.8, length(uv - pos));
        }

        // 7-segment digit display
        float segment(vec2 uv, vec2 pos, bool horizontal) {
          vec2 size = horizontal ? vec2(0.04, 0.01) : vec2(0.01, 0.04);
          return box(uv, pos, size);
        }

        float digit(vec2 uv, vec2 pos, int d) {
          float s = 0.0;
          float w = 0.05;
          float h = 0.05;

          // Segments: top, top-left, top-right, middle, bottom-left, bottom-right, bottom
          bool segs[70] = bool[70](
            // 0
            true, true, true, false, true, true, true,
            // 1
            false, false, true, false, false, true, false,
            // 2
            true, false, true, true, true, false, true,
            // 3
            true, false, true, true, false, true, true,
            // 4
            false, true, true, true, false, true, false,
            // 5
            true, true, false, true, false, true, true,
            // 6
            true, true, false, true, true, true, true,
            // 7
            true, false, true, false, false, true, false,
            // 8
            true, true, true, true, true, true, true,
            // 9
            true, true, true, true, false, true, true
          );

          int idx = d * 7;

          if (segs[idx]) s += segment(uv, pos + vec2(0.0, h), true); // top
          if (segs[idx+1]) s += segment(uv, pos + vec2(-w, h*0.5), false); // top-left
          if (segs[idx+2]) s += segment(uv, pos + vec2(w, h*0.5), false); // top-right
          if (segs[idx+3]) s += segment(uv, pos, true); // middle
          if (segs[idx+4]) s += segment(uv, pos + vec2(-w, -h*0.5), false); // bottom-left
          if (segs[idx+5]) s += segment(uv, pos + vec2(w, -h*0.5), false); // bottom-right
          if (segs[idx+6]) s += segment(uv, pos + vec2(0.0, -h), true); // bottom

          return min(s, 1.0);
        }

        void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          uv.x *= uAspect;

          vec3 color = vec3(0.02, 0.02, 0.05); // Dark background

          // Grid background
          float gridX = abs(sin(uv.x * 20.0));
          float gridY = abs(sin(uv.y * 20.0));
          float grid = pow(max(gridX, gridY), 20.0);
          color += vec3(0.05, 0.05, 0.1) * grid * (0.3 + uEnergy * 0.7);

          // Center line (dashed)
          float centerLine = smoothstep(0.02, 0.0, abs(uv.x));
          centerLine *= step(0.5, fract(uv.y * 5.0 + 0.25));
          color += vec3(0.3) * centerLine;

          // Paddles
          float paddleWidth = 0.03;
          float paddleHeight = 0.2 + uBass * 0.1;

          // Left paddle
          float leftPaddle = box(uv, vec2(-uAspect + 0.1, uLeftPaddleY), vec2(paddleWidth, paddleHeight));
          color += hsl2rgb(uLeftColor, 1.0, 0.6) * leftPaddle;

          // Left paddle glow
          float leftGlow = exp(-length(uv - vec2(-uAspect + 0.1, uLeftPaddleY)) * 3.0);
          color += hsl2rgb(uLeftColor, 1.0, 0.4) * leftGlow * 0.3;

          // Right paddle
          float rightPaddle = box(uv, vec2(uAspect - 0.1, uRightPaddleY), vec2(paddleWidth, paddleHeight));
          color += hsl2rgb(uRightColor, 1.0, 0.6) * rightPaddle;

          // Right paddle glow
          float rightGlow = exp(-length(uv - vec2(uAspect - 0.1, uRightPaddleY)) * 3.0);
          color += hsl2rgb(uRightColor, 1.0, 0.4) * rightGlow * 0.3;

          // Ball trail
          for (int i = 0; i < 20; i++) {
            int idx = i * 3;
            vec2 trailPos = vec2(uTrailData[idx], uTrailData[idx + 1]);
            float trailAlpha = uTrailData[idx + 2];

            if (trailAlpha > 0.01) {
              float trailBall = exp(-length(uv - trailPos) * 20.0) * trailAlpha;
              color += vec3(1.0, 0.8, 0.2) * trailBall * 0.5;
            }
          }

          // Ball
          float ballRadius = 0.03 + uPulse * 0.02;
          vec2 ballPos = vec2(uBallX, uBallY);
          float ball = circle(uv, ballPos, ballRadius);
          color += vec3(1.0, 1.0, 1.0) * ball;

          // Ball glow
          float ballGlow = exp(-length(uv - ballPos) * 8.0);
          color += vec3(1.0, 0.9, 0.5) * ballGlow * (0.5 + uPulse * 0.5);

          // Scores
          float scoreLeft = digit(uv, vec2(-0.3, 0.75), int(mod(uLeftScore, 10.0)));
          color += hsl2rgb(uLeftColor, 1.0, 0.6) * scoreLeft;

          float scoreRight = digit(uv, vec2(0.3, 0.75), int(mod(uRightScore, 10.0)));
          color += hsl2rgb(uRightColor, 1.0, 0.6) * scoreRight;

          // Hit flash effect
          color += vec3(1.0) * uHitFlash * 0.3;

          // Pulse effect on boundaries
          float boundaryGlow = max(
            exp(-abs(uv.y - 1.0) * 10.0),
            exp(-abs(uv.y + 1.0) * 10.0)
          );
          color += vec3(0.5, 0.2, 0.8) * boundaryGlow * uPulse;

          // Scanlines
          float scanline = sin(vUv.y * uResolution.y * 0.5) * 0.5 + 0.5;
          color *= 0.95 + scanline * 0.05;

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
    const dt = deltaTime * 0.001 * 60 * this.gameSpeed

    // Update pulse
    if (beat.isOnset) {
      this.currentPulse = 1.0
      // Speed boost on beat
      this.ballVX *= 1.1
      this.ballVY *= 1.1
      // Clamp speed
      const maxSpeed = 0.04 * this.gameSpeed
      const speed = Math.sqrt(this.ballVX * this.ballVX + this.ballVY * this.ballVY)
      if (speed > maxSpeed) {
        this.ballVX = (this.ballVX / speed) * maxSpeed
        this.ballVY = (this.ballVY / speed) * maxSpeed
      }
    }
    this.currentPulse *= 0.9
    this.hitFlash *= 0.85

    // Add to trail
    this.ballTrail.unshift({ x: this.ballX, y: this.ballY, alpha: 1.0 })
    if (this.ballTrail.length > 20) this.ballTrail.pop()
    for (let i = 0; i < this.ballTrail.length; i++) {
      this.ballTrail[i].alpha *= 0.9
    }

    // Move ball
    this.ballX += this.ballVX * dt
    this.ballY += this.ballVY * dt

    // Ball collision with top/bottom
    if (this.ballY > 0.9 || this.ballY < -0.9) {
      this.ballVY *= -1
      this.ballY = Math.max(-0.9, Math.min(0.9, this.ballY))
      this.hitFlash = 0.5
    }

    // AI for paddles - simple tracking with some delay
    const paddleSpeed = 0.03 * dt * (1 + audio.energy * 0.5)
    const paddleHeight = 0.2 + audio.bass * 0.1

    // Left paddle AI
    const leftTarget = this.ballX < 0 ? this.ballY : 0
    if (this.leftPaddleY < leftTarget - 0.05) {
      this.leftPaddleY += paddleSpeed
    } else if (this.leftPaddleY > leftTarget + 0.05) {
      this.leftPaddleY -= paddleSpeed
    }
    this.leftPaddleY = Math.max(-1 + paddleHeight, Math.min(1 - paddleHeight, this.leftPaddleY))

    // Right paddle AI
    const rightTarget = this.ballX > 0 ? this.ballY : 0
    if (this.rightPaddleY < rightTarget - 0.05) {
      this.rightPaddleY += paddleSpeed
    } else if (this.rightPaddleY > rightTarget + 0.05) {
      this.rightPaddleY -= paddleSpeed
    }
    this.rightPaddleY = Math.max(-1 + paddleHeight, Math.min(1 - paddleHeight, this.rightPaddleY))

    // Ball collision with paddles
    const paddleWidth = 0.03
    const leftPaddleX = -this.aspect + 0.1
    const rightPaddleX = this.aspect - 0.1

    // Left paddle collision
    if (this.ballX - 0.03 < leftPaddleX + paddleWidth &&
        this.ballX > leftPaddleX - paddleWidth &&
        Math.abs(this.ballY - this.leftPaddleY) < paddleHeight + 0.03) {
      this.ballVX = Math.abs(this.ballVX)
      this.ballVY += (this.ballY - this.leftPaddleY) * 0.1
      this.hitFlash = 1.0
      this.ballX = leftPaddleX + paddleWidth + 0.03
    }

    // Right paddle collision
    if (this.ballX + 0.03 > rightPaddleX - paddleWidth &&
        this.ballX < rightPaddleX + paddleWidth &&
        Math.abs(this.ballY - this.rightPaddleY) < paddleHeight + 0.03) {
      this.ballVX = -Math.abs(this.ballVX)
      this.ballVY += (this.ballY - this.rightPaddleY) * 0.1
      this.hitFlash = 1.0
      this.ballX = rightPaddleX - paddleWidth - 0.03
    }

    // Score
    if (this.ballX < -this.aspect - 0.1) {
      this.rightScore++
      this.resetBall()
      this.hitFlash = 1.0
    }
    if (this.ballX > this.aspect + 0.1) {
      this.leftScore++
      this.resetBall()
      this.hitFlash = 1.0
    }

    // Reset scores at 10
    if (this.leftScore >= 10 || this.rightScore >= 10) {
      this.leftScore = 0
      this.rightScore = 0
    }

    // Update trail data
    const trailData = new Float32Array(60)
    for (let i = 0; i < this.ballTrail.length && i < 20; i++) {
      trailData[i * 3] = this.ballTrail[i].x
      trailData[i * 3 + 1] = this.ballTrail[i].y
      trailData[i * 3 + 2] = this.ballTrail[i].alpha
    }

    // Update uniforms
    this.material.uniforms.uTime.value = time * 0.001
    this.material.uniforms.uPulse.value = this.currentPulse
    this.material.uniforms.uHitFlash.value = this.hitFlash
    this.material.uniforms.uBass.value = audio.bass
    this.material.uniforms.uEnergy.value = audio.energy
    this.material.uniforms.uBallX.value = this.ballX
    this.material.uniforms.uBallY.value = this.ballY
    this.material.uniforms.uLeftPaddleY.value = this.leftPaddleY
    this.material.uniforms.uRightPaddleY.value = this.rightPaddleY
    this.material.uniforms.uLeftScore.value = this.leftScore
    this.material.uniforms.uRightScore.value = this.rightScore
    this.material.uniforms.uLeftColor.value = this.leftColor
    this.material.uniforms.uRightColor.value = this.rightColor
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
    this.material.uniforms.uAspect.value = this.aspect
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
      { key: 'gameSpeed', label: 'Speed', type: 'number', value: this.gameSpeed, min: 0.5, max: 2, step: 0.1 },
      { key: 'leftColor', label: 'Left', type: 'number', value: this.leftColor, min: 0, max: 1, step: 0.05 },
      { key: 'rightColor', label: 'Right', type: 'number', value: this.rightColor, min: 0, max: 1, step: 0.05 }
    ]
  }

  setParameter(key: string, value: number | string): void {
    switch (key) {
      case 'gameSpeed':
        this.gameSpeed = value as number
        break
      case 'leftColor':
        this.leftColor = value as number
        break
      case 'rightColor':
        this.rightColor = value as number
        break
    }
  }
}
