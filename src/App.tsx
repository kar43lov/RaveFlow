import { useState, useCallback, useRef } from 'react'
import { Canvas } from './components/Canvas'
import { SettingsOverlay } from './components/SettingsOverlay'
import { Equalizer } from './components/Equalizer'
import { FullscreenHint } from './components/FullscreenHint'
import { useKeyboard } from './hooks/useKeyboard'
import { useStore } from './store/useStore'
import { SceneManager } from './renderer/SceneManager'
import { AudioAnalyzer } from './audio/AudioAnalyzer'
import { TapTempo } from './audio/BeatClock'
import { AudioFeatures, defaultAudioFeatures } from './scenes/types'

export function App() {
  const { sceneCount, setMicMode, setMicStatus } = useStore()

  const [sceneNames, setSceneNames] = useState<string[]>([])
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures>(defaultAudioFeatures)

  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null)
  const tapTempoRef = useRef<TapTempo | null>(null)

  // Initialize keyboard shortcuts
  useKeyboard({ sceneCount })

  const handleSceneManagerReady = useCallback((sceneManager: SceneManager) => {
    setSceneNames(sceneManager.getSceneNames())
  }, [])

  const handleAudioAnalyzerReady = useCallback((analyzer: AudioAnalyzer) => {
    audioAnalyzerRef.current = analyzer
  }, [])

  const handleTapTempoReady = useCallback((tapTempo: TapTempo) => {
    tapTempoRef.current = tapTempo
  }, [])

  const handleAudioFeaturesUpdate = useCallback((features: AudioFeatures) => {
    setAudioFeatures(features)
  }, [])

  const handleEnableMic = useCallback(async () => {
    const analyzer = audioAnalyzerRef.current
    if (!analyzer) return

    const status = await analyzer.startMic()
    setMicStatus(status)

    if (status === 'on') {
      setMicMode(true)
    } else {
      setMicMode(false)
    }
  }, [setMicMode, setMicStatus])

  const handleDisableMic = useCallback(() => {
    const analyzer = audioAnalyzerRef.current
    if (analyzer) {
      analyzer.stopMic()
    }
    setMicStatus('off')
    setMicMode(false)
  }, [setMicMode, setMicStatus])

  return (
    <>
      <Canvas
        onSceneManagerReady={handleSceneManagerReady}
        onAudioAnalyzerReady={handleAudioAnalyzerReady}
        onTapTempoReady={handleTapTempoReady}
        onAudioFeaturesUpdate={handleAudioFeaturesUpdate}
      />

      <Equalizer audioFeatures={audioFeatures} />

      <FullscreenHint />

      <SettingsOverlay
        sceneNames={sceneNames}
        onEnableMic={handleEnableMic}
        onDisableMic={handleDisableMic}
        tapTempo={tapTempoRef.current || new TapTempo()}
      />
    </>
  )
}
