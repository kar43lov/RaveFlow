import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { AudioFeatures } from '../scenes/types'

interface EqualizerProps {
  audioFeatures: AudioFeatures
}

export function Equalizer({ audioFeatures }: EqualizerProps) {
  const { showEqualizer, micMode } = useStore()
  const barsRef = useRef<HTMLDivElement[]>([])
  const barCount = 48

  useEffect(() => {
    if (!showEqualizer) return

    // Update bar heights based on spectrum data
    const spectrum = audioFeatures.spectrum
    const step = Math.floor(spectrum.length / barCount)

    for (let i = 0; i < barCount; i++) {
      const bar = barsRef.current[i]
      if (!bar) continue

      // Average a range of frequencies for each bar
      let sum = 0
      for (let j = 0; j < step; j++) {
        const idx = i * step + j
        if (idx < spectrum.length) {
          sum += spectrum[idx]
        }
      }
      const avg = sum / step

      // Scale height (spectrum values are 0-1)
      const height = Math.max(2, avg * 70)
      bar.style.height = `${height}px`
    }
  }, [audioFeatures, showEqualizer])

  // Only show if enabled and mic mode is active
  if (!showEqualizer) {
    return null
  }

  return (
    <div className="equalizer">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="eq-bar"
          ref={(el) => {
            if (el) barsRef.current[i] = el
          }}
          style={{
            height: '2px',
            opacity: micMode ? 1 : 0.3
          }}
        />
      ))}
    </div>
  )
}
