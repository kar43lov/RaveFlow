import { useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { useFullscreen } from './useFullscreen'

interface UseKeyboardOptions {
  sceneCount: number
}

export function useKeyboard({ sceneCount }: UseKeyboardOptions) {
  const {
    setCurrentSceneIndex,
    nextScene,
    prevScene,
    togglePause,
    toggleSettings,
    closeSettings,
    showSettings,
    hideHint
  } = useStore()

  const { toggleFullscreen } = useFullscreen()

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle if typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // Hide hint on any key
    hideHint()

    switch (event.key.toLowerCase()) {
      // Scene selection (1-9)
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        const sceneIndex = parseInt(event.key) - 1
        if (sceneIndex < sceneCount) {
          setCurrentSceneIndex(sceneIndex)
        }
        break

      // Next scene
      case 'n':
        nextScene()
        break

      // Previous scene
      case 'p':
        prevScene()
        break

      // Fullscreen
      case 'f':
        toggleFullscreen()
        break

      // Pause
      case ' ':
        event.preventDefault()
        togglePause()
        break

      // Toggle settings
      case 'tab':
      case 'h':
        event.preventDefault()
        toggleSettings()
        break

      // Close settings
      case 'escape':
        if (showSettings) {
          closeSettings()
        }
        break
    }
  }, [
    sceneCount,
    setCurrentSceneIndex,
    nextScene,
    prevScene,
    togglePause,
    toggleSettings,
    closeSettings,
    showSettings,
    toggleFullscreen,
    hideHint
  ])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}
