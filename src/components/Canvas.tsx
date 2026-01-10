import { useEffect, useRef, useCallback } from 'react'
import { Renderer } from '../renderer/Renderer'
import { SceneManager } from '../renderer/SceneManager'
import { AudioAnalyzer } from '../audio/AudioAnalyzer'
import { BeatClock, TapTempo } from '../audio/BeatClock'
import { useStore } from '../store/useStore'
import { AudioFeatures, BeatInfo, defaultAudioFeatures, defaultBeatInfo } from '../scenes/types'

interface CanvasProps {
  onSceneManagerReady: (sceneManager: SceneManager) => void
  onAudioAnalyzerReady: (analyzer: AudioAnalyzer) => void
  onTapTempoReady: (tapTempo: TapTempo) => void
  onAudioFeaturesUpdate: (features: AudioFeatures) => void
}

export function Canvas({
  onSceneManagerReady,
  onAudioAnalyzerReady,
  onTapTempoReady,
  onAudioFeaturesUpdate
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const sceneManagerRef = useRef<SceneManager | null>(null)
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null)
  const beatClockRef = useRef<BeatClock | null>(null)
  const tapTempoRef = useRef<TapTempo | null>(null)
  const animationFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const {
    isPaused,
    currentSceneIndex,
    setCurrentSceneIndex,
    setSceneCount,
    micMode,
    micStatus,
    bpm,
    setAutoBPM,
    quality,
    masterIntensity,
    sensitivity,
    smoothing
  } = useStore()

  // Initialize renderer and scene manager
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create renderer
    const renderer = new Renderer(canvas)
    rendererRef.current = renderer

    // Create scene manager
    const sceneManager = new SceneManager(renderer)
    sceneManager.init()
    sceneManagerRef.current = sceneManager

    // Create audio analyzer
    const audioAnalyzer = new AudioAnalyzer()
    audioAnalyzerRef.current = audioAnalyzer

    // Create beat clock
    const beatClock = new BeatClock(bpm)
    beatClock.start()
    beatClockRef.current = beatClock

    // Create tap tempo
    const tapTempo = new TapTempo()
    tapTempoRef.current = tapTempo

    // Notify parent
    setSceneCount(sceneManager.getSceneCount())
    onSceneManagerReady(sceneManager)
    onAudioAnalyzerReady(audioAnalyzer)
    onTapTempoReady(tapTempo)

    // Handle resize
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      renderer.resize(width, height)
      sceneManager.resize(width, height)
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameRef.current)
      sceneManager.dispose()
      renderer.dispose()
      audioAnalyzer.dispose()
    }
  }, [])

  // Update quality when it changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setQuality(quality)
    }
  }, [quality])

  // Update BPM when it changes
  useEffect(() => {
    if (beatClockRef.current) {
      beatClockRef.current.setBPM(bpm)
    }
  }, [bpm])

  // Update audio analyzer settings
  useEffect(() => {
    if (audioAnalyzerRef.current) {
      audioAnalyzerRef.current.setSensitivity(sensitivity)
      audioAnalyzerRef.current.setSmoothing(smoothing)
    }
  }, [sensitivity, smoothing])

  // Update current scene
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setCurrentSceneIndex(currentSceneIndex)
    }
  }, [currentSceneIndex])

  // Animation loop
  const animate = useCallback((time: number) => {
    animationFrameRef.current = requestAnimationFrame(animate)

    if (isPaused) {
      lastTimeRef.current = time
      return
    }

    const deltaTime = time - lastTimeRef.current
    lastTimeRef.current = time

    const sceneManager = sceneManagerRef.current
    const renderer = rendererRef.current
    const audioAnalyzer = audioAnalyzerRef.current
    const beatClock = beatClockRef.current

    if (!sceneManager || !renderer || !beatClock) return

    let audioFeatures: AudioFeatures = { ...defaultAudioFeatures }
    let beatInfo: BeatInfo = defaultBeatInfo

    if (micMode && micStatus === 'on' && audioAnalyzer) {
      // Update audio analyzer
      audioAnalyzer.update()
      audioFeatures = audioAnalyzer.getFeatures()

      // Get auto BPM
      const estimatedBPM = audioAnalyzer.getEstimatedBPM()
      setAutoBPM(estimatedBPM)

      // Create beat info from audio
      beatInfo = {
        phase: 0, // Not used in mic mode
        intensity: audioFeatures.bass,
        isOnset: audioAnalyzer.isCurrentlyOnset(),
        bpm: estimatedBPM
      }
    } else {
      // Use manual beat clock
      beatInfo = beatClock.update()

      // Simulate some audio features from beat
      audioFeatures = {
        ...defaultAudioFeatures,
        energy: beatInfo.intensity * 0.5,
        bass: beatInfo.intensity,
        mid: beatInfo.intensity * 0.7,
        high: beatInfo.intensity * 0.3
      }
    }

    // Apply master intensity
    audioFeatures.energy *= masterIntensity
    audioFeatures.bass *= masterIntensity
    audioFeatures.mid *= masterIntensity
    audioFeatures.high *= masterIntensity

    // Update audio features for equalizer
    onAudioFeaturesUpdate(audioFeatures)

    // Update and render scene
    sceneManager.update(time, deltaTime, beatInfo, audioFeatures)
    sceneManager.render()
  }, [isPaused, micMode, micStatus, masterIntensity, setAutoBPM, onAudioFeaturesUpdate])

  // Start animation loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrameRef.current)
  }, [animate])

  return (
    <div className="canvas-container">
      <canvas ref={canvasRef} />
    </div>
  )
}
