import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../store/useStore'
import { useFullscreen } from '../hooks/useFullscreen'

const HIDE_DELAY = 3000

export function TouchControls() {
  const { nextScene, prevScene, toggleSettings, currentSceneIndex, sceneCount, isFullscreen } = useStore()
  const { toggleFullscreen } = useFullscreen()
  const [visible, setVisible] = useState(false)
  const hideTimeoutRef = useRef<number | null>(null)

  const showControls = useCallback(() => {
    setVisible(true)

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    hideTimeoutRef.current = window.setTimeout(() => {
      setVisible(false)
    }, HIDE_DELAY)
  }, [])

  // Touch events
  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      // Don't show if touching a button or settings overlay
      const target = e.target as HTMLElement
      if (target.closest('.touch-controls') || target.closest('.settings-overlay')) {
        return
      }
      showControls()
    }

    // Mouse move for desktop
    const handleMouseMove = () => {
      showControls()
    }

    window.addEventListener('touchstart', handleTouch)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('touchstart', handleTouch)
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [showControls])

  const handlePrev = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    prevScene()
    showControls()
  }

  const handleNext = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    nextScene()
    showControls()
  }

  const handleSettings = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    toggleSettings()
  }

  const handleFullscreen = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    toggleFullscreen()
    showControls()
  }

  return (
    <div className={`touch-controls ${visible ? 'visible' : ''}`}>
      {/* Scene navigation */}
      <div className="touch-controls-nav">
        <button 
          className="touch-btn touch-btn-nav" 
          onClick={handlePrev}
          onTouchEnd={handlePrev}
          aria-label="Previous scene"
        >
          ◀
        </button>
        
        <span className="touch-scene-indicator">
          {currentSceneIndex + 1} / {sceneCount}
        </span>
        
        <button 
          className="touch-btn touch-btn-nav" 
          onClick={handleNext}
          onTouchEnd={handleNext}
          aria-label="Next scene"
        >
          ▶
        </button>
      </div>

      {/* Fullscreen button */}
      <button 
        className="touch-btn touch-btn-settings" 
        onClick={handleFullscreen}
        onTouchEnd={handleFullscreen}
        aria-label="Toggle fullscreen"
      >
        {isFullscreen ? '⊠' : '⛶'}
      </button>

      {/* Settings button */}
      <button 
        className="touch-btn touch-btn-settings" 
        onClick={handleSettings}
        onTouchEnd={handleSettings}
        aria-label="Open settings"
      >
        ⚙
      </button>
    </div>
  )
}
