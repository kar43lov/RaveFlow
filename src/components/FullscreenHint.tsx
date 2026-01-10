import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

export function FullscreenHint() {
  const { showHint, hideHint, isFullscreen } = useStore()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Hide after 5 seconds
    const timer = setTimeout(() => {
      setVisible(false)
      hideHint()
    }, 5000)

    // Hide on any key press or click
    const handleInteraction = () => {
      setVisible(false)
      hideHint()
    }

    window.addEventListener('keydown', handleInteraction, { once: true })
    window.addEventListener('click', handleInteraction, { once: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('click', handleInteraction)
    }
  }, [hideHint])

  // Don't show if already in fullscreen
  if (isFullscreen || !showHint || !visible) {
    return null
  }

  return (
    <div className={`fullscreen-hint ${!visible ? 'hidden' : ''}`}>
      Press <kbd>F</kbd> for fullscreen | <kbd>Tab</kbd> for settings
    </div>
  )
}
