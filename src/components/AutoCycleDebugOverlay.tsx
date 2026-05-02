import { AutoCycleDebug } from '../hooks/useAutoCycle'
import { useStore } from '../store/useStore'

interface Props {
  debug: AutoCycleDebug | null
}

const fmt = (n: number) => n.toFixed(3)

function Bar({
  label,
  value,
  threshold,
  maxValue = 1,
  highlight
}: {
  label: string
  value: number
  threshold?: number
  maxValue?: number
  highlight?: boolean
}) {
  const pct = Math.min(100, (value / maxValue) * 100)
  const tPct = threshold !== undefined ? Math.min(100, (threshold / maxValue) * 100) : null
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 10,
        marginBottom: 2,
        color: highlight ? '#7fffa1' : 'rgba(255,255,255,0.7)'
      }}>
        <span>{label}</span>
        <span>{fmt(value)}{threshold !== undefined ? ` (>${fmt(threshold)})` : ''}</span>
      </div>
      <div style={{
        position: 'relative',
        height: 6,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: highlight
            ? 'linear-gradient(90deg, #00ffaa, #00ff66)'
            : 'rgba(120, 180, 255, 0.6)'
        }} />
        {tPct !== null && (
          <div style={{
            position: 'absolute',
            left: `${tPct}%`,
            top: -2, bottom: -2,
            width: 2,
            background: '#ffaa00'
          }} />
        )}
      </div>
    </div>
  )
}

export function AutoCycleDebugOverlay({ debug }: Props) {
  const show = useStore((s) => s.showAutoCycleDebug)
  if (!show || !debug) return null

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: 16,
      width: 240,
      padding: 12,
      background: 'rgba(0,0,0,0.7)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: 11,
      pointerEvents: 'none',
      zIndex: 50,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
        opacity: 0.6,
        marginBottom: 8
      }}>
        Auto-cycle debug
      </div>

      <Bar
        label="energy"
        value={debug.energy}
        threshold={debug.dropEnergyMin}
        maxValue={Math.max(0.2, debug.energyPeak * 1.1)}
        highlight={debug.isDropNow}
      />
      <Bar
        label="bass"
        value={debug.bass}
        threshold={debug.dropBassMin}
        maxValue={Math.max(0.2, debug.bassPeak * 1.1)}
        highlight={debug.isDropNow}
      />

      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 8, marginBottom: 2 }}>
        avg {fmt(debug.energyAvg)} · peak {fmt(debug.energyPeak)} · silence&lt;{fmt(debug.silenceMax)}
      </div>
      <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
        prev (~0.5s) {fmt(debug.energyPrev)} · jump ×{debug.dropJumpRatio.toFixed(2)} required
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        fontSize: 10,
        marginTop: 6
      }}>
        <span style={{
          padding: '2px 6px',
          borderRadius: 3,
          background: debug.isDropNow ? '#00ff88' : 'rgba(255,255,255,0.06)',
          color: debug.isDropNow ? '#000' : 'rgba(255,255,255,0.5)',
          fontWeight: debug.isDropNow ? 700 : 400
        }}>
          DROP
        </span>
        <span style={{
          padding: '2px 6px',
          borderRadius: 3,
          background: debug.isSilentNow ? '#00ccff' : 'rgba(255,255,255,0.06)',
          color: debug.isSilentNow ? '#000' : 'rgba(255,255,255,0.5)',
          fontWeight: debug.isSilentNow ? 700 : 400
        }}>
          SILENT
        </span>
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
          cd {debug.cooldownLeft.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
