import { useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'

export function useFullscreen() {
  const { isFullscreen, setFullscreen } = useStore()

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setFullscreen(true)
      } else {
        await document.exitFullscreen()
        setFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [setFullscreen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [setFullscreen])

  return { isFullscreen, toggleFullscreen }
}
